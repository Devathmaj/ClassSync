from sqlalchemy.orm import Session
from uuid import UUID
from app.models.constraint import Constraint

def get_constraints(timetable_id: UUID, db: Session):
    return db.query(Constraint).filter(Constraint.timetable_id == timetable_id).all()

def create_constraint(timetable_id: UUID, payload_dict: dict, db: Session):
    c = Constraint(**payload_dict, timetable_id=timetable_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

def delete_constraint(timetable_id: UUID, constraint_id: UUID, db: Session):
    c = db.query(Constraint).filter(Constraint.id == constraint_id, Constraint.timetable_id == timetable_id).first()
    if not c:
        raise ValueError("Constraint not found")
    db.delete(c)
    db.commit()


def update_constraint(timetable_id: UUID, constraint_id: UUID, payload_dict: dict, db: Session):
    c = db.query(Constraint).filter(Constraint.id == constraint_id, Constraint.timetable_id == timetable_id).first()
    if not c:
        raise ValueError("Constraint not found")
    for field, value in payload_dict.items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return c
