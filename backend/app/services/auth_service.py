from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.auth import UserCreate, UserLogin, TokenRefresh
from app.utils.auth import hash_password, verify_password, create_access_token, create_refresh_token, decode_token

def register_user(payload: UserCreate, db: Session):
    if db.query(User).filter(User.email == payload.email).first():
        raise ValueError("Email already registered")
    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token_data = {"sub": str(user.id)}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": user,
    }

def authenticate_user(payload: UserLogin, db: Session):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise ValueError("Invalid credentials")
    token_data = {"sub": str(user.id)}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": user,
    }

def refresh_user_token(payload: TokenRefresh, db: Session):
    data = decode_token(payload.refresh_token)
    if data.get("type") != "refresh":
        raise ValueError("Not a refresh token")
    user = db.query(User).filter(User.id == data["sub"]).first()
    if not user:
        raise ValueError("User not found")
    token_data = {"sub": str(user.id)}
    return {
        "access_token": create_access_token(token_data),
        "refresh_token": create_refresh_token(token_data),
        "user": user,
    }
