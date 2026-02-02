from rest_framework.routers import DefaultRouter
from apps.tournaments.views import TournamentViewSet, HistoryViewSet, SeasonViewSet

router = DefaultRouter()
router.register(r"tournaments", TournamentViewSet, basename="tournament")
router.register(r"history", HistoryViewSet, basename="history")
router.register(r"seasons", SeasonViewSet, basename="season")

urlpatterns = router.urls
