import csv
import hashlib
import math
from datetime import datetime, date

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.courses.models import Course, Hole, TeeBox
from apps.golfers.models import Golfer


CSV_PATH = "data/downloaded_rankings.csv"
TOP_N = 1000


def _stable_unit(name: str, salt: str) -> float:
    h = hashlib.sha256(f"{salt}:{name}".encode()).hexdigest()
    n = int(h[:12], 16)
    return (n % 10_000_000) / 10_000_000.0


def _clamp(v: float, lo=0, hi=100) -> int:
    return int(max(lo, min(hi, round(v))))


def _parse_date(v) -> date | None:
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(v.strip(), fmt).date()
        except Exception:
            pass
    return None


def ratings_from_rank(rank: int, name: str) -> dict:
    top = 97.0
    bottom = 73.0
    t = (rank - 1) / (TOP_N - 1)
    base = top - (top - bottom) * (t ** 0.75)

    def wobble(key, scale):
        return (_stable_unit(name, key) - 0.5) * scale

    return {
        "driving_power": _clamp(base + wobble("power", 10)),
        "driving_accuracy": _clamp(base + wobble("accuracy", 10)),
        "approach": _clamp(base + wobble("approach", 8)),
        "short_game": _clamp(base + wobble("short", 8)),
        "putting": _clamp(base + wobble("putt", 8)),
        "ball_striking": _clamp(base + wobble("bs", 6)),
        "consistency": _clamp(base + wobble("cons", 10)),
        "course_management": _clamp(base + wobble("mgmt", 8)),
        "discipline": _clamp(base + wobble("disc", 8)),
        "sand": _clamp(base + wobble("sand", 6)),
        "clutch": _clamp(base + wobble("clutch", 8)),
        "risk_tolerance": _clamp(50 + wobble("risk", 20)),
        "weather_handling": _clamp(base + wobble("wx", 8)),
        "endurance": _clamp(base + wobble("endur", 8)),
        "volatility": round(
            max(0.75, min(1.40, 1.25 - (base - 70) * 0.01 + wobble("vol", 0.25))),
            2,
        ),
    }


class Command(BaseCommand):
    help = "Seed v2 using CSV world rankings (top 200 golfers)"

    @transaction.atomic
    def handle(self, *args, **options):
        # --- course + holes (unchanged) ---
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

        for num, par, yardage, bunkers, water in holes_data:
            hole, _ = Hole.objects.get_or_create(
                course=course,
                number=num,
                defaults={
                    "par": par,
                    "stroke_index": num,
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
                defaults={"color": "black", "yardage": yardage},
            )

        # --- golfers from CSV ---
        created = updated = 0

        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        def col(row, *names):
            for n in names:
                if n in row and row[n]:
                    return row[n]
            return None

        def get_iso_country(c_name: str) -> str:
            m = {
                "United States": "USA",
                "Canada": "CAN",
                "England": "ENG",
                "Scotland": "SCO",
                "Ireland": "IRL",
                "Northern Ireland": "NIR",
                "Wales": "WAL",
                "Australia": "AUS",
                "New Zealand": "NZL",
                "South Africa": "RSA",
                "Japan": "JPN",
                "South Korea": "KOR",
                "Korea": "KOR",
                "China": "CHN",
                "Sweden": "SWE",
                "Norway": "NOR",
                "Denmark": "DEN",
                "Finland": "FIN",
                "Spain": "ESP",
                "Italy": "ITA",
                "France": "FRA",
                "Germany": "GER",
                "Austria": "AUT",
                "Belgium": "BEL",
                "Netherlands": "NED",
                "Mexico": "MEX",
                "Chile": "CHI",
                "Argentina": "ARG",
                "Colombia": "COL",
            }
            return m.get(c_name, c_name[:3].upper())

        for row in rows[:TOP_N]:
            name = row.get("NAME")
            rank_raw = row.get("RANKING")
            country_raw = row.get("CTRY") or ""
            
            country_code = get_iso_country(country_raw)

            if not name or not rank_raw:
                continue

            rank = int(rank_raw)


            rank = int(rank_raw)

            ratings = ratings_from_rank(rank, name)

            obj, was_created = Golfer.objects.update_or_create(
              name=name,
              defaults={
                  "country": country_code,
                  "is_active": True,
                  **ratings,
              },
          )

            created += int(was_created)
            updated += int(not was_created)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded golfers from CSV: created={created}, updated={updated}"
            )
        )
