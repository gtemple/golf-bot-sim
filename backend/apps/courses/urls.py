from rest_framework.routers import DefaultRouter
from apps.courses.views import CourseViewSet

router = DefaultRouter()
router.register(r"courses", CourseViewSet, basename="course")

urlpatterns = router.urls