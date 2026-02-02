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
    # Update: Use actual hole_results to calculate score_to_par instead of fuzzy math
    
    course = tournament.course
    holes = list(course.holes.order_by('number'))
    par_map = {h.number: h.par for h in holes}
    
    # Get all hole results for active players (who made cut)
    # This is efficient because 'entries' are already filtered for cut=False
    entry_ids = [e.id for e in entries]
    
    # We can fetch all results in one go, but grouping them by entry_id in Python is easier
    # Or, we can iterate entries and use the prefetched `hole_results` (Django prefetch_related)
    # The ViewSet usually prefetches `hole_results`.
    
    active_players = []
    current_round = tournament.current_round
    total_holes = 4 * 18
    
    for e in entries:
        # 1. Calculate Score To Par EXACTLY
        # Use prefetched results if available, else query (should be prefetched)
        results = e.hole_results.all()
        
        strokes = 0
        par = 0
        completed_holes_count = 0
        
        for hr in results:
            strokes += hr.strokes
            par += par_map.get(hr.hole_number, 4)
            completed_holes_count += 1
            
        score_to_par = strokes - par
        
        # 2. Check Remaining Holes
        # If simulation is imperfect, `completed_holes_count` is the truth.
        remaining = total_holes - completed_holes_count
        if remaining < 0: remaining = 0
        
        # 3. Skill Rating
        overall = 75
        if e.is_human:
            overall = 92
        elif e.golfer:
            overall = e.golfer.overall
            
        skill_adj = 0.10 - 0.005 * (overall - 50)
        
        # 4. Expected Final Score
        exp_final = score_to_par + (remaining * skill_adj)
        
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
    SIMULATIONS = 2000 # Increased for better resolution
    
    # Sort by expected score
    active_players.sort(key=lambda x: x["exp"])
    
    # Widen the contender window slightly to capture "tied for lead" outliers
    leader_exp = active_players[0]["exp"]
    contenders = [p for p in active_players if p["exp"] < leader_exp + 15] # Widened from 12 to 15
    
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
