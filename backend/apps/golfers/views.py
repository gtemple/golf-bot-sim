from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.golfers.models import Golfer
from apps.golfers.serializers import GolferSerializer
from apps.golfers.services.ratings import update_ratings_from_csv


class GolferViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Golfer.objects.all().order_by("name")
    serializer_class = GolferSerializer

    @action(detail=False, methods=['post'])
    def refresh_ratings(self, request):
        count = update_ratings_from_csv()
        return Response({"status": "ok", "golfers_updated": count})
