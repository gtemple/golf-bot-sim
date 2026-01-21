import random
from apps.courses.models import Hole
from apps.golfers.models import Golfer


# ---------- helpers ----------

def golfer_overall(g: Golfer) -> float:
    """
    Prefer model's computed overall if you added it as a @property,
    else fall back to a weighted blend of the new stats.
    """
    if hasattr(g, "overall"):
        try:
            return float(g.overall)
        except Exception:
            pass

    # Reasonable default weights (can tune later)
    w = {
        "driving_power": 0.08,
        "driving_accuracy": 0.10,
        "approach": 0.18,
        "ball_striking": 0.12,
        "short_game": 0.12,
        "sand": 0.06,
        "putting": 0.18,
        "course_management": 0.08,
        "discipline": 0.04,
        "clutch": 0.04,
    }
    total_w = sum(w.values())
    val = (
        g.driving_power * w["driving_power"]
        + g.driving_accuracy * w["driving_accuracy"]
        + g.approach * w["approach"]
        + g.ball_striking * w["ball_striking"]
        + g.short_game * w["short_game"]
        + g.sand * w["sand"]
        + g.putting * w["putting"]
        + g.course_management * w["course_management"]
        + g.discipline * w["discipline"]
        + g.clutch * w["clutch"]
    )
    return float(val / total_w)


def hole_difficulty(h: Hole) -> float:
    """
    Returns an additive difficulty in "strokes", roughly 0.0 .. ~1.5.
    """
    d = 0.0
    d += min(getattr(h, "bunker_count", 0) or 0, 6) * 0.10
    d += 0.40 if getattr(h, "water_in_play", False) else 0.0
    d += 0.20 if getattr(h, "trees_in_play", False) else 0.0
    d += float(getattr(h, "green_slope", 0) or 0) * 0.03
    return d


def _clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def _get_round_state(entry, round_number: int):
    """
    Per-round sim state:
    - form: baseline performance for the day (hot/cold)
    - momentum: streakiness within the round
    """
    state = entry.sim_state or {}
    rkey = str(round_number)

    if rkey not in state:
        golfer = getattr(entry, "golfer", None)
        vol = float(getattr(golfer, "volatility", 1.0) or 1.0) if golfer else 1.0
        consistency = float(getattr(golfer, "consistency", 50) or 50) if golfer else 50

        # Less consistent players have bigger day-to-day form swings
        form_sigma = 0.18 + (1.0 - (consistency / 100.0)) * 0.22  # ~0.18..0.40
        form_sigma *= _clamp(vol, 0.6, 2.0)

        form = random.gauss(0.0, form_sigma)  # strokes per hole-ish
        state[rkey] = {"form": form, "momentum": 0.0}

    return state, rkey, state[rkey]


# ---------- core sim ----------

def simulate_strokes_for_entry(entry, hole: Hole, round_number: int) -> int:
    golfer: Golfer = entry.golfer
    if not golfer:
        raise ValueError("simulate_strokes_for_entry called for non-bot entry")

    # Normalize skills to 0..1
    def n(x): return _clamp(float(x or 0) / 100.0, 0.0, 1.0)

    driving_power = n(golfer.driving_power)
    driving_accuracy = n(golfer.driving_accuracy)
    approach = n(golfer.approach)
    ball_striking = n(golfer.ball_striking)
    short_game = n(golfer.short_game)
    sand = n(golfer.sand)
    putting = n(golfer.putting)
    course_mgmt = n(golfer.course_management)
    discipline = n(golfer.discipline)
    clutch = n(golfer.clutch)
    risk = n(golfer.risk_tolerance)
    consistency = n(golfer.consistency)

    vol = float(getattr(golfer, "volatility", 1.0) or 1.0)

    # Base difficulty
    diff = hole_difficulty(hole)

    # A few situational penalties/bonuses
    hazard_penalty = 0.0
    if getattr(hole, "water_in_play", False):
        hazard_penalty += (1.0 - driving_accuracy) * 0.22
        hazard_penalty += (1.0 - discipline) * 0.10
    if getattr(hole, "trees_in_play", False):
        hazard_penalty += (1.0 - driving_accuracy) * 0.14

    bunker_penalty = min(getattr(hole, "bunker_count", 0) or 0, 6) * 0.03
    bunker_penalty *= (1.0 - sand)  # good bunker players reduce this

    green_slope = float(getattr(hole, "green_slope", 0) or 0)
    putting_penalty = (green_slope * 0.02) * (1.0 - putting)

    # Skill advantage (turn “good at golf” into fewer strokes)
    # Par weighting: on par 5s driving/ball striking matters more; par 3s approach matters more.
    par = int(hole.par)
    if par == 5:
        skill = 0.35 * driving_power + 0.25 * ball_striking + 0.20 * approach + 0.20 * putting
    elif par == 3:
        skill = 0.15 * driving_power + 0.45 * approach + 0.20 * ball_striking + 0.20 * putting
    else:  # par 4
        skill = 0.25 * driving_power + 0.30 * approach + 0.20 * ball_striking + 0.25 * putting

    # short game helps mostly when hole is “messy”
    messy = _clamp(diff / 1.2, 0.0, 1.0)
    skill += 0.12 * short_game * messy
    skill += 0.08 * course_mgmt
    skill += 0.05 * discipline

    # Convert skill (0..~1.1) into strokes gained vs baseline.
    # Around 0.70 is “tour-ish”; below that starts paying penalties.
    baseline = 0.70
    skill_strokes = (baseline - skill) * 1.15  # positive => worse, negative => better

    # Round state (streakiness)
    state, rkey, rstate = _get_round_state(entry, round_number)
    form = float(rstate.get("form", 0.0))
    momentum = float(rstate.get("momentum", 0.0))

    # Risk: slightly lower mean (more birdie tries) but higher variance
    risk_mean = -(risk - 0.5) * 0.06  # -0.03..+0.03
    # Clutch: helps on “save” situations; model it as a tiny counter to difficulty
    clutch_help = -(clutch - 0.5) * (0.04 + 0.04 * messy)

    expected = (
        par
        + diff
        + hazard_penalty
        + bunker_penalty
        + putting_penalty
        + skill_strokes
        + form
        + momentum
        + risk_mean
        + clutch_help
    )

    # Variance: higher volatility + lower consistency = wider spread
    base_sigma = 0.38 + (1.0 - consistency) * 0.35  # ~0.38..0.73
    sigma = base_sigma * _clamp(vol, 0.6, 2.0)
    sigma += risk * 0.06  # risk adds a bit of chaos

    strokes = int(round(random.gauss(expected, sigma)))

    # clamp to sane hole outcomes
    strokes = max(par - 2, min(par + 4, strokes))

    # Update momentum (streakiness within the round)
    # Less consistent golfers “ride” momentum harder (both hot & cold)
    delta = par - strokes  # birdie=+1, bogey=-1
    streak_factor = 0.10 + (1.0 - consistency) * 0.12  # ~0.10..0.22
    decay = 0.62 + consistency * 0.20                 # ~0.62..0.82 (consistent = steadier, less swing)

    momentum = (momentum * decay) + (streak_factor * delta)
    momentum = _clamp(momentum, -0.75, 0.75)

    rstate["momentum"] = float(momentum)
    state[rkey] = rstate
    entry.sim_state = state
    entry.save(update_fields=["sim_state"])

    return strokes
