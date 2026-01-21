from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from django.db import models
from django.db.models import Sum
from django.utils import timezone

from apps.courses.models import Hole
from apps.tournaments.models import Tournament, HoleResult
from apps.tournaments.serializers import TournamentSerializer, TournamentCreateSerializer
from apps.tournaments.services.pace import minutes_for_hole
from apps.tournaments.services.routing import next_hole
from apps.tournaments.services.scoring import simulate_strokes_for_entry


class TournamentViewSet(viewsets.ModelViewSet):
    queryset = Tournament.objects.all().prefetch_related(
        "entries",
        "groups__members__entry",
        "groups__members__entry__golfer",
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
        Uses tournament_strokes as the ordering.
        """
        entries = list(tournament.entries.order_by("tournament_strokes", "id"))
        last_score = None
        rank = 0
        for i, e in enumerate(entries, start=1):
            if last_score is None or e.tournament_strokes != last_score:
                rank = i
                last_score = e.tournament_strokes
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
        - R1/R2: foursomes, split tees (1/10). R2 should invert_split=True to swap waves.
        - R3/R4: twosomes, single tee (1), leaders_last=True.
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

        # order for pairing
        # - weekday: stable by id (or keep by tournament_strokes if you want)
        # - weekend leaders_last: best go last
        if leaders_last:
            entries = list(entries_qs.order_by("tournament_strokes", "id"))
            entries = list(reversed(entries))
        else:
            entries = list(entries_qs.order_by("id"))

        groups_count = (len(entries) + group_size - 1) // group_size
        split_point = (groups_count + 1) // 2

        for gi, i in enumerate(range(0, len(entries), group_size)):
            # Determine tee (and wave) per-group
            if split_tees:
                is_wave1 = gi < split_point
                start_hole = 1 if is_wave1 else 10
                if invert_split:
                    start_hole = 10 if start_hole == 1 else 1
                wave = 1 if is_wave1 else 2
            else:
                start_hole = 1
                wave = 1

            tee_time = start_time + timezone.timedelta(minutes=tee_interval_minutes * gi)

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

            for e in entries[i : i + group_size]:
                GroupMember.objects.create(group=g, entry=e)

        # reset per-round display fields for the new round
        tournament.entries.update(thru_hole=0, total_strokes=0)

    def _apply_cut(self, tournament: Tournament):
        """
        Apply cut after round 2: top 65 + ties (based on rounds 1+2).
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
            entry.cut = total > cut_score
            entry.save(update_fields=["cut"])

        tournament.cut_applied = True
        tournament.save(update_fields=["cut_applied"])

    def _update_entry_totals(self, entry, round_number: int):
        """
        Updates:
        - thru_hole (already set by caller)
        - total_strokes for the round
        - tournament_strokes cumulative across all rounds
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

    @action(detail=True, methods=["post"])
    def tick(self, request, pk=None):
        tournament = self.get_object()
        minutes = int(request.data.get("minutes", 11))

        # advance tournament clock
        tournament.current_time = tournament.current_time + timezone.timedelta(minutes=minutes)
        tournament.status = "in_progress"
        tournament.save(update_fields=["current_time", "status"])

        course_holes = {h.number: h for h in Hole.objects.filter(course=tournament.course).all()}

        for group in tournament.groups.all():
            if group.is_finished:
                continue

            if group.next_action_time is None:
                group.next_action_time = group.tee_time

            if group.tee_time > tournament.current_time:
                continue

            while (not group.is_finished) and (group.next_action_time <= tournament.current_time):
                hole_num = next_hole(group.start_hole, group.holes_completed)
                hole = course_holes.get(hole_num)
                if not hole:
                    group.is_finished = True
                    break

                members = list(group.members.all())
                group_size = len(members) or 4
                duration = minutes_for_hole(hole.par, group_size=group_size)

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
                            "strokes": simulate_strokes_for_entry(entry, hole, tournament.current_round)
                        },
                    )

                # recompute totals for group entries (humans will only count holes they've entered)
                for gm in members:
                    entry = gm.entry
                    entry.thru_hole = max(entry.thru_hole, hole_num)
                    self._update_entry_totals(entry, tournament.current_round)

                # advance group progress
                group.holes_completed += 1
                if group.holes_completed >= 18:
                    group.is_finished = True
                else:
                    group.current_hole = next_hole(group.start_hole, group.holes_completed)

                group.next_action_time = group.next_action_time + timezone.timedelta(minutes=duration)

            group.save(update_fields=["current_hole", "holes_completed", "next_action_time", "is_finished"])

        # update positions on every tick
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
                    # round 2 flips tee waves
                    invert = (tournament.current_round == 2)
                    self._reseed_groups(
                        tournament,
                        split_tees=True,
                        group_size=4,
                        invert_split=invert,
                    )
                else:
                    # weekend: single tee, twosomes, leaders last
                    self._reseed_groups(
                        tournament,
                        split_tees=False,
                        group_size=2,
                        leaders_last=True,
                    )
            else:
                tournament.status = "finished"
                tournament.save(update_fields=["status"])

        # re-fetch to avoid stale prefetch caches after reseeding
        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament).data)

    @action(detail=True, methods=["post"], url_path="hole-result")
    def hole_result(self, request, pk=None):
        tournament = self.get_object()
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

        entry.thru_hole = max(entry.thru_hole, hole_number)
        self._update_entry_totals(entry, round_number)

        self._recompute_positions(tournament)

        tournament = self.get_queryset().get(pk=tournament.pk)
        return Response(TournamentSerializer(tournament).data)
