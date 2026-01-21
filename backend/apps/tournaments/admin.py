# apps/tournaments/admin.py

from django.contrib import admin
from django.db.models import Sum, Q
from django.utils.html import format_html
from django.utils import timezone

from .models import Tournament, TournamentEntry, Group, GroupMember, HoleResult


# ---------- Inlines ----------

class TournamentEntryInline(admin.TabularInline):
    model = TournamentEntry
    extra = 0
    fields = (
        "position",
        "display_name",
        "is_human",
        "golfer",
        "country",
        "handedness",
        "avatar_color",
        "tournament_strokes",
        "total_strokes",
        "thru_hole",
        "cut",
    )
    readonly_fields = ("position", "tournament_strokes", "total_strokes", "thru_hole", "cut")
    autocomplete_fields = ("golfer",)
    show_change_link = True


class GroupMemberInline(admin.TabularInline):
    model = GroupMember
    extra = 0
    autocomplete_fields = ("entry",)
    readonly_fields = ()
    show_change_link = False


class GroupInline(admin.TabularInline):
    model = Group
    extra = 0
    fields = ("tee_time", "wave", "start_hole", "current_hole", "holes_completed", "next_action_time", "is_finished")
    readonly_fields = ()
    show_change_link = True
    ordering = ("tee_time",)


# ---------- Admins ----------

@admin.register(Tournament)
class TournamentAdmin(admin.ModelAdmin):
    date_hierarchy = "start_time"
    list_display = (
        "id",
        "name",
        "course",
        "status",
        "current_round",
        "current_time",
        "field_size",
        "cut_line_display",
        "cut_applied",
        "created_at",
    )
    list_filter = ("status", "current_round", "cut_applied", "course")
    search_fields = ("name", "course__name")
    autocomplete_fields = ("course",)
    readonly_fields = ("created_at", "field_size", "cut_line_display", "cut_summary")
    inlines = (TournamentEntryInline, GroupInline)

    fieldsets = (
        (None, {"fields": ("name", "course", "status")}),
        ("Clock", {"fields": ("start_time", "current_time", "current_round")}),
        ("Cut", {"fields": ("cut_size", "cut_applied", "cut_line_display", "cut_summary")}),
        ("Meta", {"fields": ("created_at",)}),
    )

    def field_size(self, obj: Tournament):
        return obj.entries.count()
    field_size.short_description = "Field"

    def cut_line_display(self, obj: Tournament):
        """
        Show the 36-hole cut line (rounds 1+2) as a stroke number.
        Only meaningful once there's data; if field <= cut_size => no cut.
        """
        qs = obj.entries.all()

        # if no one played, don't show anything
        if not HoleResult.objects.filter(entry__tournament=obj, round_number__in=[1, 2]).exists():
            return "—"

        field = list(
            qs.annotate(
                r12_total=Sum(
                    "hole_results__strokes",
                    filter=Q(hole_results__round_number__in=[1, 2]),
                )
            )
        )

        scored = [(e, e.r12_total if e.r12_total is not None else 10_000) for e in field]
        scored.sort(key=lambda x: (x[1], x[0].id))

        cut_size = obj.cut_size or 65
        if len(scored) <= cut_size:
            return "No cut (field <= cut size)"

        cut_score = scored[cut_size - 1][1]
        return f"{cut_score} strokes (Top {cut_size} + ties)"

    cut_line_display.short_description = "Cut line (36 holes)"

    def cut_summary(self, obj: Tournament):
        total = obj.entries.count()
        cut = obj.entries.filter(cut=True).count()
        made = obj.entries.filter(cut=False).count()
        return f"Made cut: {made} • Cut: {cut} • Total: {total}"

    cut_summary.short_description = "Cut summary"


@admin.register(TournamentEntry)
class TournamentEntryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "display_name",
        "tournament",
        "is_human",
        "golfer",
        "position",
        "thru_hole",
        "total_strokes",
        "tournament_strokes",
        "cut",
        "country",
        "handedness",
        "avatar_color_badge",
    )
    list_filter = ("is_human", "cut", "handedness", "tournament__status", "tournament__current_round")
    search_fields = ("display_name", "golfer__name", "tournament__name")
    autocomplete_fields = ("tournament", "golfer")
    readonly_fields = ("total_strokes", "tournament_strokes", "thru_hole", "position")
    ordering = ("tournament", "position", "id")

    fieldsets = (
        (None, {"fields": ("tournament", "display_name", "is_human", "golfer")}),
        ("Profile", {"fields": ("country", "handedness", "avatar_color", "sim_state")}),
        ("Standing", {"fields": ("position", "thru_hole", "total_strokes", "tournament_strokes", "cut")}),
    )

    def avatar_color_badge(self, obj: TournamentEntry):
        c = (obj.avatar_color or "").strip()
        if not c:
            return "—"
        return format_html(
            '<span style="display:inline-flex;align-items:center;gap:6px;">'
            '<span style="width:10px;height:10px;border-radius:999px;background:{};display:inline-block;border:1px solid #999;"></span>'
            '<code style="font-size:12px;">{}</code>'
            "</span>",
            c,
            c,
        )
    avatar_color_badge.short_description = "Avatar"


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "tournament",
        "tee_time",
        "wave",
        "start_hole",
        "current_hole",
        "holes_completed",
        "next_action_time",
        "is_finished",
        "members_list",
    )
    list_filter = ("is_finished", "wave", "start_hole", "tournament__status", "tournament__current_round")
    search_fields = ("tournament__name",)
    autocomplete_fields = ("tournament",)
    ordering = ("tournament", "tee_time")
    inlines = (GroupMemberInline,)

    def members_list(self, obj: Group):
        names = [m.entry.display_name for m in obj.members.select_related("entry").all()]
        if not names:
            return "—"
        # keep admin list readable
        return ", ".join(names[:4]) + ("…" if len(names) > 4 else "")
    members_list.short_description = "Members"


@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ("id", "group", "entry")
    autocomplete_fields = ("group", "entry")
    search_fields = ("group__tournament__name", "entry__display_name")


@admin.register(HoleResult)
class HoleResultAdmin(admin.ModelAdmin):
    list_display = ("id", "tournament_name", "entry", "round_number", "hole_number", "strokes", "created_at")
    list_filter = ("round_number", "hole_number", "created_at")
    search_fields = ("entry__display_name", "entry__tournament__name")
    autocomplete_fields = ("entry",)
    ordering = ("entry__tournament", "round_number", "hole_number", "entry__id")

    def tournament_name(self, obj: HoleResult):
        return obj.entry.tournament.name
    tournament_name.short_description = "Tournament"
