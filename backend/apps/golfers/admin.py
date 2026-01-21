from django.contrib import admin
from django.db.models import F, FloatField, ExpressionWrapper
from .models import Golfer
from django.utils.html import format_html

@admin.register(Golfer)
class GolferAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "country",
        "handedness",
        "overall_display",
        "driving_power",
        "driving_accuracy",
        "approach",
        "short_game",
        "putting",
        "consistency",
        "volatility",
        "is_active",
    )
    class Media:
        js = ("admin/golfer_overall_live.js",)
        
    search_fields = ("name", "country")
    list_filter = ("is_active", "country", "handedness")
    ordering = ("name",)

    fieldsets = (
    ("Identity", {"fields": ("name", "country", "handedness", "is_active", "overall_live")}),
        ("Core skills (0-100)", {"fields": (
            ("driving_power", "driving_accuracy"),
            ("approach", "short_game", "putting"),
        )}),
        ("Advanced skills (0-100)", {"fields": (
            ("ball_striking", "consistency"),
            ("course_management", "discipline"),
            ("sand", "clutch", "risk_tolerance"),
            ("weather_handling", "endurance"),
        )}),
        ("Variance", {"fields": ("volatility",)}),
    )

    readonly_fields = ("overall_display", "overall_live")

    @admin.display(description="Overall (live)")
    def overall_live(self, obj: Golfer):
        # Put the computed value in a span we can update with JS
        val = obj.overall if obj else 0
        return format_html(
            '<span id="overall-live" style="font-weight:600;">{}</span>',
            val,
        )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        fields = Golfer.rating_fields()
        total = sum(F(f) for f in fields)
        return qs.annotate(
            overall_db=ExpressionWrapper(total / len(fields), output_field=FloatField())
        )

    @admin.display(description="Overall", ordering="overall_db")
    def overall_display(self, obj: Golfer) -> int:
        return obj.overall
