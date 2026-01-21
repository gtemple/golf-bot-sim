from rest_framework import viewsets
from apps.courses.models import Course
from apps.courses.serializers import CourseSerializer, CourseDetailSerializer


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.prefetch_related("holes__tee_boxes").all()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return CourseDetailSerializer
        return CourseSerializer
