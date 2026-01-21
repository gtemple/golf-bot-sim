def hole_sequence(start_hole: int) -> list[int]:
    # e.g. start=1 -> [1..18]
    # start=10 -> [10..18, 1..9]
    return list(range(start_hole, 19)) + list(range(1, start_hole))

def next_hole(start_hole: int, holes_completed: int) -> int:
    seq = hole_sequence(start_hole)
    # holes_completed is how many holes already done, so next index
    return seq[holes_completed]
