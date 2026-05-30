from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import Base, engine
from app.middleware.logging import LoggingMiddleware
from app.routes import (
    auth,
    timetable,
    faculty,
    classroom,
    subject,
    lesson,
    room,
    constraint,
    generation,
    analytics,
    bell_schedule,
    timetable_entry,
)

# Create all tables
Base.metadata.create_all(bind=engine)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# Middleware
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────
app.include_router(auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["Auth"])

# ── Timetables (local entities) ───────────────────────────────────────────────
app.include_router(timetable.router, prefix=f"{settings.API_PREFIX}/timetables", tags=["Timetables"])
app.include_router(lesson.router, prefix=f"{settings.API_PREFIX}/timetables", tags=["Lessons"])
app.include_router(constraint.router, prefix=f"{settings.API_PREFIX}/timetables", tags=["Constraints"])
app.include_router(bell_schedule.router, prefix=f"{settings.API_PREFIX}", tags=["Bell Schedule"])
app.include_router(generation.router, prefix=f"{settings.API_PREFIX}/timetables", tags=["Generation"])
app.include_router(timetable_entry.router, prefix=f"{settings.API_PREFIX}/timetables", tags=["Timetable Entries"])

# ── Global Entity Catalogs ────────────────────────────────────────────────────
# These handle both:
#   - Global CRUD: GET/POST/PUT/DELETE /api/v1/{entity}
#   - Timetable attachment: GET/POST/DELETE /api/v1/timetables/{id}/{entity}/{entityId}
app.include_router(faculty.router, prefix=f"{settings.API_PREFIX}", tags=["Faculty"])
app.include_router(classroom.router, prefix=f"{settings.API_PREFIX}", tags=["Classrooms"])
app.include_router(subject.router, prefix=f"{settings.API_PREFIX}", tags=["Subjects"])
app.include_router(room.router, prefix=f"{settings.API_PREFIX}", tags=["Rooms"])

# ── Analytics ─────────────────────────────────────────────────────────────────
app.include_router(analytics.router, prefix=f"{settings.API_PREFIX}/analytics", tags=["Analytics"])


@app.get("/", tags=["Health"])
def root():
    return {"message": f"Welcome to {settings.APP_NAME} API", "version": settings.APP_VERSION}


@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
