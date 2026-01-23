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


def _generate_commentary(par, strokes, stats, golfer_name):
    """
    Generates a play-by-play string based on the hole stats.
    Returns: (text, excitement_level)
    excitement_level: 0-10 integer
    """
    fir = stats.get("fir")
    gir = stats.get("gir")
    putts = stats.get("putts")
    dist = stats.get("drive_distance")
    
    score_diff = strokes - par
    excitement = 0
    
    # 1. Tee Shot
    tee_text = ""
    if par == 3:
        if gir:
            # Hole in one?
            if strokes == 1:
                tee_text = "HOLE IN ONE!!"
                excitement = 10
            elif strokes == 2: # Birdie
                tee_text = random.choice([
                    f"Sticks the tee shot close.",
                    f"Darts it in there tight.",
                ])
                excitement += 2
            else:
                tee_text = random.choice([
                    f"Sticks the tee shot on the green.",
                    f"Irons it right at the pin.",
                    f"Safe shot to the center of the green.",
                ])
        else:
            tee_text = random.choice([
                f"Misses the green from the tee.",
                f"Pulls it slightly into the rough.",
                f"Comes up short of the green.",
            ])
    else:
        # Par 4/5
        if fir is True:
            if dist > 320:
                tee_text = f"Monstrous drive {dist} yards down the middle."
                excitement += 1
            else:
                tee_text = random.choice([
                    f"Smoked a drive {dist} yards down the middle.",
                    f"Finds the short grass off the tee.",
                    f"Perfect position in the fairway.",
                    f"Launch codes enabled: {dist}y drive.",
                ])
        elif fir is False:
            tee_text = random.choice([
                f"Wayward drive into the rough.",
                f"Misses the fairway to the right.",
                f"Hooks it into trouble.",
                f"Drive finds the thick stuff.",
            ])
            
    # 2. Approach / Mid-hole
    app_text = ""
    if par > 3:
        if gir:
            if strokes <= par - 2: # Eagle/Albatross
                 app_text = "Incredible approach sets up a tap-in."
                 excitement += 4
            elif strokes == par - 1: # Birdie
                 app_text = random.choice([
                    "Knocks the approach stiff.",
                    "Great iron shot gives a birdie look.",
                 ])
                 excitement += 2
            else:
                 app_text = "Safely on in regulation."
        elif not gir and score_diff <= 0:
            # Missed green but saved par/birdie -> Scramble
            app_text = random.choice([
                "Missed the green but hit a great chip.",
                "Splash out from the bunker to close range.",
                "Brilliant recovery shot.",
            ])
            excitement += 2 # Scrambling is cool
        else:
            app_text = random.choice([
                "Approach misses the mark.",
                "Can't hold the green.",
                "Left in a tricky spot.",
            ])
            
    # 3. Putting / Result
    putt_text = ""
    if score_diff <= -2:
        putt_text = "Drains the eagle putt! Incredible!"
        excitement = 10
    elif score_diff == -1:
        putt_text = random.choice([
            "Rolls in the birdie putt!",
            "Dead center for birdie!",
            "Takes advantage with a red number.",
        ])
        excitement += 3 # Birdies are always good
    elif score_diff == 0:
        if putts == 1:
            putt_text = "Clutch par save with one putt."
            excitement += 1
        else:
            putt_text = "Two putts for a solid par."
    elif score_diff == 1:
        putt_text = "Lip out for par, taps in for bogey."
        if excitement > 0: excitement -= 1 # Keep it somewhat exciting if they drove well
    else:
        putt_text = "Rough finish to the hole."

    return (f"{tee_text} {app_text} {putt_text}", excitement)


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

    # 5. Weather Conditions (New)
    weather_penalty = 0.0
    tournament = entry.tournament
    # Need to access 'round_conditions' safely
    conds = getattr(tournament, "round_conditions", {}) or {}
    r_cond = conds.get(str(round_number)) or {}
    
    wind_mph = float(r_cond.get("wind_mph", 0))
    rain = r_cond.get("rain", "None")
    
    # Wind penalty
    if wind_mph > 5:
        # Wind affects ball striking and putting
        # 0.01 stroke per mph above 5?
        wind_factor = (wind_mph - 5.0) * 0.015 
        # Good weather handlers mitigate this
        weather_skill = float(n(golfer.weather_handling)) if golfer else 0.5
        weather_penalty += wind_factor * (1.5 - weather_skill) # 1.5 multiplier makes it harder for everyone

    # Rain penalty
    if rain == "Light":
        weather_penalty += 0.20 * (1.0 - (float(n(golfer.weather_handling)) if golfer else 0.5))
    elif rain == "Heavy":
        weather_penalty += 0.50 * (1.0 - (float(n(golfer.weather_handling)) if golfer else 0.5))

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
    
    # "Sunday Pressure" Mechanic
    # If Round 4 and Back 9 and In Contention
    pressure_penalty = 0.0
    if round_number == 4 and hole.number >= 10:
        # Check position. If human, never pressure? Or yes? Yes for realism.
        pos = getattr(entry, "position", 999) or 999
        if pos <= 5: # Top 5
             # Pressure is ON.
             # Players with Low Clutch (<0.7) get penalized.
             # Players with High Clutch (>0.85) get a boost.
             
             # Closer to lead = more intensity
             intensity = 1.0 if pos <= 3 else 0.5
             
             # Calculate penalty
             # Clutch 0.5 -> (0.75 - 0.5) = 0.25 (Positive = Worse score)
             # Clutch 0.9 -> (0.75 - 0.9) = -0.15 (Negative = Better score)
             pressure_penalty = (0.75 - clutch) * 0.6 * intensity

    expected = (
        par
        + diff
        + global_diff_penalty
        + rough_penalty
        + holding_penalty
        + hazard_penalty
        + bunker_penalty
        + putting_penalty
        + weather_penalty
        + skill_strokes
        + form
        + momentum
        + risk_mean
        + clutch_help
        + pressure_penalty
    )

    # Variance: higher volatility + lower consistency = wider spread
    base_sigma = 0.38 + (1.0 - consistency) * 0.35  # ~0.38..0.73
    sigma = base_sigma * _clamp(vol, 0.6, 2.0)
    sigma += risk * 0.06  # risk adds a bit of chaos
    
    # High pressure adds variance for everyone except the ice-cold clutchness
    if pressure_penalty > 0.05:
        sigma += 0.20

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
        if putts < 0: putts = 0 # Hole out from fairway
    else:
        # Missed GIR. 
        # Score 3 (Par 4, Birdie) -> Chip in (0 putt)
        # Score 4 (Par 4, Par) -> Chip + 1 putt
        # Score 5 (Par 4, Bogey) -> Chip + 2 putt
        # Score 6 -> Chip + 3 putt OR Chip-chip + 2 putt
        # Let's assume competent pros usually chip on in 1 shot from around green
        shots_around_green = 1 # The chip
        shots_to_reach_around = par - 2 # Drive + Approach(miss)
        
        # Total shots excluding putts = (Par-2) + 1 = Par - 1
        putts = strokes - (par - 1)
        if putts < 0: putts = 0 
        
    stats["putts"] = putts

    # Add play-by-play commentary
    # Now returns tuple (text, excitement)
    comm_text, excitement = _generate_commentary(par, strokes, stats, entry.display_name)
    stats["commentary"] = comm_text
    stats["excitement"] = excitement

    return strokes, stats


def simulate_strokes_for_entry(entry, hole: Hole, round_number: int) -> int:
    # Legacy wrapper
    s, _ = simulate_strokes_for_entry_with_stats(entry, hole, round_number)
    return s

