from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum

from apps.tournaments.models import (
    Tournament,
    TournamentEntry,
    Group,
    GroupMember,
    HoleResult,
)
from apps.courses.models import Course
from apps.golfers.models import Golfer


class HoleResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = HoleResult
        fields = ["round_number", "hole_number", "strokes"]


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

    class Meta:
        model = Tournament
        fields = [
            "id",
            "name",
            "course",
            "status",
            "start_time",
            "current_time",
            "current_round",
            "cut_size",
            "cut_applied",
            "projected_cut",
            "entries",
            "groups",
        ]
    
    def get_projected_cut(self, obj):
        """
        Calculate projected cut line during R1 and R2 (before cut is applied).
        Returns dict with cut_score and position info, or None if not applicable.
        """
        # Only show projected cut during rounds 1-2, before cut is applied
        if obj.current_round > 2 or obj.cut_applied:
            return None
        
        # Need at least some completed rounds to project
        entries = list(obj.entries.all())
        if not entries:
            return None
        
        # Get course par (sum of all holes)
        course_par = sum(h.par for h in obj.course.holes.all())
        
        # For projected cut, only use completed rounds
        # During R1: Use R1 scores in progress
        # During R2: Use only completed R1 scores (not partial R2)
        if obj.current_round == 1:
            # Use tournament_strokes (which is only R1 during round 1)
            comparison_par = course_par
            scored = []
            for e in entries:
                total = e.tournament_strokes if e.tournament_strokes else 0
                scored.append((e.id, total))
        else:
            # Round 2: Use only Round 1 scores
            comparison_par = course_par
            scored = []
            for e in entries:
                from apps.tournaments.models import HoleResult
                r1_total = HoleResult.objects.filter(
                    entry=e, round_number=1
                ).aggregate(total=Sum('strokes'))['total'] or 0
                scored.append((e.id, r1_total))
        
        # Sort by score
        scored.sort(key=lambda x: (x[1], x[0]))
        
        cut_size = obj.cut_size or 65
        if len(scored) <= cut_size:
            return None  # No cut needed
        
        # Find the cut score (top cut_size + ties)
        cut_score = scored[cut_size - 1][1]
        
        # Count how many are at or better than cut score
        at_cut_line = sum(1 for _, score in scored if score == cut_score)
        inside_cut = sum(1 for _, score in scored if score < cut_score)
        
        # Convert to relative to par
        cut_to_par = cut_score - comparison_par
        
        return {
            "cut_score": cut_score,
            "cut_to_par": cut_to_par,
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
            
            if field_type == 'top_ranked':
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
                TournamentEntry.objects.create(
                    tournament=t, golfer=g, display_name=g.name, is_human=False
                )

        for h in validated_data.get("humans", []):
            country_code = (h.get("country", "") or "")[:3]  # Ensure max 3 chars
            TournamentEntry.objects.create(
                tournament=t,
                golfer=None,
                display_name=h.get("name", "").strip(),
                is_human=True,
                country=country_code,
                handedness=h.get("handedness", "R") or "R",
                avatar_color=h.get("avatar_color", "") or "",
            )


        # group them into foursomes (v1)
        # Round 1: Randomize order for realistic PGA-style draw, but keep humans together
        import random
        
        humans = [e for e in t.entries.all() if e.is_human]
        bots = [e for e in t.entries.all() if not e.is_human]
        
        # Shuffle bots for randomness
        bot_list = list(bots)
        random.shuffle(bot_list)
        
        # Insert human group at a random position in the field
        if humans:
            total_groups = (len(bot_list) + len(humans) + 3) // 4  # Estimate total groups
            # Place humans somewhere in the middle third of the field (realistic)
            human_position = random.randint(total_groups // 3, 2 * total_groups // 3)
            insertion_point = human_position * 4
            entries = bot_list[:insertion_point] + list(humans) + bot_list[insertion_point:]
        else:
            entries = bot_list
        
        group_size = 4
        groups_count = (len(entries) + group_size - 1) // group_size

        # Split tees: alternate between tee 1 and tee 10 so they're interleaved
        # This effectively doubles capacity - groups go off both tees simultaneously
        for gi, i in enumerate(range(0, len(entries), group_size)):
            # Alternate tees: even groups on 1, odd on 10
            start_hole = 1 if gi % 2 == 0 else 10
            
            # Calculate tee time: since we're using 2 tees, each tee gets half the groups
            # So we only increment time every 2 groups
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

            for e in entries[i : i + group_size]:
                GroupMember.objects.create(group=g, entry=e)
        return t
