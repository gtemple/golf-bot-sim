import json
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.courses.models import Course, Hole, TeeBox

DATA_PATH = "data/pga_courses.json"

class Command(BaseCommand):
    help = "Seed database with real PGA courses from JSON"

    @transaction.atomic
    def handle(self, *args, **options):
        if not os.path.exists(DATA_PATH):
            self.stdout.write(self.style.ERROR(f"File not found: {DATA_PATH}"))
            return

        with open(DATA_PATH, "r", encoding="utf-8") as f:
            courses_data = json.load(f)

        created_courses = 0
        updated_courses = 0

        for c_data in courses_data:
            course, created = Course.objects.update_or_create(
                name=c_data["name"],
                defaults={
                    "location": c_data.get("location", ""),
                    "difficulty_rating": c_data.get("difficulty_rating", 7.0),
                    "greens_speed": c_data.get("greens_speed", 10.0),
                    "fairway_firmness": c_data.get("fairway_firmness", 5.0),
                    "rough_severity": c_data.get("rough_severity", 5.0),
                }
            )

            if created:
                created_courses += 1
            else:
                updated_courses += 1

            # Process holes
            for h_data in c_data["holes"]:
                hole, _ = Hole.objects.update_or_create(
                    course=course,
                    number=h_data["number"],
                    defaults={
                        "par": h_data["par"],
                        "stroke_index": h_data.get("stroke_index"),
                        "bunker_count": h_data.get("bunkers", 0),
                        "water_in_play": h_data.get("water", False),
                        "fairway_width": 6.0, # Default
                        "green_size": 28.0,   # Default
                        "green_slope": 5.0,   # Default
                    }
                )

                # Create Championship Tee Box
                TeeBox.objects.update_or_create(
                    hole=hole,
                    name="Championship",
                    defaults={
                        "color": "black",
                        "yardage": h_data["yardage"]
                    }
                )
                
                # Also create a 'Members' tee for variety (approx 90% yardage)
                TeeBox.objects.update_or_create(
                    hole=hole,
                    name="Members",
                    defaults={
                        "color": "white",
                        "yardage": int(h_data["yardage"] * 0.9)
                    }
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully processed courses: {created_courses} created, {updated_courses} updated."
            )
        )
