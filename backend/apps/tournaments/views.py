from django.db import models
from django.db.models import Sum, Q, Value, IntegerField
from django.db.models.functions import Coalesce
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.courses.models import Hole
from apps.tournaments.models import Tournament, HoleResult, TournamentEvent
from apps.tournaments.serializers import TournamentSerializer, TournamentCreateSerializer
from apps.tournaments.services.pace import minutes_for_hole
from apps.tournaments.services.routing import next_hole
from apps.tournaments.services.scoring import simulate_strokes_for_entry, simulate_strokes_for_entry_with_stats


class TournamentViewSet(viewsets.ModelViewSet):
    queryset = (
        Tournament.objects.all()
        .prefetch_related(
            "entries",
            "entries__hole_results",
            "groups",
            "groups__members",
            "groups__members__entry",
            "groups__members__entry__golfer",
            "groups__members__entry__hole_results", # Ensure stats are loaded for sidebar
        )
    )
    serializer_class = TournamentSerializer

    def get_serializer_class(self):
        if self.action == "create":
            return TournamentCreateSerializer
        return TournamentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tournament = serializer.save()
        return Response(TournamentSerializer(tournament).data, status=status.HTTP_201_CREATED)

    def _archive_match_results(self, tournament):
        """
        Calculate results for all groups in the current round and store in session_history.
        """
        # Load course pars
        holes_map = {h.number: h for h in Hole.objects.filter(course=tournament.course)}
        
        results = []
        
        for group in tournament.groups.all():
            members = list(group.members.all())
            if not members:
                continue
            
            # Identify teams
            # In Four-Ball (4 members): 2 USA, 2 EUR
            # In Singles (2 members): 1 USA, 1 EUR
            
            # Prefetched entries might not return hole_results properly if generic prefetch
            # But we added it in queryset
            
            usa_entries = [m.entry for m in members if m.entry.team == 'USA']
            eur_entries = [m.entry for m in members if m.entry.team != 'USA']
            
            if not usa_entries or not eur_entries:
                continue
                
            # Calculate match outcome
            usa_holes = 0
            eur_holes = 0
            
            # Helper to get best score for a side on a hole
            def get_best_score(entries, hole_num):
                best = 999
                # Need to fetch hole result from DB or via prefetch
                scores = []
                for e in entries:
                     # Access pre-fetched hole_results (filtered by round?? No, contains all)
                     # We need to filter manually in Python
                     hr = next((r for r in e.hole_results.all() if r.hole_number == hole_num and r.round_number == tournament.current_round), None)
                     if hr:
                         scores.append(hr.strokes)
                return min(scores) if scores else None

            processed_holes = 0
            # Iterate 1..18
            for h_num in range(1, 19):
                s1 = get_best_score(usa_entries, h_num)
                s2 = get_best_score(eur_entries, h_num)
                
                if s1 is not None and s2 is not None:
                    processed_holes += 1
                    if s1 < s2: usa_holes += 1
                    elif s2 < s1: eur_holes += 1
            
            winner = 'Halved'
            score_display = 'Halved'
            margin = abs(usa_holes - eur_holes)
            
            # Determine winner
            if usa_holes > eur_holes:
                winner = 'USA'
            elif eur_holes > usa_holes:
                winner = 'EUR'
                
            if margin > 0:
                 score_display = f"{margin} UP"
            
            results.append({
                "group_id": group.id,
                "winner": winner,
                "margin": margin,
                "score": score_display,
                "usa_names": [e.display_name for e in usa_entries],
                "eur_names": [e.display_name for e in eur_entries]
            })
            
        history = tournament.session_history or {}
        history[f"R{tournament.current_round}"] = results
        tournament.session_history = history
        tournament.save(update_fields=["session_history"])

    def _recompute_positions(self, tournament: Tournament):
        """
        Set entry.position with ties sharing the same rank.
        Uses tournament_strokes as ordering (lowest is best).
        """
        entries = list(tournament.entries.order_by("tournament_strokes", "id"))
        last_score = None
        rank = 0
        for i, e in enumerate(entries, start=1):
            score = getattr(e, "tournament_strokes", None)
            if last_score is None or score != last_score:
                rank = i
                last_score = score
            e.position = rank
            e.save(update_fields=["position"])

    def _reseed_groups(
        self,
        tournament: Tournament,
        *,
        split_tees: bool,
        group_size: int,
        leaders_last: bool = False,
        invert_split: bool = False,
        tee_interval_minutes: int = 11,
        playoff: bool = False,
    ):
        """
        Recreate groups for the current round.

        Custom sim rules:
        - Humans are packed together as much as possible.
        - If humans require multiple groups, all human-containing groups get the SAME tee time.

        PGA-ish defaults:
        - R1/R2: foursomes, split tees 1/10, invert waves in R2
        - R3/R4: twosomes, single tee 1, reseed by score so leaders go last
        """
        from apps.tournaments.models import Group, GroupMember

        # wipe old groups/members
        GroupMember.objects.filter(group__tournament=tournament).delete()
        Group.objects.filter(tournament=tournament).delete()

        start_time = tournament.current_time

        # choose field
        entries_qs = tournament.entries.all()
        
        if playoff:
            # Only include tied leaders
            entries_qs = entries_qs.filter(position=1)
        elif tournament.cut_applied and tournament.current_round >= 3:
            entries_qs = entries_qs.filter(cut=False)

        # ordering

        if invert_split:
            # Sort by PRIOR rounds cumulative strokes: worst first => earliest tee, best last => leaders last.
            prior_total = Coalesce(
                Sum(
                    "hole_results__strokes",
                    filter=Q(hole_results__round_number__lt=tournament.current_round),
                ),
                Value(10_000),
                output_field=IntegerField(),
            )
            entries = list(
                entries_qs.annotate(prior_total=prior_total).order_by("-prior_total", "id")
            )
        elif tournament.format == 'match':
             # Match Play Logic
             all_entries = list(entries_qs)
             usa = [e for e in all_entries if e.team == 'USA']
             eur = [e for e in all_entries if e.team != 'USA']
             
             # Shuffle for random pairing
             import random
             random.shuffle(usa)
             random.shuffle(eur)
             
             pairs = []
             # If group_size is 4, we need 2 USA / 2 EUR
             # If group_size is 2, we need 1 USA / 1 EUR
             
             if group_size == 4:
                 for i in range(0, max(len(usa), len(eur)), 2):
                    if i < len(usa): pairs.append(usa[i])
                    if i+1 < len(usa): pairs.append(usa[i+1])
                    if i < len(eur): pairs.append(eur[i])
                    if i+1 < len(eur): pairs.append(eur[i+1])
             else:
                 max_len = max(len(usa), len(eur))
                 for i in range(max_len):
                    if i < len(usa): pairs.append(usa[i])
                    if i < len(eur): pairs.append(eur[i])
             
             entries = pairs
        elif leaders_last:
            # Sort by PRIOR rounds cumulative strokes: worst first => earliest tee, best last => leaders last.
            prior_total = Coalesce(
                Sum(
                    "hole_results__strokes",
                    filter=Q(hole_results__round_number__lt=tournament.current_round),
                ),
                Value(10_000),
                output_field=IntegerField(),
            )
            entries = list(
                entries_qs.annotate(prior_total=prior_total).order_by("-prior_total", "id")
            )
        else:
            # Early rounds: randomize for realistic PGA draw
            import random
            entries = list(entries_qs.order_by("id"))
            random.shuffle(entries)

        # pack humans together (as much as possible)
        humans = [e for e in entries if e.is_human]
        bots = [e for e in entries if not e.is_human]

        if tournament.format == 'match':
            pass
        elif humans and leaders_last:
            # For rounds 3-4, insert human group based on best human's score
            best_human_score = min(h.prior_total for h in humans) if humans else 10_000
            
            # Find insertion point: where this score would place them among bots
            # Bots are sorted Worst -> Best (High Score -> Low Score)
            # We want to insert just before the first bot who is BETTER (Lower Score) than human.
            insertion_idx = len(bots) # Default: Human is best (lowest score), goes last
            
            for i, bot in enumerate(bots):
                if bot.prior_total <= best_human_score:
                    # Found a bot with same or better score.
                    # Insert human here (before them).
                    # Since list is Worst -> Best drop-off, the first one we find <= Human
                    # is the cut-off point where Humans belong.
                    insertion_idx = i
                    break
            
            # Insert all humans at this position (keeps them together)
            entries = bots[:insertion_idx] + humans + bots[insertion_idx:]
        elif humans:
            # Round 1-2: pack humans together in their randomized order
            packed = []
            idx = 0
            while idx < len(humans):
                chunk = humans[idx : idx + group_size]
                idx += group_size
                fill = group_size - len(chunk)
                if fill > 0 and bots:
                    chunk.extend(bots[:fill])
                    bots = bots[fill:]
                packed.extend(chunk)
            packed.extend(bots)
            entries = packed
        else:
            entries = bots

        groups_count = (len(entries) + group_size - 1) // group_size

        human_groups = []

        for gi, i in enumerate(range(0, len(entries), group_size)):
            group_entries = entries[i : i + group_size]

            if split_tees:
                # Alternate tees: even groups on tee 1, odd on tee 10
                # This interleaves the tees so both are used simultaneously
                start_hole = 1 if gi % 2 == 0 else 10
                if invert_split:
                    start_hole = 10 if start_hole == 1 else 1
                wave = 1 if gi % 2 == 0 else 2
            else:
                start_hole = 1
                wave = 1

            # When using split tees, time only advances every 2 groups (one per tee)
            time_slot = gi // 2 if split_tees else gi
            tee_time = start_time + timezone.timedelta(minutes=tee_interval_minutes * time_slot)

            g = Group.objects.create(
                tournament=tournament,
                tee_time=tee_time,
                wave=wave,
                start_hole=start_hole,
                current_hole=start_hole,
                holes_completed=0,
                next_action_time=tee_time,
                is_finished=False,
            )

            for e in group_entries:
                GroupMember.objects.create(group=g, entry=e)

            if any(e.is_human for e in group_entries):
                human_groups.append(g)

        # enforce same tee time for ALL human groups
        if len(human_groups) > 1:
            common_time = min(g.tee_time for g in human_groups)
            for g in human_groups:
                if g.tee_time != common_time or g.next_action_time != common_time:
                    g.tee_time = common_time
                    g.next_action_time = common_time
                    g.save(update_fields=["tee_time", "next_action_time"])

        # reset per-round display fields for the new round
        tournament.entries.update(thru_hole=0, total_strokes=0, position=None)

    def _apply_cut(self, tournament: Tournament):
        """
        Apply cut after round 2: top 65 + ties (based on rounds 1+2 strokes).
        """
        totals = (
            tournament.entries.annotate(
                r12_total=Sum(
                    "hole_results__strokes",
                    filter=models.Q(hole_results__round_number__in=[1, 2]),
                )
            )
            .order_by("r12_total", "id")
        )

        scored = []
        for e in totals:
            scored.append((e, e.r12_total if e.r12_total is not None else 10_000))
        scored.sort(key=lambda x: (x[1], x[0].id))

        cut_size = tournament.cut_size or 65
        if len(scored) <= cut_size:
            tournament.cut_applied = True
            tournament.save(update_fields=["cut_applied"])
            return

        cut_score = scored[cut_size - 1][1]

        for entry, total in scored:
            # Never cut human players
            if entry.is_human:
                entry.cut = False
            else:
                entry.cut = total > cut_score
            entry.save(update_fields=["cut"])

        tournament.cut_applied = True
        tournament.save(update_fields=["cut_applied"])

    def _update_projected_cut(self, tournament: Tournament):
        """
        Calculates the projected cut score (Top 65 & ties) based on current live scores.
        Only valid for R1 & R2.
        """
        if tournament.current_round > 2:
            return

        # We need the "Total Score" relative to par effectively.
        # But wait, raw strokes depends on how many holes played.
        # "Score to Par" is the universal metric.
        # But we don't store "Score to Par" on the entry directly, we calculate it.
        # Actually, tournament_strokes is just sum of strokes. 
        # Comparing raw strokes is unfair if someone played 9 holes vs 18 holes.
        # So we MUST calculate Score To Par for everyone.
        
        # Optimization: Score To Par = Total Strokes - (Par of holes completed)
        # We can calculate this.
        
        entries = list(tournament.entries.all())
        scores = []
        
        # Get all hole pars once
        holes = Hole.objects.filter(course=tournament.course).order_by('number')
        par_map = {h.number: h.par for h in holes}
        
        # Prefetch hole results for efficiency? 
        # They are already in tournament.entries via prefetch in ViewSet, 
        # but that might be stale in 'tick'.
        # Let's rely on tournament_strokes from _recompute_positions?
        # tournament_strokes has total strokes.
        # We need total par for holes played.
        
        # This is expensive to do every tick for 150 players.
        # Let's do a simplified version or just iterate.
        # 150 iterations is nothing for Python.
        
        for entry in entries:
            # Get holes played count: this is hard because 'thru_hole' is per round.
            # We need all holes played across all rounds.
            # Simpler: We know in R1 everyone played 'thru_hole' holes.
            # in R2 everyone played 18 (R1) + 'thru_hole' (R2).
            
            # Actually, `tournament_strokes` is reliable `sum(strokes)`.
            # We just need `sum(par)` for those specific holes.
            
            # Calculate Total Par so far
            # How do we know EXACTLY which holes they played?
            # We assume order 1..18.
            # R1: holes 1..thru_hole
            # R2: 1..18 (R1) + 1..thru_hole (R2)
            
            # Caveat: Split tees start at 10.
            # If start at 10, played 10,11,12...
            # This logic gets complex with split tees.
            
            # Alternative: Projected Cut is usually based on "End of Round 2".
            # If I am +2 thru 9, I am projected +2.
            # So "Score to Par" is correct.
            
            # To get Score To Par correctly without complex par summing:
            # We can aggregate from HoleResult stats if we stored 'par' there. We don't.
            # But we can query HoleResult count? No.
            
            # Let's assume standard pars for now (Par 72).
            # No, that's wrong.
            
            # Correct approach:
            # Calculate score_to_par for each entry.
            # entry.score_to_par property?
            pass
            
            # Let's check if we have a helper for this.
            # We don't.
            # Let's just calculate it.
            
            total_strokes = entry.tournament_strokes
            
            # Calculate par for holes played
            # This requires knowing WHICH holes.
            # We can fetch all HoleResults for this entry.
            results = entry.hole_results.all() # Prefitched?
            
            # If we blindly trust prefetch:
            total_par = 0
            for hr in results:
                # We need par of hr.hole_number
                p = par_map.get(hr.hole_number, 4)
                total_par += p
            
            score_to_par = total_strokes - total_par
            scores.append(score_to_par)
            
        scores.sort()
        
        # Top 65 (index 64)
        cut_size = tournament.cut_size or 65
        if len(scores) > cut_size:
            projected_cut = scores[cut_size - 1]
            tournament.projected_cut_score = projected_cut
            tournament.save(update_fields=["projected_cut_score"])


    def _update_entry_totals(self, entry, round_number: int):
        """
        Updates:
        - total_strokes for the given round
        - tournament_strokes cumulative across all rounds
        Does NOT blindly advance thru_hole (caller decides that).
        """
        entry.total_strokes = (
            HoleResult.objects.filter(entry=entry, round_number=round_number)
            .aggregate(models.Sum("strokes"))["strokes__sum"]
            or 0
        )
        entry.tournament_strokes = (
            HoleResult.objects.filter(entry=entry)
            .aggregate(models.Sum("strokes"))["strokes__sum"]
            or 0
        )
        entry.save(update_fields=["total_strokes", "tournament_strokes", "thru_hole"])

    @action(detail=True, methods=["post"], url_path="sim-to-end-of-day")
    def sim_to_end_of_day(self, request, pk=None):
        """
        Advances tournament time until all groups have finished the current round.
        """
        tournament = self.get_queryset().get(pk=pk)
        
        # Keep advancing by 15 minute increments until the round rolls over
        # We detect round rollover by checking if current_round changes
        start_round = tournament.current_round
        
        # Should finish within reasonable time, but add safety break
        safety = 0
        while tournament.current_round == start_round and safety < 1000:
            # Check if all groups are finished
            unfinished = tournament.groups.filter(is_finished=False).count()
            if unfinished == 0:
                # If all groups are finished but round didn't increment, 
                # we need to trigger one more tick to process rollover/reseed
                # Create a simple mock request object if needed or just call logic
                # For simplicity, we just use a large tick to force completion
                request.data["minutes"] = 10
                self.tick(request, pk=pk)
                break
                
            # If there are groups still playing, advance time
            # Using the tick logic via internal call would be cleanest but tick returns Response.
            # We can just simulate the tick call.
            request.data["minutes"] = 15
            self.tick(request, pk=pk)
            tournament.refresh_from_db()
            
            if tournament.status == "finished":
                break
                
            safety += 1
            
        return Response(TournamentSerializer(tournament).data)

    @action(detail=True, methods=["post"], url_path="sim-to-tee")
    def sim_to_tee(self, request, pk=None):
        """
        Advances tournament time to the human group's tee time,
        simulating all bot play up to that point.
        """
        tournament = self.get_queryset().get(pk=pk)
        
        # Find the human group
        human_group = None
        for group in tournament.groups.all():
            if any(gm.entry.is_human for gm in group.members.all()):
                human_group = group
                break
        
        if not human_group:
            return Response({"error": "No human group found"}, status=status.HTTP_400_BAD_REQUEST)
        
        if human_group.tee_time <= tournament.current_time:
            # Already at or past tee time
            tournament = self.get_queryset().get(pk=tournament.pk)
            return Response(TournamentSerializer(tournament).data)
        
        # Calculate minutes to advance
        time_diff = human_group.tee_time - tournament.current_time
        minutes_to_advance = int(time_diff.total_seconds() / 60) + 1  # +1 to ensure we're past it
        
        # Directly call the tick logic with calculated minutes
        tournament.current_time = tournament.current_time + timezone.timedelta(minutes=minutes_to_advance)
        tournament.status = "in_progress"
        tournament.save(update_fields=["current_time", "status"])

        # Process all groups (same logic as tick)
        course_holes = {
            h.number: h for h in Hole.objects.filter(course=tournament.course).all()
        }

        for group in tournament.groups.all():
            if group.is_finished:
                continue

            if group.next_action_time is None:
                group.next_action_time = group.tee_time

            # group hasn't started yet
            if group.tee_time > tournament.current_time:
                continue

            # advance while we have time to complete the next hole
            while (not group.is_finished) and (group.next_action_time <= tournament.current_time):
                hole_num = next_hole(group.start_hole, group.holes_completed)
                hole = course_holes.get(hole_num)
                if not hole:
                    group.is_finished = True
                    break

                members = list(group.members.all())
                group_size = len(members) or 4
                duration = minutes_for_hole(hole.par, group_size=group_size)

                # Fix for "instant first hole": The first hole finishes at tee_time + duration, not tee_time.
                if group.holes_completed == 0 and group.tee_time == group.next_action_time:
                    completion_time = group.tee_time + timezone.timedelta(minutes=duration)
                    if completion_time > tournament.current_time:
                        # We are mid-hole (or just starting). 
                        # Update next_action_time so we resume at the correct completion time.
                        group.next_action_time = completion_time
                        group.save(update_fields=["next_action_time"])
                        break

                # bot hole results
                for gm in members:
                    entry = gm.entry
                    if entry.is_human or entry.golfer_id is None:
                        continue

                    HoleResult.objects.get_or_create(
                        entry=entry,
                        round_number=tournament.current_round,
                        hole_number=hole_num,
                        defaults={
                            "strokes": simulate_strokes_for_entry(
                                entry, hole, tournament.current_round
                            )
                        },
                    )

                # recompute totals for entries in this group
                for gm in members:
                    entry = gm.entry

                    if entry.is_human:
                        has_result = HoleResult.objects.filter(
                            entry=entry,
                            round_number=tournament.current_round,
                            hole_number=hole_num,
                        ).exists()

                        if has_result:
                            entry.thru_hole = max(entry.thru_hole, hole_num)
                        self._update_entry_totals(entry, tournament.current_round)
                        continue

                    # bot
                    entry.thru_hole = max(entry.thru_hole, hole_num)
                    self._update_entry_totals(entry, tournament.current_round)

                # advance group progress
                group.holes_completed += 1
                if group.holes_completed >= 18:
                    group.is_finished = True
                else:
                    group.current_hole = next_hole(group.start_hole, group.holes_completed)

                group.next_action_time = group.next_action_time + timezone.timedelta(minutes=duration)

                # If this group has human players, only process one hole per tick
                has_humans = any(gm.entry.is_human for gm in members)
                if has_humans:
                    break

            group.save(update_fields=["current_hole", "holes_completed", "next_action_time", "is_finished"])

        # update positions
        self._recompute_positions(tournament)

        # re-fetch with prefetch
        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament).data)

    @action(detail=True, methods=["post"])
    def tick(self, request, pk=None):
        # Use prefetched queryset explicitly to avoid N+1 surprises
        tournament = self.get_queryset().get(pk=pk)

        minutes = int(request.data.get("minutes", 11))

        # advance tournament clock
        tournament.current_time = tournament.current_time + timezone.timedelta(minutes=minutes)
        tournament.status = "in_progress"
        tournament.save(update_fields=["current_time", "status"])

        course_holes = {
            h.number: h for h in Hole.objects.filter(course=tournament.course).all()
        }

        for group in tournament.groups.all():
            if group.is_finished:
                continue

            if group.next_action_time is None:
                group.next_action_time = group.tee_time

            # group hasn't started yet
            if group.tee_time > tournament.current_time:
                continue

            # advance while we have time to complete the next hole
            while (not group.is_finished) and (group.next_action_time <= tournament.current_time):
                hole_num = next_hole(group.start_hole, group.holes_completed)
                hole = course_holes.get(hole_num)
                if not hole:
                    group.is_finished = True
                    break

                members = list(group.members.all())
                group_size = len(members) or 4
                duration = minutes_for_hole(hole.par, group_size=group_size)

                # Fix for "instant first hole": The first hole finishes at tee_time + duration, not tee_time.
                if group.holes_completed == 0 and group.tee_time == group.next_action_time:
                    completion_time = group.tee_time + timezone.timedelta(minutes=duration)
                    if completion_time > tournament.current_time:
                        # We are mid-hole (or just starting). 
                        # Update next_action_time so we resume at the correct completion time.
                        group.next_action_time = completion_time
                        group.save(update_fields=["next_action_time"])
                        break

                # bot hole results
                for gm in members:
                    entry = gm.entry
                    if entry.is_human or entry.golfer_id is None:
                        continue

                    # Simulate strokes and stats
                    strokes, stats = simulate_strokes_for_entry_with_stats(
                        entry, hole, tournament.current_round
                    )
                    hr, created = HoleResult.objects.get_or_create(
                        entry=entry,
                        round_number=tournament.current_round,
                        hole_number=hole_num,
                        defaults={
                            "strokes": strokes,
                            "stats": stats
                        },
                    )
                    
                    if created:
                        # Log significant events
                        diff = strokes - hole.par
                        
                        if diff <= -1:
                            term = "Birdie" if diff == -1 else "Eagle" if diff == -2 else "Albatross"
                            text = f"{entry.display_name} made {term} on #{hole_num}."
                            imp = 2 if diff == -1 else 3
                            TournamentEvent.objects.create(
                                tournament=tournament,
                                round_number=tournament.current_round,
                                text=text,
                                importance=imp
                            )
                        elif diff >= 2:
                            term = "Double Bogey" if diff == 2 else "Triple Bogey"
                            text = f"{entry.display_name} made {term} on #{hole_num}."
                            TournamentEvent.objects.create(
                                tournament=tournament,
                                round_number=tournament.current_round,
                                text=text,
                                importance=1
                            )

                # recompute totals for entries in this group
                # IMPORTANT: humans only advance thru_hole if they actually submitted for this hole.
                for gm in members:
                    entry = gm.entry

                    if entry.is_human:
                        has_result = HoleResult.objects.filter(
                            entry=entry,
                            round_number=tournament.current_round,
                            hole_number=hole_num,
                        ).exists()

                        if has_result:
                            entry.thru_hole = max(entry.thru_hole, hole_num)
                        # Always update totals (may be unchanged)
                        self._update_entry_totals(entry, tournament.current_round)
                        continue

                    # bot
                    entry.thru_hole = max(entry.thru_hole, hole_num)
                    self._update_entry_totals(entry, tournament.current_round)

                # advance group progress
                group.holes_completed += 1
                if group.holes_completed >= 18:
                    group.is_finished = True
                else:
                    group.current_hole = next_hole(group.start_hole, group.holes_completed)

                group.next_action_time = group.next_action_time + timezone.timedelta(minutes=duration)

                # If this group has human players, only process one hole per tick
                # (humans control the pace, not the clock)
                has_humans = any(gm.entry.is_human for gm in members)
                if has_humans:
                    break

            group.save(update_fields=["current_hole", "holes_completed", "next_action_time", "is_finished"])

        # update positions after processing this tick
        self._recompute_positions(tournament)

        # update projected cut
        if tournament.current_round <= 2:
             self._update_projected_cut(tournament)

        # rollover + cut
        all_finished = tournament.groups.filter(is_finished=False).count() == 0
        if all_finished:
            
            # Archive match results if Ryder Cup
            if tournament.format == 'match':
                self._archive_match_results(tournament)
            
            if tournament.current_round == 2 and not tournament.cut_applied:
                self._apply_cut(tournament)

            if tournament.current_round < 4:
                tournament.current_round += 1
                tournament.save(update_fields=["current_round"])

                # Ryder Cup Transition Logic
                if tournament.format == 'match':
                    # Round 2: Singles (1v1)
                    if tournament.current_round == 2:
                        self._reseed_groups(
                            tournament,
                            split_tees=False, # Match play usually one tee
                            group_size=2,     # Singles
                            leaders_last=False
                        )
                    # Round 3: Singles (Final) - or just finish after 2 rounds as requested
                    elif tournament.current_round == 3:
                        # User asked for "2 day event". So if we just finished R2, we are effectively done.
                        # But loop says if current_round < 4.
                        # Let's force finish
                        tournament.status = "finished"
                        tournament.save(update_fields=["status"])
                
                elif tournament.current_round <= 2:
                    invert = (tournament.current_round == 2)
                    self._reseed_groups(
                        tournament,
                        split_tees=True,
                        group_size=4,
                        invert_split=invert,
                    )
                else:
                    self._reseed_groups(
                        tournament,
                        split_tees=False,
                        group_size=2,
                        leaders_last=True,
                    )


                # After reseed, positions were nulled; recompute based on cumulative strokes
                self._recompute_positions(tournament)

            else:
                # End of Regulation (Round 4 or Match Play end)
                # Check for Sudden Death Playoff?
                # Usually only for Stroke play
                if tournament.format == 'stroke' and tournament.current_round >= 4:
                    # Check for ties at position 1
                    winners = list(tournament.entries.filter(position=1))
                    if len(winners) > 1:
                        # Tie! Start Playoff
                        tournament.status = "playoff"
                        tournament.current_round += 1
                        tournament.save(update_fields=["status", "current_round"])
                        
                        self._reseed_groups(
                            tournament,
                            split_tees=False,
                            group_size=len(winners), # All tied players in one group (max 4 usually)
                            playoff=True
                        )
                        # Recompute to ensure positions are correct
                        self._recompute_positions(tournament)
                    else:
                        tournament.status = "finished"
                        tournament.save(update_fields=["status"])
                else:
                    tournament.status = "finished"
                    tournament.save(update_fields=["status"])

        # re-fetch to avoid stale prefetch caches after reseeding
        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament).data)

    @action(detail=True, methods=["post"], url_path="shuffle-pairings")
    def shuffle_pairings(self, request, pk=None):
        """
        Re-randomize the match pairings for a Ryder Cup style tournament.
        Only allowed if no holes have been completed.
        """
        tournament = self.get_object()
        if tournament.groups.filter(holes_completed__gt=0).exists():
            return Response(
                {"error": "Cannot shuffle pairings after play has started."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 1. Collect all entries
        entries = list(tournament.entries.all())
        
        # 2. Separate into teams
        usa = [e for e in entries if e.team == 'USA']
        eur = [e for e in entries if e.team != 'USA']
        
        # 3. Shuffle both lists
        import random
        random.shuffle(usa)
        random.shuffle(eur)
        
        # 4. Re-assign to existing groups?
        # Simpler: Delete existing groups and recreate? 
        # But groups have tee times.
        # Best: Update the GroupMembers in place.
        
        groups = list(tournament.groups.all().order_by('tee_time'))
        
        from apps.tournaments.models import GroupMember
        
        # Clear all members
        GroupMember.objects.filter(group__in=groups).delete()
        
        # Create new pairs
        # Zip them up
        max_len = max(len(usa), len(eur))
        pair_idx = 0
        
        for i in range(max_len):
            if pair_idx >= len(groups):
                break
            
            g = groups[pair_idx]
            
            p1 = usa[i] if i < len(usa) else None
            p2 = eur[i] if i < len(eur) else None
            
            if p1: GroupMember.objects.create(group=g, entry=p1)
            if p2: GroupMember.objects.create(group=g, entry=p2)
            
            pair_idx += 1
            
        return Response({"status": "shuffled"})

    @action(detail=True, methods=["post"], url_path="hole-result")
    def hole_result(self, request, pk=None):
        tournament = self.get_queryset().get(pk=pk)

        entry_id = int(request.data["entry_id"])
        hole_number = int(request.data["hole_number"])
        round_number = int(request.data.get("round_number", tournament.current_round))
        strokes = int(request.data["strokes"])

        entry = tournament.entries.get(id=entry_id)

        HoleResult.objects.update_or_create(
            entry=entry,
            round_number=round_number,
            hole_number=hole_number,
            defaults={"strokes": strokes},
        )

        # Only advance thru_hole for that entry for that round
        entry.thru_hole = max(entry.thru_hole, hole_number)
        self._update_entry_totals(entry, round_number)

        self._recompute_positions(tournament)

        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament).data)
