def normalize_time(value: str) -> str:
    """Normalize HTML time input values to HH:MM."""
    if not value:
        return "09:00"
    parts = value.strip().split(":")
    hours = int(parts[0]) if parts[0] else 0
    minutes = int(parts[1]) if len(parts) > 1 and parts[1] else 0
    return f"{hours:02d}:{minutes:02d}"
