from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator


RATING_MIN = 0
RATING_MAX = 100
rating_validators = [MinValueValidator(RATING_MIN), MaxValueValidator(RATING_MAX)]


class Golfer(models.Model):
    """
    A real-world golfer (or fictional). Their ratings drive simulation.

    Ratings are 0-100. Keep volatility separate (it’s not a “skill”).
    """

    name = models.CharField(max_length=200, unique=True)
    country = models.CharField(max_length=3, blank=True, default="")  # ISO-ish (CAN/USA/etc)
    dob = models.DateField(null=True, blank=True)  # <-- ADD THIS
    is_active = models.BooleanField(default=True)

    handedness = models.CharField(
        max_length=1,
        choices=[("R", "Right"), ("L", "Left")],
        default="R",
    )

    # --- Core skills (0-100) ---
    driving_power = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    driving_accuracy = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    approach = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    short_game = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    putting = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    # --- Useful realism knobs (0-100) ---
    ball_striking = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    consistency = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    course_management = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    discipline = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    sand = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    clutch = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    risk_tolerance = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    weather_handling = models.PositiveSmallIntegerField(default=50, validators=rating_validators)
    endurance = models.PositiveSmallIntegerField(default=50, validators=rating_validators)

    # --- Variance control ---
    # Higher = more “wild” outcomes (separate from consistency, which is skill-like)
    volatility = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)

    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def rating_fields(cls):
        """
        Single source of truth for which fields count toward 'overall'.
        """
        return [
            "driving_power",
            "driving_accuracy",
            "approach",
            "short_game",
            "putting",
            "ball_striking",
            "consistency",
            "course_management",
            "discipline",
            "sand",
            "clutch",
            "risk_tolerance",
            "weather_handling",
            "endurance",
        ]

    @property
    def overall(self) -> int:
        """
        Average of all rating fields (rounded to nearest int).
        Always computed so it can’t go stale.
        """
        vals = [getattr(self, f) for f in self.rating_fields()]
        return int(round(sum(vals) / len(vals))) if vals else 0

    def __str__(self):
        return self.name
