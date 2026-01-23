import random
import math
from typing import Dict
from django.db.models import Sum, Q
from apps.tournaments.models import Tournament, TournamentEntry
from apps.courses.models import Hole

def calculate_win_probabilities(tournament: Tournament) -> Dict[str, float]:
    """
    Monte Carlo simulation to estimate win probability for each player.
    Returns dict: {entry_id: probability (0.0 - 1.0)}
    """
    # 1. Gather meaningful entries (those who haven't missed cut / withdrawn)
    # If cut is applied, filter out cut players
    entries = tournament.entries.all()
    if tournament.cut_applied:
        entries = entries.filter(cut=False)
    
    # Pre-fetch needed data to avoid N+1 queries during loop setup
    # Actually we just need current score and 'skill' proxy.
    
    # We need "Score to Par". 
    # Since we don't store "Score to Par" on entry directly (calculated on frontend),
    # we need a way to get it. 
    # simpler: Use `tournament_strokes`.
    # BUT players might be on different holes.
    # Player A: -5 thru 12.
    # Player B: -4 thru 15.
    # We need "Projected Final Score" = Current Score To Par + Expected Score on Remaining.
    
    # Problem: `tournament_strokes` is raw strokes.
    # We need `current_score_to_par`.
    
    # Let's rebuild the score_to_par efficiently.
    # We know the course total par (e.g. 72).
    # If round 1, thru 12. Par so far is par(1)+...+par(12).
    # Score to par = strokes - par_so_far.
    
    course = tournament.course
    holes = list(course.holes.order_by('number'))
    pars = [h.par for h in holes] # 0-indexed, but hole 1 is index 0
    total_par_72 = sum(pars)
    
    active_players = []
    
    current_round = tournament.current_round
    
    # Helper to get par for holes 1..N
    # (Assuming standard start at 1 for simplicity in calc, split tees makes this harder but manageable)
    # We will assume "thru_hole" means 1..thru_hole for the *current* round.
    # Previous rounds are assumed complete (18 holes).
    
    par_thru_18 = sum(pars)
    
    for e in entries:
        # Calculate Current Score To Par
        # Past rounds:
        # We can sum hole_results minus pars? Expensive.
        # Approximation:
        # If we trust `tournament_strokes`:
        # Par Played = (Round-1) * 72 + Par(thru_hole)
        # Exception: Cut players (already filtered), WD.
        
        # Split tee logic:
        # If group started on 10?
        # This is getting complex for a quick sim.
        
        # Better heuristic: Use `today_to_par` + `total_to_par` logic if available.
        # We don't have it on the model.
        
        # Let's calculate Par Played for this entry.
        # Look at `hole_results`.
        # This is expensive.
        
        # Optimization:
        # Assuming `hole_results` is prefetched? It is in the ViewSet but maybe not here.
        # We will assume standard order (1..thru) for now.
        
        # Calculate 'Par So Far'
        # played_holes_count = (current_round - 1) * 18 + e.thru_hole
        # par_so_far = par_for_first_N_holes(played_holes_count)? 
        # No, repeated 18s.
        
        par_so_far = (current_round - 1) * par_thru_18
        
        # Current round par
        # If split tee and started on 10?
        # We don't know easily without looking at group.
        # Let's assume standard start for probability calculation simplicity.
        # It won't be off by more than 1-2 strokes usually.
        thru = e.thru_hole
        par_so_far += sum(pars[:thru])
        
        score_to_par = e.tournament_strokes - par_so_far
        
        # Calculate Remaining Holes
        # Total holes in tournament = 4 * 18 = 72
        # Holes remaining = 72 - ((current_round - 1)*18 + thru)
        total_holes = 4 * 18
        played_holes = (current_round - 1) * 18 + thru
        remaining = total_holes - played_holes
        
        if remaining < 0: remaining = 0
        
        # Skill rating (0.0 - 100.0) -> Expected strokes per hole vs Par
        # 100 skill (Scheffler) -> -0.05 strokes per hole (birdie machine)
        # 50 skill -> +0.10 strokes per hole
        # 0 skill -> +0.30 strokes per hole
        
        # This is a heuristic.
        # Overall ~90+ is elite.
        overall = 75
        if e.golfer:
            overall = e.golfer.overall
        
        # Skill factor: Map 50..100 to +0.10 .. -0.15
        # Linear interp
        # m = (-0.15 - 0.10) / (100 - 50) = -0.25 / 50 = -0.005
        # y - y1 = m(x - x1)
        # val = 0.10 + -0.005 * (overall - 50)
        skill_adj = 0.10 - 0.005 * (overall - 50)
        
        # Expected Final Score
        # Current To Par + (Remaining * Skill Adj)
        exp_final = score_to_par + (remaining * skill_adj)
        
        # Variance
        # Std dev per hole approx 0.45
        # Total variance = 0.45 * sqrt(remaining)
        sigma = 0.45 * math.sqrt(remaining) if remaining > 0 else 0.001
        
        active_players.append({
            "id": str(e.id),
            "exp": exp_final,
            "sigma": sigma,
            "wins": 0
        })
        
    if not active_players:
        return {}

    # 2. Run Simulations
    SIMULATIONS = 1000
    
    # Optimization: Filter out players who are mathematically eliminated?
    # e.g. if Exp + 3*Sigma < Best_Exp - 3*Best_Sigma
    # Let's keep it simple for now. 1000 iter is fast.
    
    # Sort by expected score to see who is relevant
    active_players.sort(key=lambda x: x["exp"])
    
    # Only simulate top 20? 
    # If someone is 20 strokes back, prob is 0.
    # Let's prune anyone > 15 strokes off the lead 'expected'.
    leader_exp = active_players[0]["exp"]
    contenders = [p for p in active_players if p["exp"] < leader_exp + 12]
    
    if not contenders:
        contenders = active_players[:5] # Fallback
        
    # Run
    for _ in range(SIMULATIONS):
        winner_score = 9999
        winners = []
        
        # Draw for each contender
        for p in contenders:
            score = random.gauss(p["exp"], p["sigma"])
            
            if score < winner_score:
                winner_score = score
                winners = [p]
            elif abs(score - winner_score) < 0.01: # Tie
                winners.append(p)
        
        # Assign wins
        # If tie, split the win? Or just giving to all?
        # Simple: 1 / len(winners)
        win_share = 1.0 / len(winners)
        for w in winners:
            w["wins"] += win_share

    # 3. Format results
    results = {}
    for p in contenders:
        prob = (p["wins"] / SIMULATIONS)
        if prob > 0.001: # Cutoff 0.1%
            results[p["id"]] = prob
            
    # Normalize if slightly off? No need.
    
    return results
