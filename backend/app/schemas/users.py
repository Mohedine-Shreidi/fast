from pydantic import BaseModel, EmailStr, Field, PositiveInt, field_validator

from app.models import UserType

PHONE_PATTERN = r"^\+?[1-9]\d{9,14}$"


class UserBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone_number: str = Field(pattern=PHONE_PATTERN)
    city: str = Field(min_length=1, max_length=100)
    age: PositiveInt
    type: UserType

    @field_validator("first_name", "last_name", "city")
    @classmethod
    def strip_non_empty(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        if not clean:
            raise ValueError("Value cannot be empty")
        return clean

    @field_validator("phone_number")
    @classmethod
    def reject_nul_in_phone(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        return value


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone_number: str | None = Field(default=None, pattern=PHONE_PATTERN)
    city: str | None = Field(default=None, min_length=1, max_length=100)
    age: PositiveInt | None = None
    type: UserType | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("first_name", "last_name", "city")
    @classmethod
    def strip_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        if not clean:
            raise ValueError("Value cannot be empty")
        return clean

    @field_validator("phone_number")
    @classmethod
    def reject_nul_in_optional_phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        return value


class UserResponse(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: EmailStr
    phone_number: str
    city: str
    age: int
    type: UserType

    model_config = {"from_attributes": True}


class UsersPage(BaseModel):
    items: list[UserResponse]
    total: int
    page: int
    limit: int
