from django.core.management.base import BaseCommand
from apps.courses.models import Course, Hole, TeeBox
from apps.golfers.models import Golfer


class Command(BaseCommand):
    help = "Seed v1 dev data: 1 course, 18 holes, 1 tee box per hole, 3 golfers."

    def handle(self, *args, **options):
        course, _ = Course.objects.get_or_create(
            name="Pebble-ish Demo Club",
            defaults={
                "location": "Demo City",
                "difficulty_rating": 7.5,
                "greens_speed": 11.0,
                "fairway_firmness": 5.0,
                "rough_severity": 6.0,
            },
        )

        holes_data = [
            # number, par, yardage (single tee for v1), bunkers, water
            (1, 4, 410, 2, False),
            (2, 5, 530, 3, False),
            (3, 3, 185, 2, False),
            (4, 4, 440, 4, True),
            (5, 4, 395, 2, False),
            (6, 5, 560, 3, True),
            (7, 3, 205, 1, False),
            (8, 4, 460, 4, False),
            (9, 4, 430, 3, True),
            (10, 4, 415, 2, False),
            (11, 4, 455, 3, True),
            (12, 3, 175, 2, False),
            (13, 5, 545, 3, False),
            (14, 4, 425, 2, True),
            (15, 4, 470, 5, False),
            (16, 3, 210, 2, True),
            (17, 5, 575, 4, False),
            (18, 4, 445, 3, True),
        ]

        for (num, par, yardage, bunkers, water) in holes_data:
            hole, _ = Hole.objects.get_or_create(
                course=course,
                number=num,
                defaults={
                    "par": par,
                    "stroke_index": num,  # placeholder
                    "bunker_count": bunkers,
                    "water_in_play": water,
                    "fairway_width": 6.0,
                    "green_size": 28.0,
                    "green_slope": 5.0,
                },
            )
            TeeBox.objects.get_or_create(
                hole=hole,
                name="Champ",
                defaults={"color": "black", "yardage": yardage, "rating": None, "slope": None},
            )

        Golfer.objects.get_or_create(
            name="Scottie Scheffler",
            defaults={"country": "USA", "driving": 88, "approach": 95, "short_game": 82, "putting": 78, "volatility": 1.1},
        )
        Golfer.objects.get_or_create(
            name="Rory McIlroy",
            defaults={"country": "IRL", "driving": 94, "approach": 87, "short_game": 80, "putting": 81, "volatility": 1.2},
        )
        Golfer.objects.get_or_create(
            name="Viktor Hovland",
            defaults={"country": "NOR", "driving": 86, "approach": 90, "short_game": 76, "putting": 79, "volatility": 1.15},
        )

        self.stdout.write(self.style.SUCCESS("Seeded v1 course + holes + tee boxes + 3 golfers."))
