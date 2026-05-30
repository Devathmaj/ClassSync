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

        db = SessionLocal()
        # Check if the test user exists
        test_email = "testuser@classsync.com"
        user = db.query(User).filter(User.email == test_email).first()

        if not user:
            logger.info("Generating test user...")
            test_password = "password123"
            new_user = User(
                email=test_email,
                hashed_password=hash_password(test_password),
                full_name="Test User",
                is_active=True,
                is_verified=True,
                plan=PlanType.MAX
            )
            db.add(new_user)
            db.commit()
            logger.info(f"Test user generated. Email: {test_email}, Password: {test_password}")
        else:
            logger.info(f"Test user already exists: {test_email}")

    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        sys.exit(1)
    finally:
        if 'db' in locals():
            db.close()

if __name__ == "__main__":
    init_db()
