"""Routes package — imports all routers."""
from app.routes import auth, timetable, faculty, classroom, subject, lesson, room, constraint, generation, analytics, bell_schedule, timetable_entry

__all__ = ["auth", "timetable", "faculty", "classroom", "subject", "lesson", "room", "constraint", "generation", "analytics", "bell_schedule", "timetable_entry"]
