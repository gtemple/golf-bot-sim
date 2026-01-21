from django.db import models


class Golfer(models.Model):
    """
    A real-world golfer (or fictional). Their ratings drive simulation.
    """

    name = models.CharField(max_length=200, unique=True)
    country = models.CharField(
        max_length=3, blank=True, default=""
    )  # ISO-ish (CAN/USA/etc)
    is_active = models.BooleanField(default=True)

    # Skill ratings (0-100). Start simple; evolve later.
    driving = models.PositiveSmallIntegerField(
        default=50
    )  # distance + accuracy blend for v1
    approach = models.PositiveSmallIntegerField(default=50)
    short_game = models.PositiveSmallIntegerField(default=50)
    putting = models.PositiveSmallIntegerField(default=50)
    handedness = models.CharField(
        max_length=1,
        choices=[("R", "Right"), ("L", "Left")],
        default="R",
    )

    # “streakiness / volatility” knob (higher = more wild rounds)
    volatility = models.DecimalField(max_digits=4, decimal_places=2, default=1.0)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
