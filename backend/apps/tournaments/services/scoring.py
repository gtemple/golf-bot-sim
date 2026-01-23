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

def simulate_strokes_for_entry_with_stats(entry, hole: Hole, round_number: int) -> tuple[int, dict]:
    """
    Returns (strokes, stats_dict)
    """
    golfer: Golfer = entry.golfer
    if not golfer:
        # Fallback for human or empty (shouldn't happen for bots)
        return (hole.par, {})

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

    # --- Real World Course Factors ---
    course = hole.course
    greens_speed = float(getattr(course, "greens_speed", 10.0) or 10.0)
    rough_severity = float(getattr(course, "rough_severity", 5.0) or 5.0)
    fairway_firmness = float(getattr(course, "fairway_firmness", 5.0) or 5.0)
    difficulty_rating = float(getattr(course, "difficulty_rating", 7.5) or 7.5)

    # 1. Global Difficulty Scaling
    # Shift baseline expectation based on course rating.
    # ~0.1 stroke harder per point above 7.5
    global_diff_penalty = (difficulty_rating - 7.5) * 0.10

    # 2. Rough Penalty
    # Probability of missing fairway/green leads to penalty based on rough severity
    # Inaccurate drivers get punished more on harsh courses (severity > 5)
    miss_prob = 1.0 - driving_accuracy
    rough_penalty = miss_prob * ((rough_severity / 10.0) * 0.35)

    # 3. Firmness Penalty on Approach
    # Harder to hold greens if firmness is high
    holding_penalty = (fairway_firmness / 10.0) * 0.15 * (1.0 - approach)

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

    # 4. Greens Speed Penalty
    # Fast greens (>10) punish bad putters exponentially
    speed_factor = max(0, greens_speed - 10.0)
    putting_penalty += (speed_factor * 0.08) * (1.0 - putting)

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
        + global_diff_penalty
        + rough_penalty
        + holding_penalty
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

    # ------------------
    # Detailed Stats Generation
    # We infer stats consistent with the final score 'strokes'.
    # ------------------
    
    stats = {
        "fir": None, # boolean or None if par 3
        "gir": False,
        "putts": 0,
        "drive_distance": 0,
        "prox_to_hole": 0, # feet
    }

    # DRIVING (Distance)
    # Base distance: 280 + (power * 40) +/- variance
    raw_dist = 275 + (driving_power * 45) + random.gauss(0, 10)
    
    # Firmness Bonus: Add ~3 yards per point of firmness above average (5)
    # Assuming `course` is available in scope (it is from above edit)
    # Re-fetch just in case we are in a block that doesn't see it (though we are in same func)
    course = hole.course
    firmness = float(getattr(course, "fairway_firmness", 5.0) or 5.0)
    roll_bonus = (firmness - 5.0) * 3.0
    raw_dist += roll_bonus

    # Rainy/uphill considerations handled by caller? Or just abstract here.
    stats["drive_distance"] = int(raw_dist)

    # FAIRWAY (FIR) - only for par 4/5
    if par >= 4:
        # Base accuracy
        fir_prob = 0.50 + (driving_accuracy * 0.40) # 50% - 90%
        # Penalty for risk, bonus for course mgmt
        fir_prob -= (risk * 0.10)
        fir_prob += (course_mgmt * 0.05)
        # Trees check
        if getattr(hole, "trees_in_play", False):
            fir_prob -= 0.10
        
        # If score is terrible (double bogey+), likely missed fairway
        if strokes >= par + 2:
            fir_prob -= 0.40
        # If score is birdie+, likely hit fairway
        if strokes < par:
            fir_prob += 0.20
            
        stats["fir"] = random.random() < _clamp(fir_prob, 0.1, 0.95)

    # GIR (Green in Regulation)
    # GIR normally correlates heavily with strokes.
    # Stamps:
    # Birdie or better => 95%+ GIR
    # Par => 65% GIR
    # Bogey => 15% GIR
    # Dbl+ => < 5% GIR
    
    gir_prob = 0.0
    if strokes < par:
        gir_prob = 0.95
    elif strokes == par:
        gir_prob = 0.65 + (approach * 0.15) + (short_game * 0.15) # scramblers can save par w/o GIR
    elif strokes == par + 1:
        gir_prob = 0.15
    else:
        gir_prob = 0.05
        
    stats["gir"] = random.random() < gir_prob

    # PUTTS
    # Infer putts from Score + GIR
    #
    # Strokes = (Par - 2 if Eagle)
    # Strokes = Putts + Shots_to_green
    #
    # standard shots to green = Par - 2
    # if GIR: shots_to_green <= Par - 2
    # if !GIR: shots_to_green > Par - 2
    
    shots_to_green = 0
    if stats["gir"]:
        # Hit green in regulation (or better). 
        # Typically shots_to_green = Par - 2
        # Could be Par - 1 (fringy GIR?) No let's stick to definition.
        shots_to_green = par - 2
        # Unless it's a par 5 and they reached in 2 (Albatross? Eagle?)
        if strokes <= par - 2: # Eagle/Albatross
             # reached in fewer?
             shots_to_green = strokes - 1 # 1 putt
             if shots_to_green < 1: shots_to_green = 1 # Hole out?
    else:
        # Missed GIR. 
        # Scrambling?
        # shots_to_green is at least Par - 1
        shots_to_green = par - 1
        
        # If score is high, shots to green goes up
        if strokes >= par + 1:
             # e.g. Par 4, score 5. Putts? 
             # If putts=2, shots=3 (missed green, chip on, 2 putt)
             # If putts=1, shots=4 (duffed chip?)
             pass

    # Reverse engineer putts: Strokes = Shots_to_green + Putts
    # But we define Shots_to_green relative to GIR logic
    
    # Simpler logic:
    if stats["gir"]:
        # On green in Par-2 strokes usually.
        # e.g. Par 4, on in 2.
        # Score 3 (Birdie) -> 1 putt
        # Score 4 (Par) -> 2 putt
        # Score 5 (Bogey) -> 3 putt
        putts = strokes - (par - 2)
    else:
        # Missed green. On in (Par - 1) or more.
        # Par 4. On in 3.
        # Score 4 (Par) -> 1 putt (Save!)
        # Score 5 (Bogey) -> 2 putt
        # Score 6 (Dbl) -> 3 putt? Or on in 4, 2 putt?
        
        # We'll bias towards standard putting (1-2 putts usually)
        # If score says we have room for 2 putts, take 2.
        # If score is low, take 1.
        
        scramble_shots = strokes - (par - 2)
        # if score is par (4), scramble_shots = 2. Means Chip + Putt = 2. -> 1 putt.
        # if score is bogey (5), scramble_shots = 3. Chip + 2 Putt? or Chip + Chip + 1 Putt?
        
        # Let's pivot: Determine putts based on putting skill, then rest is "shots to green"
        # 1-putt prob: 30% + (putting * 20%)
        # 3-putt prob: 10% - (putting * 8%)
        
        # But we must respect the TOTAL score.
        # Max putts = strokes - 1 (must have at least 1 shot to get there, unless hole in one)
        max_putts = max(0, strokes - 1)
        
        # Typical breakdown
        if strokes <= par: 
            # likely 1 putt if !GIR (Scramble)
            putts = 1
        else:
            # likely 2 putts
            putts = 2
            
    # Clamp putts
    putts = max(0, min(putts, strokes - 1))
    
    # Specific overrides for logic consistency
    if strokes == par - 1: # Birdie
        # If GIR (on in par-2), then 1 putt.
        # If !GIR (on in par-3?? Chip in!), then 0 putts.
        if not stats["gir"]:
            if random.random() < 0.2: putts = 0 # Chip in
            else: putts = 1 # Close 
    
    stats["putts"] = putts
    
    # Proximity (ft)
    if stats["gir"]:
        # Good approach?
        base_prox = 35 - (approach * 15) - (ball_striking * 5)
        if putts == 0: base_prox = 0
        elif putts == 1: base_prox = random.uniform(3, 12)
        elif putts >= 3: base_prox = random.uniform(40, 70)
        else: base_prox = random.uniform(15, 40)
        stats["prox_to_hole"] = int(base_prox)
    else:
        # Missed green stats? distance from pin after approach?
        stats["prox_to_hole"] = int(random.uniform(25, 60)) # fringe/rough

    return strokes, stats


def simulate_strokes_for_entry(entry, hole: Hole, round_number: int) -> int:
    # Legacy wrapper
    s, _ = simulate_strokes_for_entry_with_stats(entry, hole, round_number)
    return s

