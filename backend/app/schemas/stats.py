from pydantic import BaseModel


class TotalUsersResponse(BaseModel):
    total_users: int


class AverageAgeResponse(BaseModel):
    average_age: float


class TopCityItem(BaseModel):
    city: str
    count: int


class TopCitiesResponse(BaseModel):
    top_cities: list[TopCityItem]
