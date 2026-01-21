from django.contrib import admin
from .models import Golfer


@admin.register(Golfer)
class GolferAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "driving", "approach", "short_game", "putting", "volatility", "is_active")
    search_fields = ("name",)
    list_filter = ("is_active", "country")
