from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.classroom import Classroom
from app.models.constraint import Constraint, ConstraintScope, ConstraintType
from app.models.lesson import Lesson
from app.models.room import Room
from app.models.bell_schedule import BellSchedule, Period
from app.models.timetable_entry import TimetableEntry
from app.models.timetable_entities import TimetableClassroom, TimetableRoom


@dataclass
class Slot:
    day: str
    period_number: int
    week_number: int
    start_time: str
    end_time: str


def _build_slots(schedule: BellSchedule) -> List[Slot]:
    ordered_periods = sorted(schedule.periods, key=lambda p: (p.order, p.name))
    non_break_periods = [p for p in ordered_periods if not p.is_break]

    if not non_break_periods:
        return []

    cycle_weeks = 1
    if schedule.schedule_type.value == "fortnightly":
        cycle_weeks = 2

    slots: List[Slot] = []
    for week in range(1, cycle_weeks + 1):
        for day in schedule.working_days:
            day_periods = [p for p in non_break_periods if p.day_of_week in (None, day)]
            for idx, period in enumerate(day_periods, start=1):
                slots.append(
                    Slot(
                        day=day,
                        period_number=idx,
                        week_number=week,
                        start_time=str(period.start_time),
                        end_time=str(period.end_time),
                    )
                )
    return slots


def _slot_key(slot: Slot) -> Tuple[str, int, int]:
    return (slot.day, slot.period_number, slot.week_number)


def _pair_key(slot: Slot) -> Tuple[str, int, int]:
    return (slot.day, slot.period_number, slot.week_number)


def _constraint_maps(constraints: List[Constraint]) -> Tuple[Set[Tuple[UUID, UUID, Optional[UUID]]], Set[Tuple[UUID, UUID, Optional[UUID]]], Dict[Optional[UUID], Set[str]], Dict[UUID, Set[str]]]:
    must_follow: Set[Tuple[UUID, UUID, Optional[UUID]]] = set()
    not_same_day: Set[Tuple[UUID, UUID, Optional[UUID]]] = set()
    first_period_teachers: Dict[Optional[UUID], Set[str]] = {}
    specific_days: Dict[UUID, Set[str]] = {}

    for c in constraints:
        if c.constraint_type == ConstraintType.FIRST_PERIOD_CLASS_TEACHER:
            scope_classroom = c.classroom_id if c.scope == ConstraintScope.CLASS else None
            if scope_classroom not in first_period_teachers:
                first_period_teachers[scope_classroom] = set()
            if c.days_of_week:
                for d in c.days_of_week:
                    first_period_teachers[scope_classroom].add(d)
            else:
                first_period_teachers[scope_classroom].add("ALL")
            continue
            
        if c.constraint_type == ConstraintType.SPECIFIC_DAYS_SUBJECT:
            if c.subject_a_id and c.days_of_week:
                if c.subject_a_id not in specific_days:
                    specific_days[c.subject_a_id] = set()
                specific_days[c.subject_a_id].update(c.days_of_week)
            continue

        if not c.subject_a_id or not c.subject_b_id:
            continue
            
        scope_classroom = c.classroom_id if c.scope == ConstraintScope.CLASS else None

        if c.constraint_type == ConstraintType.SUBJECT_SEQUENCE:
            must_follow.add((c.subject_a_id, c.subject_b_id, scope_classroom))
        elif c.constraint_type == ConstraintType.SAME_DAY_EXCLUSION:
            pair = (c.subject_a_id, c.subject_b_id, scope_classroom)
            rev_pair = (c.subject_b_id, c.subject_a_id, scope_classroom)
            not_same_day.add(pair)
            not_same_day.add(rev_pair)

    return must_follow, not_same_day, first_period_teachers, specific_days


def _classroom_for_lesson(lesson: Lesson) -> Optional[UUID]:
    return lesson.classroom_id


