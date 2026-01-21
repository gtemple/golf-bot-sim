from rest_framework import serializers
from apps.golfers.models import Golfer


class GolferSerializer(serializers.ModelSerializer):
    class Meta:
        model = Golfer
        fields = [
            "id",
            "name",
            "country",
            "is_active",
            "driving",
            "approach",
            "short_game",
            "putting",
            "volatility",
        ]
