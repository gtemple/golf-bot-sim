import random
from django.utils import timezone
from apps.courses.models import Hole
from apps.golfers.models import Golfer

def golfer_overall(g: Golfer) -> float:
    return (g.driving + g.approach + g.short_game + g.putting) / 4.0

def hole_difficulty(h: Hole) -> float:
    d = 0.0
    d += min(h.bunker_count, 6) * 0.10
    d += 0.40 if h.water_in_play else 0.0
    d += 0.20 if h.trees_in_play else 0.0
    d += float(h.green_slope or 0) * 0.03
    return d

def _get_round_state(entry, round_number: int):
    state = entry.sim_state or {}
    rkey = str(round_number)
    if rkey not in state:
        # base "form" for the round: some days you just have it / don't
        # volatility increases variance
        vol = float(entry.golfer.volatility or 1.0) if entry.golfer_id else 1.0
        form = random.gauss(0.0, 0.35 * vol)  # -ish strokes per hole influence
        state[rkey] = {"form": form, "momentum": 0.0}
    return state, rkey, state[rkey]

def simulate_strokes_for_entry(entry, hole: Hole, round_number: int) -> int:
    golfer = entry.golfer
    if not golfer:
        raise ValueError("simulate_strokes_for_entry called for non-bot entry")

    overall = golfer_overall(golfer)  # 0..100
    skill_penalty = (75.0 - overall) / 25.0  # better -> negative

    state, rkey, rstate = _get_round_state(entry, round_number)
    form = float(rstate.get("form", 0.0))
    momentum = float(rstate.get("momentum", 0.0))

    expected = hole.par + skill_penalty + hole_difficulty(hole) + form + momentum

    vol = float(golfer.volatility or 1.0)
    sigma = max(0.30, min(1.10, 0.50 * vol))
    strokes = int(round(random.gauss(expected, sigma)))

    strokes = max(hole.par - 2, min(hole.par + 4, strokes))

    # Update momentum based on result vs par (simple streakiness model)
    delta = hole.par - strokes  # birdie = +1, bogey = -1
    # decay old momentum + add a bit of new signal
    momentum = (momentum * 0.65) + (0.12 * delta)

    # clamp momentum so it doesn't go nuts
    momentum = max(-0.6, min(0.6, momentum))

    rstate["momentum"] = momentum
    state[rkey] = rstate
    entry.sim_state = state
    entry.save(update_fields=["sim_state"])

    return strokes
