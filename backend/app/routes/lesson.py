from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from app.database import get_db
from app.models.user import User
from app.schemas.lesson import LessonCreate, LessonUpdate, LessonOut
from app.utils.auth import get_current_user
from app.services import lesson_service

router = APIRouter()

@router.get("/{timetable_id}/lessons", response_model=List[LessonOut])
def list_lessons(
    timetable_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lesson_service.get_lessons(timetable_id, db)

@router.post("/{timetable_id}/lessons", response_model=LessonOut, status_code=status.HTTP_201_CREATED)
def create_lesson(
    timetable_id: UUID,
    payload: LessonCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return lesson_service.create_lesson(timetable_id, payload, db)

@router.patch("/{timetable_id}/lessons/{lesson_id}", response_model=LessonOut)
def update_lesson(
    timetable_id: UUID,
    lesson_id: UUID,
    payload: LessonUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return lesson_service.update_lesson(timetable_id, lesson_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/{timetable_id}/lessons/{lesson_id}", response_model=LessonOut)
def replace_lesson(
    timetable_id: UUID,
    lesson_id: UUID,
    payload: LessonUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return lesson_service.update_lesson(timetable_id, lesson_id, payload.dict(exclude_unset=True), db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{timetable_id}/lessons/{lesson_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_lesson(
    timetable_id: UUID,
    lesson_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        lesson_service.delete_lesson(timetable_id, lesson_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
