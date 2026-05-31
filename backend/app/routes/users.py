from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, RoleType
from app.models.faculty import Faculty
from app.schemas.auth import UserCreate, UserOut, UserUpdate
from app.utils.auth import get_current_user, hash_password
from app.services import auth_service
from typing import List
from pydantic import BaseModel

router = APIRouter()

class HierarchyUser(BaseModel):
    id: str
    username: str
    full_name: str
    role: str
    faculty_count: int = 0
    faculty_list: List[dict] = []

    class Config:
        from_attributes = True

@router.get("/hierarchy")
def get_hierarchy(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role == RoleType.ADMIN:
        # Admin sees all institutions and their faculty
        institutions = db.query(User).filter(User.role == RoleType.INSTITUTION).all()
        result = []
        for inst in institutions:
            # Join Faculty with User to get username
            faculty_records = db.query(Faculty, User).join(User, Faculty.user_id == User.id).filter(Faculty.owner_id == inst.id).all()
            fac_list = [{
                "id": str(fac.user_id), 
                "full_name": fac.full_name, 
                "short_name": fac.short_name,
                "username": usr.username,
                "email": usr.email
            } for fac, usr in faculty_records]
            
            result.append({
                "id": str(inst.id),
                "username": inst.username,
                "full_name": inst.full_name,
                "email": inst.email,
                "role": inst.role,
                "faculty_count": len(fac_list),
                "faculty_list": fac_list
            })
        return result
    
    elif current_user.role == RoleType.INSTITUTION:
        # Institution sees their own account and their faculty
        faculty_records = db.query(Faculty, User).join(User, Faculty.user_id == User.id).filter(Faculty.owner_id == current_user.id).all()
        fac_list = [{
            "id": str(fac.user_id), 
            "full_name": fac.full_name, 
            "short_name": fac.short_name,
            "username": usr.username,
            "email": usr.email
        } for fac, usr in faculty_records]
        
        return [{
            "id": str(current_user.id),
            "username": current_user.username,
            "full_name": current_user.full_name,
            "email": current_user.email,
            "role": current_user.role,
            "faculty_count": len(fac_list),
            "faculty_list": fac_list
        }]
    
    return []

@router.post("/institution", response_model=UserOut)
def create_institution(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role != RoleType.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can create institutions")
    
    payload.role = RoleType.INSTITUTION
    try:
        data = auth_service.register_user(payload, db)
        return data["user"]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/faculty", response_model=UserOut)
def create_faculty_user(payload: UserCreate, institution_id: str = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in [RoleType.ADMIN, RoleType.INSTITUTION]:
        raise HTTPException(status_code=403, detail="Not authorized to create faculty")
    
    if current_user.role == RoleType.INSTITUTION:
        target_owner_id = current_user.id
    else:
        if not institution_id:
            raise HTTPException(status_code=400, detail="Institution ID required when admin creates faculty")
        target_owner_id = institution_id

    payload.role = RoleType.FACULTY
    try:
        data = auth_service.register_user(payload, db)
        new_user = data["user"]
        
        # Create corresponding Faculty entry linked to the new user
        short_name = payload.full_name.split(" ")[0][:4].upper()
        faculty = Faculty(
            owner_id=target_owner_id,
            user_id=new_user.id,
            full_name=payload.full_name,
            short_name=short_name,
            email=payload.email
        )
        db.add(faculty)
        db.commit()
        
        return new_user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if current_user.role == RoleType.INSTITUTION:
        # Institutions can only edit their own faculties
        faculty = db.query(Faculty).filter(Faculty.user_id == user_id, Faculty.owner_id == current_user.id).first()
        if not faculty and target_user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this user")

    # Update fields
    if payload.username is not None:
        target_user.username = payload.username
    if payload.email is not None:
        target_user.email = payload.email
    if payload.full_name is not None:
        target_user.full_name = payload.full_name
    if payload.password is not None:
        target_user.hashed_password = hash_password(payload.password)
        
    # Also update faculty name if applicable
    if target_user.role == RoleType.FACULTY and payload.full_name is not None:
        faculty = db.query(Faculty).filter(Faculty.user_id == user_id).first()
        if faculty:
            faculty.full_name = payload.full_name
            faculty.short_name = payload.full_name.split(" ")[0][:4].upper()
            
    db.commit()
    db.refresh(target_user)
    return target_user

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if current_user.role == RoleType.FACULTY:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if current_user.role == RoleType.INSTITUTION:
        # Institutions can only delete their own faculties
        faculty = db.query(Faculty).filter(Faculty.user_id == user_id, Faculty.owner_id == current_user.id).first()
        if not faculty:
            raise HTTPException(status_code=403, detail="Not authorized to delete this user")

    # Delete associated faculty entry if it exists
    faculty = db.query(Faculty).filter(Faculty.user_id == user_id).first()
    if faculty:
        db.delete(faculty)

    db.delete(target_user)
    db.commit()
    return None
