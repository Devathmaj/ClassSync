"""
Conflict detection — checks for scheduling conflicts in timetable entries.
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.timetable_entry import TimetableEntry


def detect_conflicts(timetable_id: str, db: Session) -> List[Dict[str, Any]]:
    """
    Returns a list of conflicts found in the current timetable entries.
    Conflict types: faculty double-booked, room double-booked, class double-booked.
    """
    conflicts = []
    entries = db.query(TimetableEntry).filter(
        TimetableEntry.timetable_id == timetable_id
    ).all()

    # Group by (day, period, week)
    slot_map: Dict[tuple, List[TimetableEntry]] = {}
    for entry in entries:
        slot = (entry.day_of_week, entry.period_number, entry.week_number)
        slot_map.setdefault(slot, []).append(entry)

    for slot, slot_entries in slot_map.items():
        # Faculty conflicts
        faculty_ids = [e.faculty_id for e in slot_entries if e.faculty_id]
        if len(faculty_ids) != len(set(faculty_ids)):
            conflicts.append({"type": "faculty_conflict", "slot": slot})

        # Classroom conflicts
        class_ids = [e.classroom_id for e in slot_entries if e.classroom_id]
        if len(class_ids) != len(set(class_ids)):
            conflicts.append({"type": "classroom_conflict", "slot": slot})

        # Room conflicts
        room_ids = [e.room_id for e in slot_entries if e.room_id]
        if len(room_ids) != len(set(room_ids)):
            conflicts.append({"type": "room_conflict", "slot": slot})

    return conflicts
