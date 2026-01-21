from rest_framework import serializers
from apps.golfers.models import Golfer


class GolferSerializer(serializers.ModelSerializer):
    overall = serializers.IntegerField(read_only=True)

    class Meta:
        model = Golfer
        fields = [
            "id",
            "name",
            "country",
            "is_active",

            # Core skills
            "driving_power",
            "driving_accuracy",
            "approach",
            "short_game",
            "putting",

            # Advanced / realism knobs
            "ball_striking",
            "consistency",
            "course_management",
            "discipline",
            "sand",
            "clutch",
            "risk_tolerance",
            "weather_handling",
            "endurance",

            # Variance + derived
            "volatility",
            "overall",
        ]
