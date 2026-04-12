from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models import User
from app.schemas.stats import AverageAgeResponse, TopCitiesResponse, TopCityItem, TotalUsersResponse

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/count", response_model=TotalUsersResponse)
def total_users(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TotalUsersResponse:
    total = db.query(func.count(User.id)).scalar() or 0
    return TotalUsersResponse(total_users=total)


@router.get("/average-age", response_model=AverageAgeResponse)
def average_age(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AverageAgeResponse:
    avg_age = db.query(func.avg(User.age)).scalar()
    return AverageAgeResponse(average_age=round(float(avg_age), 2) if avg_age is not None else 0.0)


@router.get("/top-cities", response_model=TopCitiesResponse)
def top_cities(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TopCitiesResponse:
    rows = (
        db.query(User.city, func.count(User.id).label("count"))
        .group_by(User.city)
        .order_by(func.count(User.id).desc(), User.city.asc())
        .limit(3)
        .all()
    )
    return TopCitiesResponse(top_cities=[TopCityItem(city=city, count=count) for city, count in rows])
