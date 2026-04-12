from pydantic import BaseModel, Field, PositiveFloat, PositiveInt, field_validator


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    capacity_gb: PositiveInt
    memory_type: str = Field(min_length=4, max_length=20)
    speed_mhz: PositiveInt
    price: PositiveFloat
    stock: int = Field(ge=0)
    description: str | None = Field(default=None, max_length=800)
    is_active: bool = True

    @field_validator("name", "memory_type", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        if not clean:
            raise ValueError("Value cannot be empty")
        return clean

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        return clean or None

    @field_validator("memory_type")
    @classmethod
    def validate_memory_type(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"DDR4", "DDR5"}:
            raise ValueError("memory_type must be DDR4 or DDR5")
        return normalized


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    capacity_gb: PositiveInt | None = None
    memory_type: str | None = Field(default=None, min_length=4, max_length=20)
    speed_mhz: PositiveInt | None = None
    price: PositiveFloat | None = None
    stock: int | None = Field(default=None, ge=0)
    description: str | None = Field(default=None, max_length=800)
    is_active: bool | None = None

    @field_validator("name", "memory_type", mode="before")
    @classmethod
    def strip_optional_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        if not clean:
            raise ValueError("Value cannot be empty")
        return clean

    @field_validator("description")
    @classmethod
    def strip_optional_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        return clean or None

    @field_validator("memory_type")
    @classmethod
    def validate_optional_memory_type(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.upper()
        if normalized not in {"DDR4", "DDR5"}:
            raise ValueError("memory_type must be DDR4 or DDR5")
        return normalized


class ProductResponse(BaseModel):
    id: int
    name: str
    capacity_gb: int
    memory_type: str
    speed_mhz: int
    price: float
    stock: int
    description: str | None
    is_active: bool

    model_config = {"from_attributes": True}


class ProductsPage(BaseModel):
    items: list[ProductResponse]
    total: int
    page: int
    limit: int
