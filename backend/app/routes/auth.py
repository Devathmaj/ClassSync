from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import UserLogin, Token, TokenRefresh, UserOut, ChangeCredentials
from app.models.user import User
from app.utils.auth import get_current_user
from app.services import auth_service

router = APIRouter()

@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return JWT tokens."""
    try:
        data = auth_service.authenticate_user(payload, db)
        return Token(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            user=UserOut.from_orm(data["user"]),
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.post("/refresh", response_model=Token)
def refresh_token(payload: TokenRefresh, db: Session = Depends(get_db)):
    """Issue new tokens using a valid refresh token."""
    try:
        data = auth_service.refresh_user_token(payload, db)
        return Token(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            user=UserOut.from_orm(data["user"]),
        )
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.post("/change-credentials", response_model=Token)
def change_credentials(payload: ChangeCredentials, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Change username and password (forced on first login)."""
    try:
        data = auth_service.change_credentials(str(current_user.id), payload.username, payload.new_password, db)
        return Token(
            access_token=data["access_token"],
            refresh_token=data["refresh_token"],
            user=UserOut.from_orm(data["user"]),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
