from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin
from app.core.security import hash_password
from app.models import User, UserType
from app.schemas.users import UserResponse, UserUpdate, UsersPage

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=UsersPage)
def get_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    age: int | None = Query(default=None, gt=0),
    city: str | None = None,
    type: UserType | None = None,
    name: str | None = None,
) -> UsersPage:
    query = db.query(User)

    if age is not None:
        query = query.filter(User.age == age)
    if city:
        query = query.filter(func.lower(User.city).contains(city.lower().strip()))
    if type:
        query = query.filter(User.type == type)
    if name:
        lowered = name.lower().strip()
        query = query.filter(
            func.lower(User.first_name).contains(lowered) | func.lower(User.last_name).contains(lowered)
        )

    total = query.count()
    users = query.order_by(User.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return UsersPage(items=users, total=total, page=page, limit=limit)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: UserUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    payload_data = payload.model_dump(exclude_unset=True)

    if "email" in payload_data and payload_data["email"] != user.email:
        email_exists = db.query(User).filter(User.email == payload_data["email"]).first()
        if email_exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    if "password" in payload_data:
        user.hashed_password = hash_password(payload_data.pop("password"))

    if "type" in payload_data and user.type == UserType.admin and payload_data["type"] != UserType.admin:
        admin_count = db.query(User).filter(User.type == UserType.admin).count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot demote the last admin user",
            )

    for key, value in payload_data.items():
        setattr(user, key, value)

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)) -> Response:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
