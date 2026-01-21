from rest_framework import serializers
from apps.courses.models import Course, Hole, TeeBox


class TeeBoxSerializer(serializers.ModelSerializer):
    class Meta:
        model = TeeBox
        fields = ["id", "name", "color", "yardage", "rating", "slope"]


class HoleSerializer(serializers.ModelSerializer):
    tee_boxes = TeeBoxSerializer(many=True, read_only=True)

    class Meta:
        model = Hole
        fields = [
            "id",
            "number",
            "par",
            "stroke_index",
            "elevation_change",
            "dogleg",
            "fairway_width",
            "green_size",
            "green_slope",
            "bunker_count",
            "water_in_play",
            "trees_in_play",
            "tee_boxes",
        ]


class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            "id",
            "name",
            "location",
            "difficulty_rating",
            "greens_speed",
            "fairway_firmness",
            "rough_severity",
        ]


class CourseDetailSerializer(CourseSerializer):
    holes = HoleSerializer(many=True, read_only=True)

    class Meta(CourseSerializer.Meta):
        fields = CourseSerializer.Meta.fields + ["holes"]
