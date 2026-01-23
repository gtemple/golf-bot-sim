from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum

from apps.tournaments.models import (
    Tournament,
    TournamentEntry,
    TournamentEvent,
    Group,
    GroupMember,
    HoleResult,
)
from apps.courses.models import Course
from apps.golfers.models import Golfer


class TournamentEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TournamentEvent
        fields = ["id", "text", "importance", "created_at"]


class HoleResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = HoleResult
        fields = ["round_number", "hole_number", "strokes", "stats"]


class TournamentEntrySerializer(serializers.ModelSerializer):
    hole_results = HoleResultSerializer(many=True, read_only=True)

    class Meta:
        model = TournamentEntry
        fields = [
            "id",
            "display_name",
            "is_human",
            "golfer",
            "total_strokes",
            "tournament_strokes",
            "thru_hole",
            "position",
            "cut",
            "country",
            "team",  # <-- Added
            "handedness",
            "avatar_color",
            "hole_results",
        ]



class GroupMemberSerializer(serializers.ModelSerializer):
    entry = TournamentEntrySerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ["id", "entry"]


class GroupSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "tee_time",
            "wave",
            "start_hole",
            "current_hole",
            "holes_completed",
            "next_action_time",
            "is_finished",
            "members",
        ]


class TournamentSerializer(serializers.ModelSerializer):
    entries = TournamentEntrySerializer(many=True, read_only=True)
    groups = GroupSerializer(many=True, read_only=True)
    projected_cut = serializers.SerializerMethodField()
    recent_events = serializers.SerializerMethodField()
    best_rounds = serializers.SerializerMethodField()

    class Meta:
        model = Tournament
        fields = [
            "id",
            "name",
            "course",
            "status",
            "format",  # <-- Added
            "start_time",
            "current_time",
            "current_round",
            "cut_size",
            "cut_applied",
            "projected_cut",
            "recent_events",
            "best_rounds",
            "session_history",
            "entries",
            "groups",
        ]

    def get_projected_cut(self, obj):
        return obj.projected_cut_score

    def get_recent_events(self, obj):
        # Return last 10 events
        qs = obj.events.all().order_by("-created_at")[:10]
        return TournamentEventSerializer(qs, many=True).data

    def get_best_rounds(self, obj):
        """
        Return top 5 lowest scores for the *current round*
        so far. Useful for 'Big Movers' widget.
        """
        # We need to compute score relative to par for current round
        # This is a bit expensive if we do it for everyone.
        # Faster way: Query HoleResults for current round, aggregate sum strokes
        # But that doesn't account for how many holes they played ( -2 thru 3 is better than E thru 18? maybe not)
        # Standard 'Low Round' is total strokes relative to par.
        
        # 1. Get all HoleResults for this tournament + current round
        from django.db.models import Sum, Count, F
        
        # We want: Entry ID, sum(strokes), count(holes)
        # Then we subtract count(holes) * avg_par (or look up pars)
        
        current_round = obj.current_round
        
        # Aggregate stats for R{current_round}
        # Filter to entries who have started at least 1 hole in this round
        results = HoleResult.objects.filter(
            entry__tournament=obj, round_number=current_round
        ).values('entry__id', 'entry__display_name').annotate(
            total_strokes=Sum('strokes'),
            played_holes=Count('id')
        )
        
        if not results:
            return []
            
        # We need par info. Assuming standard par 4 is avg? No, inaccurate.
        # Fetch course pars map
        course_pars = {h.number: h.par for h in obj.course.holes.all()}
        
        data = []
        for r in results:
            # We must re-query the exact hole numbers played to get exact par
            # This is N+1 but optimized by just fetching hole numbers
            played_hole_nums = HoleResult.objects.filter(
                entry_id=r['entry__id'], 
                round_number=current_round
            ).values_list('hole_number', flat=True)
            
            par_total = sum(course_pars.get(h, 4) for h in played_hole_nums)
            score_to_par = r['total_strokes'] - par_total
            
            # Format: "-3 (12)" or "-3 (F)"
            thru = len(played_hole_nums)
            thru_display = "F" if thru >= 18 else str(thru)
            
            data.append({
                "id": r['entry__id'],
                "name": r['entry__display_name'],
                "score": score_to_par,
                "thru": thru_display,
                "raw_score": r['total_strokes']
            })
            
        # Sort by score asc (lowest first)
        data.sort(key=lambda x: x['score'])
        
        return data[:5]
    
    def get_projected_cut(self, obj):
        """
        Calculate projected cut line during R1 and R2 (before cut is applied).
        Uses current Score To Par for all players to determine the cut line.
        """
        # Only show projected cut during rounds 1-2, before cut is applied
        if obj.current_round > 2 or obj.cut_applied:
            return None
        
        entries = list(obj.entries.all())
        if not entries:
            return None
        
        # Get course pars to compute Score To Par correctly (handling partial rounds)
        course_pars = {h.number: h.par for h in obj.course.holes.all()}
        
        scored = []
        for e in entries:
            # Calculate current cumulative Score To Par using hole results
            # This handles partial rounds (R1 mid-round) and complete rounds correctly.
            # (strokes - par) for only the holes played.
            results = e.hole_results.all()
            
            if not results:
                # Haven't started or played any holes -> Even par
                scored.append((e.id, 0))
                continue
            
            total_strokes = 0
            total_par = 0
            
            for r in results:
                # Include results from R1 and R2
                if r.round_number > 2:
                    continue
                
                total_strokes += r.strokes
                total_par += course_pars.get(r.hole_number, 4)
            
            score_to_par = total_strokes - total_par
            scored.append((e.id, score_to_par))
        
        # Sort by score (lowest is best)
        scored.sort(key=lambda x: x[1])
        
        cut_size = obj.cut_size or 65
        if len(scored) <= cut_size:
            return None  # No cut needed
        
        # Find the cut score (top cut_size + ties)
        # scored is a list of (id, score_to_par)
        cut_val = scored[cut_size - 1][1]
        
        # Count stats
        at_cut_line = sum(1 for _, score in scored if score == cut_val)
        inside_cut = sum(1 for _, score in scored if score < cut_val)
        
        return {
            "cut_score": cut_val, # For display purposes, this is the relative score
            "cut_to_par": cut_val,
            "cut_position": cut_size,
            "players_at_line": at_cut_line,
            "players_inside": inside_cut,
        }
        

class TournamentCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    course_id = serializers.IntegerField()
    golfer_count = serializers.IntegerField(default=0)
    field_type = serializers.ChoiceField(
        choices=['top_ranked', 'amateur', 'random', 'mixed', 'mid_tier'],
        default='top_ranked',
    )
    format = serializers.ChoiceField(choices=['stroke', 'match', 'match_fourball'], default='stroke')
    # Deprecated but kept for backwards compat
    golfer_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )
    humans = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="List of human player objects: {name, country, handedness, avatar_color}",
    )


    start_time = serializers.DateTimeField(required=False)

    @transaction.atomic
    def create(self, validated_data):
        from datetime import datetime, time
        
        course = Course.objects.get(id=validated_data["course_id"])
        
        fmt = validated_data.get("format", "stroke")
        is_fourball = fmt == 'match_fourball'
        # Normalize to 'match' for DB if it's a match variant
        db_format = 'match' if fmt.startswith('match') else 'stroke'

        # Get current time, or use provided start_time
        raw_start_time = validated_data.get("start_time")
        if raw_start_time:
            # Use the provided date but set time to 12:30 PM UTC (which is 7:30 AM EST)
            # This ensures "morning" tee times for US users instead of 2-3 AM
            start_time = raw_start_time.replace(hour=12, minute=30, second=0, microsecond=0)
        else:
            # Get today's date in the current timezone and set to 12:30 PM UTC
            now = timezone.now()
            start_time = timezone.make_aware(
                datetime.combine(now.date(), time(12, 30, 0))
            )

        tee_interval_minutes = 11  # default PGA-ish, configurable later

        t = Tournament.objects.create(
            name=validated_data["name"],
            course=course,
            status="setup",
            format=db_format,
            start_time=start_time,
            current_time=start_time,
            current_round=1,
        )

        # Select golfers based on field type
        golfer_count = validated_data.get("golfer_count", 0)
        field_type = validated_data.get("field_type", "top_ranked")
        golfer_ids = validated_data.get("golfer_ids", [])
        
        # If old API with golfer_ids is used, use those
        if golfer_ids:
            golfers = Golfer.objects.filter(id__in=golfer_ids)
            for g in golfers:
                TournamentEntry.objects.create(
                    tournament=t, golfer=g, display_name=g.name, is_human=False
                )
        elif golfer_count > 0:
            # Calculate overall rating as average of key skills
            from django.db.models import F, FloatField, ExpressionWrapper
            from django.db.models.functions import Cast
            
            all_golfers = list(
                Golfer.objects.annotate(
                    overall_rating=ExpressionWrapper(
                        (
                            Cast(F('driving_power'), FloatField()) +
                            Cast(F('driving_accuracy'), FloatField()) +
                            Cast(F('approach'), FloatField()) +
                            Cast(F('short_game'), FloatField()) +
                            Cast(F('putting'), FloatField()) +
                            Cast(F('ball_striking'), FloatField()) +
                            Cast(F('consistency'), FloatField())
                        ) / 7.0,
                        output_field=FloatField()
                    )
                ).order_by('-overall_rating', 'name')
            )
            
            # Special handling for Match Play (Ryder Cup) to ensure balanced teams
            if t.format == 'match':
                # Analyze human participants to balance the teams to 12 vs 12
                humans_data = validated_data.get("humans", [])
                h_usa = 0
                h_eur = 0
                for h in humans_data:
                    c_code = (h.get("country", "") or "")[:3]
                    tm = h.get("team", "")
                    if not tm:
                        tm = "USA" if c_code == "USA" else "EUR"
                    
                    if tm == 'USA':
                        h_usa += 1
                    else:
                        h_eur += 1
                
                # We need 12 total per team
                need_usa = max(0, 12 - h_usa)
                need_eur = max(0, 12 - h_eur)

                usa_bots = [g for g in all_golfers if g.country == 'USA']
                eur_bots = [g for g in all_golfers if g.country != 'USA']
                
                # Take the best available bots for each side
                selected = (usa_bots[:need_usa] + eur_bots[:need_eur])

            elif field_type == 'top_ranked':
                # Best golfers
                selected = all_golfers[:golfer_count]
            elif field_type == 'amateur':
                # Worst golfers
                selected = all_golfers[-golfer_count:]
            elif field_type == 'random':
                # Random selection
                import random
                selected = random.sample(all_golfers, min(golfer_count, len(all_golfers)))
            elif field_type == 'mid_tier':
                # Middle of the pack
                start_idx = max(0, len(all_golfers) // 2 - golfer_count // 2)
                selected = all_golfers[start_idx:start_idx + golfer_count]
            elif field_type == 'mixed':
                # Mixed field: 30% top, 50% middle, 20% bottom
                top_count = int(golfer_count * 0.3)
                mid_count = int(golfer_count * 0.5)
                bottom_count = golfer_count - top_count - mid_count
                
                mid_start = len(all_golfers) // 3
                mid_end = 2 * len(all_golfers) // 3
                
                selected = (
                    all_golfers[:top_count] +
                    all_golfers[mid_start:mid_start + mid_count] +
                    (all_golfers[-bottom_count:] if bottom_count > 0 else [])
                )
            else:
                selected = all_golfers[:golfer_count]
            
            for g in selected:
                team = ""
                if t.format == 'match':
                    team = "USA" if g.country == "USA" else "EUR"
                
                TournamentEntry.objects.create(
                    tournament=t, golfer=g, display_name=g.name, is_human=False,
                    team=team
                )

        for h in validated_data.get("humans", []):
            country_code = (h.get("country", "") or "")[:3]  # Ensure max 3 chars
            
            team = h.get("team", "")
            if t.format == 'match' and not team:
                team = "USA" if country_code == "USA" else "EUR"

            TournamentEntry.objects.create(
                tournament=t,
                golfer=None,
                display_name=h.get("name", "").strip(),
                is_human=True,
                country=country_code,
                team=team,
                handedness=h.get("handedness", "R") or "R",
                avatar_color=h.get("avatar_color", "") or "",
            )


        # group them into foursomes (v1)
        # Round 1: Randomize order for realistic PGA-style draw, but keep humans together
        import random
        
        all_entries = list(t.entries.all())
        entries_ordered = []
        group_size = 4
        
        if t.format == 'match':
            # Ryder Cup Style Pairing:
            usa = [e for e in all_entries if e.team == 'USA']
            eur = [e for e in all_entries if e.team != 'USA']
            
            # Sort by ID to ensure alignment
            usa.sort(key=lambda x: x.id)
            eur.sort(key=lambda x: x.id)
            
            pairs = []
            
            if is_fourball:
                # Group of 4: USA1, USA2, EUR1, EUR2
                # We need pairs of USA vs pairs of EUR
                group_size = 4
                
                # We assume balanced teams divisible by 2 for fourball?
                # If 12 vs 12, we make 6 groups of 4.
                
                # Pair them up
                for i in range(0, max(len(usa), len(eur)), 2):
                    # add usa pair
                    if i < len(usa): pairs.append(usa[i])
                    if i+1 < len(usa): pairs.append(usa[i+1])
                    
                    # add eur pair
                    if i < len(eur): pairs.append(eur[i])
                    if i+1 < len(eur): pairs.append(eur[i+1])
            else:
                # Singles: USA1, EUR1
                group_size = 2 
                max_len = max(len(usa), len(eur))
                for i in range(max_len):
                    if i < len(usa): pairs.append(usa[i])
                    if i < len(eur): pairs.append(eur[i])
            
            entries_ordered = pairs
            
        else:
            # Standard Stroke Play Logic
            humans = [e for e in all_entries if e.is_human]
            bots = [e for e in all_entries if not e.is_human]
            
            # Shuffle bots for randomness
            bot_list = list(bots)
            random.shuffle(bot_list)
            
            # Insert human group at a random position in the field
            if humans:
                total_groups = (len(bot_list) + len(humans) + 3) // 4
                human_position = random.randint(total_groups // 3, 2 * total_groups // 3)
                insertion_point = human_position * 4
                entries_ordered = bot_list[:insertion_point] + list(humans) + bot_list[insertion_point:]
            else:
                entries_ordered = bot_list
        
        groups_count = (len(entries_ordered) + group_size - 1) // group_size

        # Split tees: alternate between tee 1 and tee 10 so they're interleaved
        # This effectively doubles capacity - groups go off both tees simultaneously
        for gi, i in enumerate(range(0, len(entries_ordered), group_size)):
            # Alternate tees: even groups on 1, odd on 10 (Only for Stroke Play usually)
            # For Match Play, typically everyone goes off 1.
            if t.format == 'match':
                start_hole = 1
                # Sequential tee times
                time_slot = gi
            else:
                start_hole = 1 if gi % 2 == 0 else 10
                time_slot = gi // 2
            
            tee_time = start_time + timezone.timedelta(
                minutes=tee_interval_minutes * time_slot
            )
            g = Group.objects.create(
                tournament=t,
                tee_time=tee_time,
                start_hole=start_hole,
                current_hole=start_hole,
                holes_completed=0,
                next_action_time=tee_time,
            )

            for e in entries_ordered[i : i + group_size]:
                GroupMember.objects.create(group=g, entry=e)
        return t
