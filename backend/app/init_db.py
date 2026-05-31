import logging
import sys
from sqlalchemy import text
from app.database import engine, Base, SessionLocal
from app.models.user import User, PlanType
from app.utils.auth import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    try:
        # Create all tables (new schema — join tables included)
        logger.info("Creating database tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully.")

        # Run the global entities migration (idempotent)
        from app.migrations.migrate_to_global_entities import run_migration
        run_migration()

        with engine.begin() as conn:
            # Compatibility migrations for existing dev databases.
            conn.execute(text("ALTER TABLE periods ALTER COLUMN start_time TYPE VARCHAR(8) USING start_time::text"))
            conn.execute(text("ALTER TABLE periods ALTER COLUMN end_time TYPE VARCHAR(8) USING end_time::text"))

            # Ensure organization_id is nullable on all entity tables
            for table in ("faculty", "classrooms", "subjects", "rooms"):
                conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN organization_id DROP NOT NULL"))

        # Check if the admin user exists, but we don't need to generate a testuser anymore
        # main.py startup event handles admin user creation.
        pass

    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        sys.exit(1)
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    init_db()
