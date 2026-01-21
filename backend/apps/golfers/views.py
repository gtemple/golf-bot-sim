from rest_framework import viewsets
from apps.golfers.models import Golfer
from apps.golfers.serializers import GolferSerializer


class GolferViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Golfer.objects.all().order_by("name")
    serializer_class = GolferSerializer
