from django.contrib import admin
from .models import Course, Hole, TeeBox


class TeeBoxInline(admin.TabularInline):
    model = TeeBox
    extra = 0


@admin.register(Hole)
class HoleAdmin(admin.ModelAdmin):
    list_display = ("course", "number", "par", "stroke_index", "bunker_count", "water_in_play")
    list_filter = ("course", "par", "water_in_play")
    ordering = ("course", "number")
    inlines = [TeeBoxInline]


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ("name", "location", "difficulty_rating")
    search_fields = ("name", "location")
