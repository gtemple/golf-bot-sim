def minutes_for_hole(par: int, group_size: int = 4) -> int:
    """
    PGA-ish pace guidance. For groups of four:
    Par 3 ~12 min, Par 4 ~16 min, Par 5 ~20 min. :contentReference[oaicite:3]{index=3}
    """
    if group_size >= 4:
        return {3: 12, 4: 16, 5: 20}.get(par, 16)
    # fallback for smaller groups
    return {3: 11, 4: 14, 5: 18}.get(par, 14)