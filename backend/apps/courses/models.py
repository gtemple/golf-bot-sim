
from django.db import models


class Course(models.Model):
    """
    A real-world course layout (or a fictional one).
    We keep it stable; tournaments reference it.
    """
    name = models.CharField(max_length=200, unique=True)
    location = models.CharField(max_length=200, blank=True, default="")

    # Optional “overall feel” knobs (helpful later)
    difficulty_rating = models.DecimalField(max_digits=4, decimal_places=2, default=0)  # arbitrary scale
    greens_speed = models.DecimalField(max_digits=4, decimal_places=2, default=0)      # stimp-like
    fairway_firmness = models.DecimalField(max_digits=4, decimal_places=2, default=0)  # arbitrary
    rough_severity = models.DecimalField(max_digits=4, decimal_places=2, default=0)    # arbitrary

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Hole(models.Model):
    """
    A hole on a course. Each hole has a par and attributes used for simulation.
    Yardage varies by tee box, so yardage is NOT stored here.
    """
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="holes")
    number = models.PositiveSmallIntegerField()  # 1-18
    par = models.PositiveSmallIntegerField()     # 3/4/5 (sometimes 6)
    stroke_index = models.PositiveSmallIntegerField(null=True, blank=True)  # 1 hardest .. 18 easiest

    # “Shape” / hazards (simple v1 knobs, we can evolve later)
    elevation_change = models.SmallIntegerField(default=0)  # -50..+50 feet-ish, arbitrary
    dogleg = models.CharField(
        max_length=10,
        choices=[("none", "None"), ("left", "Left"), ("right", "Right")],
        default="none",
    )

    fairway_width = models.DecimalField(max_digits=4, decimal_places=1, default=0)  # arbitrary scale
    green_size = models.DecimalField(max_digits=5, decimal_places=1, default=0)     # sq yds-ish, arbitrary
    green_slope = models.DecimalField(max_digits=4, decimal_places=2, default=0)    # arbitrary

    bunker_count = models.PositiveSmallIntegerField(default=0)
    water_in_play = models.BooleanField(default=False)
    trees_in_play = models.BooleanField(default=False)

    class Meta:
        unique_together = [("course", "number")]
        ordering = ["course", "number"]

    def __str__(self):
        return f"{self.course.name} - Hole {self.number} (Par {self.par})"


class TeeBox(models.Model):
    """
    A tee setup for a hole (e.g., Back/Champ, Blue, White, Red).
    This is where yardages live.
    """
    hole = models.ForeignKey(Hole, on_delete=models.CASCADE, related_name="tee_boxes")

    name = models.CharField(max_length=50)  # e.g. "Champ", "Blue", "White"
    color = models.CharField(max_length=30, blank=True, default="")
    yardage = models.PositiveSmallIntegerField()

    # Optional: used later for rating/slope by tee if you want
    rating = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    slope = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        unique_together = [("hole", "name")]
        ordering = ["hole__number", "name"]

    def __str__(self):
        return f"{self.hole.course.name} H{self.hole.number} - {self.name} ({self.yardage}y)"
