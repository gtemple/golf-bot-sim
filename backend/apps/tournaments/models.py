from django.db import models
from django.utils import timezone
from django.db.models import JSONField

from apps.courses.models import Course
from apps.golfers.models import Golfer


class Tournament(models.Model):
    """
    A single PGA-style stroke play tournament.
    """
    STATUS_CHOICES = [
        ("setup", "Setup"),
        ("in_progress", "In Progress"),
        ("finished", "Finished"),
        ("playoff", "Playoff"),
    ]

    FORMAT_CHOICES = [
        ("stroke", "Stroke Play"),
        ("match", "Match Play (Ryder Cup)"),
    ]

    name = models.CharField(max_length=200)
    course = models.ForeignKey(Course, on_delete=models.PROTECT)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="setup")
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, default="stroke")

    # Tournament clock (this is key)
    start_time = models.DateTimeField()
    current_time = models.DateTimeField()
    cut_applied = models.BooleanField(default=False)
    cut_size = models.PositiveSmallIntegerField(default=65)
    
    projected_cut_score = models.IntegerField(null=True, blank=True)

    current_round = models.PositiveSmallIntegerField(default=1)  # 1–4
    
    # Store past round results for Ryder Cup match history
    session_history = models.JSONField(blank=True, default=dict)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class TournamentEntry(models.Model):
    """
    A golfer (real or human) participating in a tournament.
    """
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="entries")

    golfer = models.ForeignKey(
        Golfer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="Null if this is a human player",
    )

    display_name = models.CharField(max_length=200)
    is_human = models.BooleanField(default=False)
    team = models.CharField(max_length=10, blank=True, default="", help_text="USA or EUR for Match Play")

    # Current tournament totals
    total_strokes = models.IntegerField(default=0)
    tournament_strokes = models.IntegerField(default=0)
    thru_hole = models.PositiveSmallIntegerField(default=0)  # 0 = not started
    position = models.PositiveSmallIntegerField(null=True, blank=True)
    country = models.CharField(max_length=3, blank=True, default="")
    handedness = models.CharField(max_length=1, choices=[("R", "Right"), ("L", "Left")], blank=True, default="R")
    avatar_color = models.CharField(max_length=20, blank=True, default="")

    cut = models.BooleanField(default=False)
    sim_state = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"{self.display_name} ({'Human' if self.is_human else 'Bot'})"


class Group(models.Model):
    tournament = models.ForeignKey("tournaments.Tournament", on_delete=models.CASCADE, related_name="groups")
    tee_time = models.DateTimeField()

    start_hole = models.PositiveSmallIntegerField(default=1)      # 1 or 10 (we’ll do 1 for v1)
    current_hole = models.PositiveSmallIntegerField(default=1)    # next hole to be played
    wave = models.PositiveSmallIntegerField(default=1) 
    holes_completed = models.PositiveSmallIntegerField(default=0) # 0..18
    next_action_time = models.DateTimeField(null=True, blank=True) # when this group is due to finish next hole
    is_finished = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.tournament.name} @ {self.tee_time.strftime('%H:%M')} (H{self.current_hole})"

class GroupMember(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="members")
    entry = models.ForeignKey(TournamentEntry, on_delete=models.CASCADE)

    class Meta:
        unique_together = [("group", "entry")]

class HoleResult(models.Model):
    """
    Result of a single player on a single hole in a round.
    """
    entry = models.ForeignKey(TournamentEntry, on_delete=models.CASCADE, related_name="hole_results")
    round_number = models.PositiveSmallIntegerField()
    hole_number = models.PositiveSmallIntegerField()

    strokes = models.PositiveSmallIntegerField()
    stats = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("entry", "round_number", "hole_number")]
        ordering = ["round_number", "hole_number"]


class TournamentEvent(models.Model):
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE, related_name="events")
    round_number = models.PositiveSmallIntegerField()
    text = models.CharField(max_length=255)
    
    # 1=generic, 2=birdie/bogey, 3=eagle/double, 4=lead change/ace
    importance = models.SmallIntegerField(default=1)  
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.text
