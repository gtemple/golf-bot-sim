from django.urls import path, include

urlpatterns = [
    path("", include("apps.courses.urls")),
    path("", include("apps.golfers.urls")),
    path("", include("apps.tournaments.urls")),
]
