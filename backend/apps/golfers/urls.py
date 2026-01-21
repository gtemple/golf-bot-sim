from rest_framework.routers import DefaultRouter
from apps.golfers.views import GolferViewSet

router = DefaultRouter()
router.register(r"golfers", GolferViewSet, basename="golfer")

urlpatterns = router.urls
