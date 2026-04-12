from datetime import datetime

from pydantic import BaseModel, Field, PositiveInt, field_validator

from app.models import OrderStatus


class OrderItemCreate(BaseModel):
    product_id: PositiveInt
    quantity: PositiveInt


class OrderCreate(BaseModel):
    city: str = Field(min_length=1, max_length=100)
    items: list[OrderItemCreate] = Field(min_length=1)

    @field_validator("city")
    @classmethod
    def strip_city(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("NUL byte is not allowed")
        clean = value.strip()
        if not clean:
            raise ValueError("City cannot be empty")
        return clean


class OrderItemResponse(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    line_total: float


class OrderQuoteItemResponse(BaseModel):
    product_id: int
    product_name: str
    quantity: int
    unit_price: float
    line_total: float


class OrderQuoteResponse(BaseModel):
    city: str
    item_count: int
    subtotal: float
    tax_amount: float
    shipping_amount: float
    total_amount: float
    currency: str
    items: list[OrderQuoteItemResponse]


class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    subtotal_amount: float
    tax_amount: float
    shipping_amount: float
    total_amount: float
    city: str
    created_at: datetime
    items: list[OrderItemResponse]


class OrdersPage(BaseModel):
    items: list[OrderResponse]
    total: int
    page: int
    limit: int


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
