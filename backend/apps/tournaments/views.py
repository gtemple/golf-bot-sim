from django.db import models
from django.db.models import Sum, Q, Value, IntegerField
from django.db.models.functions import Coalesce
from django.utils import timezone

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.courses.models import Hole
from apps.tournaments.models import Tournament, HoleResult
from apps.tournaments.serializers import TournamentSerializer, TournamentCreateSerializer
from apps.tournaments.services.pace import minutes_for_hole
from apps.tournaments.services.routing import next_hole
from apps.tournaments.services.scoring import simulate_strokes_for_entry


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
        if tournament.cut_applied and tournament.current_round >= 3:
            entries_qs = entries_qs.filter(cut=False)

        # ordering
        if leaders_last:
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

        if humans and leaders_last:
            # For rounds 3-4, insert human group based on best human's score
            best_human_score = min(h.prior_total for h in humans) if humans else 10_000
            
            # Find insertion point: where this score would place them among bots
            insertion_idx = 0
            for i, bot in enumerate(bots):
                if bot.prior_total < best_human_score:
                    insertion_idx = i + 1
                else:
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
                print(f"DEBUG: Group {group.id} hasn't started: tee_time={group.tee_time} > current={tournament.current_time}")
                continue

            # advance while we have time to complete the next hole
            print(f"DEBUG: Group {group.id} check: next_action={group.next_action_time} vs current={tournament.current_time}, holes_completed={group.holes_completed}")
            while (not group.is_finished) and (group.next_action_time <= tournament.current_time):
                hole_num = next_hole(group.start_hole, group.holes_completed)
                print(f"DEBUG: Group {group.id} advancing to hole {hole_num}, currently completed {group.holes_completed}")
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

        # rollover + cut
        all_finished = tournament.groups.filter(is_finished=False).count() == 0
        if all_finished:
            if tournament.current_round == 2 and not tournament.cut_applied:
                self._apply_cut(tournament)

            if tournament.current_round < 4:
                tournament.current_round += 1
                tournament.save(update_fields=["current_round"])

                if tournament.current_round <= 2:
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
                tournament.status = "finished"
                tournament.save(update_fields=["status"])

        # re-fetch to avoid stale prefetch caches after reseeding
        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament).data)

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
