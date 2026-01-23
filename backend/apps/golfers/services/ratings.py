import csv
import hashlib
from typing import Dict, Any

from apps.golfers.models import Golfer

CSV_PATH = "data/downloaded_rankings.csv"
TOP_N = 1000

def _stable_unit(name: str, salt: str) -> float:
    h = hashlib.sha256(f"{salt}:{name}".encode()).hexdigest()
    n = int(h[:12], 16)
    return (n % 10_000_000) / 10_000_000.0


def _clamp(v: float, lo=0, hi=100) -> int:
    return int(max(lo, min(hi, round(v))))


def calculate_ratings(rank: int, name: str) -> Dict[str, Any]:
    """
    Calculates ratings based on rank with some noise.
    Adjusted to keep top players closer to the top.
    """
    top = 99.0
    bottom = 70.0  # Lower the floor slightly
    
    # t goes from 0 to 1
    t = (rank - 1) / (TOP_N - 1)
    
    # Steeper curve: t^0.4 drops significantly faster initially
    base = top - (top - bottom) * (t ** 0.4) 

    # Reduce wobble scales further to protect the #1 spot
    def wobble(key, scale):
        return (_stable_unit(name, key) - 0.5) * scale

    return {
        "driving_power": _clamp(base + wobble("power", 4)), 
        "driving_accuracy": _clamp(base + wobble("accuracy", 4)),
        "approach": _clamp(base + wobble("approach", 4)),
        "short_game": _clamp(base + wobble("short", 4)),
        "putting": _clamp(base + wobble("putt", 4)),
        "ball_striking": _clamp(base + wobble("bs", 3)),
        "consistency": _clamp(base + wobble("cons", 4)),
        "course_management": _clamp(base + wobble("mgmt", 4)),
        "discipline": _clamp(base + wobble("disc", 4)),
        "sand": _clamp(base + wobble("sand", 3)),
        "clutch": _clamp(base + wobble("clutch", 4)),
        "risk_tolerance": _clamp(50 + wobble("risk", 15)),
        "weather_handling": _clamp(base + wobble("wx", 4)),
        "endurance": _clamp(base + wobble("endur", 4)),
        "volatility": round(
            max(0.70, min(1.30, 1.25 - (base - 70) * 0.01 + wobble("vol", 0.15))),
            2,
        ),
    }

def update_ratings_from_csv(csv_path: str = CSV_PATH) -> int:
    """
    Reads the CSV and updates/creates all golfers in TOP_N.
    Returns number of golfers updated.
    """
    count = 0
    
    # Resolve path relative to backend root if it's relative
    # Assuming the command runs from backend root, but let's be safe later.
    # For now assume the path is correct as per seed_v2 usage.
    
    try:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        print(f"File not found: {csv_path}")
        return 0

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
        
        if not name or not rank_raw:
            continue
            
        try:
            rank = int(rank_raw)
        except ValueError:
            continue

        country_code = get_iso_country(country_raw)
        ratings = calculate_ratings(rank, name)

        Golfer.objects.update_or_create(
            name=name,
            defaults={
                "country": country_code,
                "is_active": True,
                **ratings,
            },
        )
        count += 1
        
    return count
