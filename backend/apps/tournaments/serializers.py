from rest_framework import serializers
from django.utils import timezone
from django.db import transaction

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
            "entries",
            "groups",
        ]
        

class TournamentCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200)
    course_id = serializers.IntegerField()
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
        course = Course.objects.get(id=validated_data["course_id"])
        start_time = validated_data.get("start_time") or timezone.now()

        tee_interval_minutes = 11  # default PGA-ish, configurable later :contentReference[oaicite:4]{index=4}

        t = Tournament.objects.create(
            name=validated_data["name"],
            course=course,
            status="setup",
            start_time=start_time,
            current_time=start_time,
            current_round=1,
        )

        # entries
        golfer_ids = validated_data.get("golfer_ids", [])
        golfers = Golfer.objects.filter(id__in=golfer_ids)
        for g in golfers:
            TournamentEntry.objects.create(
                tournament=t, golfer=g, display_name=g.name, is_human=False
            )

        for h in validated_data.get("humans", []):
            TournamentEntry.objects.create(
                tournament=t,
                golfer=None,
                display_name=h.get("name", "").strip(),
                is_human=True,
                country=h.get("country", "") or "",
                handedness=h.get("handedness", "R") or "R",
                avatar_color=h.get("avatar_color", "") or "",
            )


        # group them into foursomes (v1)
        entries = list(t.entries.all().order_by("id"))
        group_size = 4
        groups_count = (len(entries) + group_size - 1) // group_size

        # first half start on 1, second half start on 10 (simple + PGA-ish)
        split_point = (groups_count + 1) // 2

        for gi, i in enumerate(range(0, len(entries), group_size)):
            start_hole = 1 if gi < split_point else 10

            tee_time = start_time + timezone.timedelta(
                minutes=tee_interval_minutes * gi
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
