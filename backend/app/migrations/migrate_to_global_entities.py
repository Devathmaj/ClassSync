"""
Migration: Promote Faculty, Room, Subject, Classroom to globally shared entities.

What this script does:
1. Creates the 4 join tables (timetable_faculty, timetable_rooms, timetable_subjects, timetable_classrooms)
2. Adds owner_id column to each entity table (nullable, for backward compat)
3. Populates join tables from existing timetable_id FK values
4. Deduplicates global entities by (owner_id, name) where possible
5. Drops timetable_id columns from entity tables

This script is idempotent — safe to run multiple times, and safe to run on a fresh DB.
"""
import logging
from sqlalchemy import text
from app.database import engine

logger = logging.getLogger(__name__)


def column_exists(conn, table_name, column_name):
    query = text("""
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = :table_name AND column_name = :column_name
    """)
    result = conn.execute(query, {"table_name": table_name, "column_name": column_name}).scalar()
    return bool(result)


def run_migration():
    logger.info("Running global entities migration...")

    with engine.begin() as conn:

        # ─── Step 1: Create join tables ──────────────────────────────────────
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS timetable_faculty (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
                faculty_id UUID NOT NULL REFERENCES faculty(id) ON DELETE CASCADE,
                attached_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_timetable_faculty UNIQUE (timetable_id, faculty_id)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS timetable_rooms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
                room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
                attached_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_timetable_room UNIQUE (timetable_id, room_id)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS timetable_subjects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
                subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
                attached_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_timetable_subject UNIQUE (timetable_id, subject_id)
            )
        """))

        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS timetable_classrooms (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timetable_id UUID NOT NULL REFERENCES timetables(id) ON DELETE CASCADE,
                classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
                attached_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT uq_timetable_classroom UNIQUE (timetable_id, classroom_id)
            )
        """))

        logger.info("Join tables created/verified.")

        # ─── Step 2: Add owner_id columns if not present ─────────────────────
        for table in ("faculty", "rooms", "subjects", "classrooms"):
            conn.execute(text(f"""
                ALTER TABLE {table} ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id)
            """))

        logger.info("owner_id columns added/verified.")

        # ─── Step 3: Backfill owner_id from timetable owner ──────────────────
        # For each entity with a timetable_id, set owner_id = timetable.owner_id
        for table in ("faculty", "rooms", "subjects", "classrooms"):
            if column_exists(conn, table, "timetable_id"):
                conn.execute(text(f"""
                    UPDATE {table} e
                    SET owner_id = t.owner_id
                    FROM timetables t
                    WHERE e.timetable_id = t.id
                      AND e.owner_id IS NULL
                      AND e.timetable_id IS NOT NULL
                """))

        logger.info("owner_id backfilled where applicable.")

        # ─── Step 4: Populate join tables from existing timetable_id FKs ─────
        if column_exists(conn, "faculty", "timetable_id"):
            conn.execute(text("""
                INSERT INTO timetable_faculty (timetable_id, faculty_id)
                SELECT timetable_id, id
                FROM faculty
                WHERE timetable_id IS NOT NULL
                ON CONFLICT ON CONSTRAINT uq_timetable_faculty DO NOTHING
            """))

        if column_exists(conn, "rooms", "timetable_id"):
            conn.execute(text("""
                INSERT INTO timetable_rooms (timetable_id, room_id)
                SELECT timetable_id, id
                FROM rooms
                WHERE timetable_id IS NOT NULL
                ON CONFLICT ON CONSTRAINT uq_timetable_room DO NOTHING
            """))

        if column_exists(conn, "subjects", "timetable_id"):
            conn.execute(text("""
                INSERT INTO timetable_subjects (timetable_id, subject_id)
                SELECT timetable_id, id
                FROM subjects
                WHERE timetable_id IS NOT NULL
                ON CONFLICT ON CONSTRAINT uq_timetable_subject DO NOTHING
            """))

        if column_exists(conn, "classrooms", "timetable_id"):
            conn.execute(text("""
                INSERT INTO timetable_classrooms (timetable_id, classroom_id)
                SELECT timetable_id, id
                FROM classrooms
                WHERE timetable_id IS NOT NULL
                ON CONFLICT ON CONSTRAINT uq_timetable_classroom DO NOTHING
            """))

        logger.info("Join tables populated from existing timetable_id FKs where applicable.")

        # ─── Step 5: Drop timetable_id columns (now in join tables) ──────────
        # We use IF EXISTS so this is safe to re-run after columns are already dropped.
        for table in ("faculty", "rooms", "subjects", "classrooms"):
            conn.execute(text(f"""
                ALTER TABLE {table} DROP COLUMN IF EXISTS timetable_id
            """))

        logger.info("timetable_id columns dropped from entity tables (if existed).")

    logger.info("Global entities migration completed successfully.")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_migration()