def generate_entries_for_timetable(db: Session, timetable_id: UUID) -> Tuple[List[TimetableEntry], float, List[dict]]:
    schedule = db.query(BellSchedule).filter(BellSchedule.timetable_id == timetable_id).first()
    if not schedule:
        raise ValueError("Bell schedule is required before generation")

    lessons = db.query(Lesson).filter(Lesson.timetable_id == timetable_id).all()
    constraints = db.query(Constraint).filter(Constraint.timetable_id == timetable_id).all()
    # Query classrooms and rooms via join tables (globally shared entities)
    classroom_links = db.query(TimetableClassroom).filter(TimetableClassroom.timetable_id == timetable_id).all()
    classrooms = [link.classroom for link in classroom_links]
    room_links = db.query(TimetableRoom).filter(TimetableRoom.timetable_id == timetable_id).all()
    rooms = [link.room for link in room_links]
    room_ids = [r.id for r in rooms]

    slots = _build_slots(schedule)
    if not slots:
        raise ValueError("No schedulable non-break periods found in bell schedule")

    # Clear previous generated entries before rebuilding.
    db.query(TimetableEntry).filter(TimetableEntry.timetable_id == timetable_id).delete()
    db.flush()

    import random

    must_follow, same_day_exclusion, first_period_teachers, specific_days = _constraint_maps(constraints)
    classroom_teacher_map = {
        c.id: c.class_teacher_id for c in classrooms if c.class_teacher_id is not None
    }

    # Group lessons by shared_group_id
    lesson_groups: List[List[Lesson]] = []
    group_map: Dict[str, List[Lesson]] = {}
    for lesson in lessons:
        if lesson.shared_group_id:
            group_map.setdefault(lesson.shared_group_id, []).append(lesson)
        else:
            lesson_groups.append([lesson])
            
    for group in group_map.values():
        lesson_groups.append(group)

    # ── Multi-attempt loop ────────────────────────────────────────────────
    MAX_ATTEMPTS = 10
    best_entries: List[TimetableEntry] = []
    best_warnings: List[dict] = []
    best_placed = -1

    for attempt in range(MAX_ATTEMPTS):
        # Fresh occupancy maps each attempt
        class_occ: Dict[Tuple[str, int, int], Set[UUID]] = {}
        faculty_occ: Dict[Tuple[str, int, int], Set[UUID]] = {}
        room_occ: Dict[Tuple[str, int, int], Set[UUID]] = {}
        class_subject_by_day: Dict[Tuple[UUID, str, int], Set[UUID]] = {}
        class_slot_subject: Dict[Tuple[UUID, str, int, int], UUID] = {}

        def is_free_group(slot: Slot, group: List[Lesson], candidate_room_id: Optional[UUID]) -> Tuple[bool, str]:
            key = _slot_key(slot)
            classroom_ids = [l.classroom_id for l in group if l.classroom_id]
            faculty_ids = set(f for l in group for f in l.faculty_ids)
            subject_ids = set(s for l in group for s in l.subject_ids)

            if candidate_room_id and candidate_room_id in room_occ.get(key, set()):
                return False, "Room already booked"

            for fid in faculty_ids:
                if fid in faculty_occ.get(key, set()):
                    return False, "Teacher already occupied"

            for cid in classroom_ids:
                if cid in class_occ.get(key, set()):
                    return False, "Classroom already occupied"

                day_key = (cid, slot.day, slot.week_number)
                day_subjects = class_subject_by_day.get(day_key, set())
                for subject_id in subject_ids:
                    if any((subject_id, s, cid) in same_day_exclusion or (subject_id, s, None) in same_day_exclusion for s in day_subjects):
                        return False, "Same subject excluded on the same day"
                        
                    if subject_id in specific_days:
                        if slot.day not in specific_days[subject_id]:
                            return False, f"Subject constrained to specific days (not {slot.day})"

                    prev_subject = class_slot_subject.get((cid, slot.day, slot.week_number, slot.period_number - 1))
                    if prev_subject:
                        if (subject_id, prev_subject, cid) in must_follow or (subject_id, prev_subject, None) in must_follow:
                            pass
                        elif any(a == subject_id and b != prev_subject and (scope in (None, cid)) for (a, b, scope) in must_follow):
                            return False, "Must-follow constraint violation"

                if slot.period_number == 1:
                    class_teacher_id = classroom_teacher_map.get(cid)
                    if class_teacher_id:
                        applies = False
                        if None in first_period_teachers:
                            if "ALL" in first_period_teachers[None] or slot.day in first_period_teachers[None]:
                                applies = True
                        if cid in first_period_teachers:
                            if "ALL" in first_period_teachers[cid] or slot.day in first_period_teachers[cid]:
                                applies = True
                        if applies and class_teacher_id not in faculty_ids:
                            return False, "1st period reserved for Class Teacher"

            return True, ""

        def reserve_group(slot: Slot, group: List[Lesson], candidate_room_id: Optional[UUID]) -> List[TimetableEntry]:
            key = _slot_key(slot)
            new_entries = []
            for lesson in group:
                classroom_id = _classroom_for_lesson(lesson)
                lesson_faculty_ids = lesson.faculty_ids
                subject_id = lesson.subject_ids[0] if lesson.subject_ids else None

                if classroom_id:
                    class_occ.setdefault(key, set()).add(classroom_id)

                for fid in lesson_faculty_ids:
                    faculty_occ.setdefault(key, set()).add(fid)

                if candidate_room_id:
                    room_occ.setdefault(key, set()).add(candidate_room_id)

                if classroom_id and subject_id:
                    class_subject_by_day.setdefault((classroom_id, slot.day, slot.week_number), set()).add(subject_id)
                    class_slot_subject[(classroom_id, slot.day, slot.week_number, slot.period_number)] = subject_id

                new_entries.append(TimetableEntry(
                    timetable_id=timetable_id,
                    lesson_id=lesson.id,
                    classroom_id=classroom_id,
                    faculty_id=lesson_faculty_ids[0] if lesson_faculty_ids else None,
                    subject_id=subject_id,
                    room_id=candidate_room_id,
                    day_of_week=slot.day,
                    period_number=slot.period_number,
                    week_number=slot.week_number,
                ))
            return new_entries

        # Class teacher first period placement pass
        entries: List[TimetableEntry] = []
        class_teacher_groups: Dict[UUID, List[List[Lesson]]] = {}
        
        for group in lesson_groups:
            for lesson in group:
                if not lesson.classroom_id:
                    continue
                class_teacher_id = classroom_teacher_map.get(lesson.classroom_id)
                if class_teacher_id and class_teacher_id in lesson.faculty_ids:
                    class_teacher_groups.setdefault(lesson.classroom_id, []).append(group)

        reserved_counts: Dict[UUID, int] = {}
        processed_groups_for_day = set()

        for classroom_id, c_groups in class_teacher_groups.items():
            teacher_id = classroom_teacher_map.get(classroom_id)
            if not teacher_id:
                continue
            for day in schedule.working_days:
                first_slot = next((s for s in slots if s.day == day and s.period_number == 1), None)
                if not first_slot:
                    continue
                if classroom_id in class_occ.get(_slot_key(first_slot), set()):
                    continue
                candidate_group = next(
                    (
                        g for g in c_groups
                        if reserved_counts.get(g[0].id, 0) < max(g[0].periods_per_week, 0)
                    ),
                    None,
                )
                if not candidate_group:
                    continue
                    
                group_key = (candidate_group[0].id, day)
                if group_key in processed_groups_for_day:
                    continue
                    
                ok, reason = is_free_group(first_slot, candidate_group, None)
                if not ok:
                    continue
                entries.extend(reserve_group(first_slot, candidate_group, None))
                reserved_counts[candidate_group[0].id] = reserved_counts.get(candidate_group[0].id, 0) + 1
                processed_groups_for_day.add(group_key)

        # Remaining placement — most constrained lessons first
        remaining_units: List[Tuple[List[Lesson], int]] = []
        for group in lesson_groups:
            base_lesson = group[0]
            already_reserved = reserved_counts.get(base_lesson.id, 0)
            remaining = max(base_lesson.periods_per_week - already_reserved, 0)
            for i in range(remaining):
                remaining_units.append((group, i))

        def lesson_weight(item: Tuple[List[Lesson], int]) -> Tuple[int, int, int, int]:
            group = item[0]
            base_lesson = group[0]
            constrained = 0
            if base_lesson.double_periods:
                constrained += 2
            
            faculty_count = len(set(f for l in group for f in l.faculty_ids))
            classroom_count = len(set(l.classroom_id for l in group if l.classroom_id))
            constrained += faculty_count + classroom_count

            # Day-restricted subjects have far fewer available slots and MUST be placed first
            day_restricted = 0
            for l in group:
                for sid in l.subject_ids:
                    if sid in specific_days:
                        allowed = len(specific_days[sid])
                        total_days = len(schedule.working_days)
                        day_restricted = max(day_restricted, total_days - allowed + 1)
                
            is_class_teacher = 0
            for l in group:
                if l.classroom_id and classroom_teacher_map.get(l.classroom_id) in l.faculty_ids:
                    is_class_teacher = 1
                    break
                
            return (-day_restricted, -is_class_teacher, -constrained, -base_lesson.periods_per_week)

        remaining_units.sort(key=lesson_weight)

        attempt_warnings: List[dict] = []

        for group, _ in remaining_units:
            base_lesson = group[0]
            candidate_slots = list(slots)
            random.shuffle(candidate_slots)
            
            if base_lesson.double_periods:
                slot_pairs = []
                grouped_slots: Dict[Tuple[str, int], List[Slot]] = {}
                for s in slots:
                    grouped_slots.setdefault((s.day, s.week_number), []).append(s)
                for dgroup in grouped_slots.values():
                    ordered = sorted(dgroup, key=lambda s: s.period_number)
                    for idx in range(len(ordered) - 1):
                        if ordered[idx + 1].period_number == ordered[idx].period_number + 1:
                            slot_pairs.append((ordered[idx], ordered[idx + 1]))

                random.shuffle(slot_pairs)

                placed = False
                last_reason = "No contiguous slots available"
                for s1, s2 in slot_pairs:
                    found_room = False
                    room_choice = None
                    for rid in room_ids:
                        ok1, r1 = is_free_group(s1, group, rid)
                        ok2, r2 = is_free_group(s2, group, rid)
                        if ok1 and ok2:
                            room_choice = rid
                            found_room = True
                            break
                        last_reason = r1 if not ok1 else r2

                    if not found_room:
                        ok1, r1 = is_free_group(s1, group, None)
                        ok2, r2 = is_free_group(s2, group, None)
                        if not (ok1 and ok2):
                            last_reason = r1 if not ok1 else r2
                            continue

                    entries.extend(reserve_group(s1, group, room_choice))
                    entries.extend(reserve_group(s2, group, room_choice))
                    placed = True
                    break
                if not placed:
                    attempt_warnings.append({"lesson_id": str(base_lesson.id), "reason": last_reason})
                    continue
            else:
                placed = False
                last_reason = "No available slots"
                for slot in candidate_slots:
                    found_room = False
                    room_choice = None
                    for rid in room_ids:
                        ok, r = is_free_group(slot, group, rid)
                        if ok:
                            room_choice = rid
                            found_room = True
                            break
                        last_reason = r

                    if not found_room:
                        ok, r = is_free_group(slot, group, None)
                        if not ok:
                            last_reason = r
                            continue

                    entries.extend(reserve_group(slot, group, room_choice))
                    placed = True
                    break
                if not placed:
                    attempt_warnings.append({"lesson_id": str(base_lesson.id), "reason": last_reason})
                    continue

        # Check if this attempt is the best so far
        if len(entries) > best_placed:
            best_placed = len(entries)
            best_entries = entries
            best_warnings = attempt_warnings

        # Perfect score — stop early
        if not attempt_warnings:
            break

    db.add_all(best_entries)
    db.flush()

    total_requested = sum(max(lesson.periods_per_week, 0) for lesson in lessons)
    placed_units = len(best_entries)
    score = 1.0 if total_requested == 0 else min(1.0, placed_units / max(total_requested, 1))
    return best_entries, score, best_warnings

