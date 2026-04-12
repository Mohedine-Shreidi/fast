from decimal import ROUND_HALF_UP, Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db, require_admin
from app.models import Order, OrderItem, OrderStatus, Product, User, UserType
from app.schemas.orders import (
    OrderCreate,
    OrderItemResponse,
    OrderQuoteItemResponse,
    OrderQuoteResponse,
    OrderResponse,
    OrdersPage,
    OrderStatusUpdate,
)

router = APIRouter(prefix="/orders", tags=["orders"])

TAX_RATE = Decimal("0.08")
SHIPPING_FLAT = Decimal("6.99")
FREE_SHIPPING_THRESHOLD = Decimal("200.00")
MONEY_QUANTUM = Decimal("0.01")
CURRENCY = "USD"


def money(value: Decimal) -> Decimal:
    return value.quantize(MONEY_QUANTUM, rounding=ROUND_HALF_UP)


def compute_totals(subtotal: Decimal) -> tuple[Decimal, Decimal, Decimal, Decimal]:
    normalized_subtotal = money(subtotal)
    tax_amount = money(normalized_subtotal * TAX_RATE)
    shipping_amount = Decimal("0.00") if normalized_subtotal >= FREE_SHIPPING_THRESHOLD else SHIPPING_FLAT
    shipping_amount = money(shipping_amount)
    total_amount = money(normalized_subtotal + tax_amount + shipping_amount)
    return normalized_subtotal, tax_amount, shipping_amount, total_amount


def aggregate_order_items(payload: OrderCreate) -> dict[int, int]:
    aggregated_quantities: dict[int, int] = {}
    for item in payload.items:
        aggregated_quantities[item.product_id] = aggregated_quantities.get(item.product_id, 0) + item.quantity
    return aggregated_quantities


def load_products(
    db: Session,
    product_ids: list[int],
    *,
    lock_products: bool,
) -> dict[int, Product]:
    query = db.query(Product).filter(Product.id.in_(product_ids), Product.is_active.is_(True))
    dialect_name = db.bind.dialect.name if db.bind is not None else ""
    if lock_products and dialect_name != "sqlite":
        query = query.with_for_update()
    products = query.all()
    return {product.id: product for product in products}


def build_quote_from_quantities(
    city: str,
    aggregated_quantities: dict[int, int],
    products_map: dict[int, Product],
) -> OrderQuoteResponse:
    missing = [product_id for product_id in aggregated_quantities if product_id not in products_map]
    if missing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Products not found: {missing}")

    subtotal = Decimal("0.00")
    quote_items: list[OrderQuoteItemResponse] = []
    item_count = 0

    for product_id, quantity in aggregated_quantities.items():
        product = products_map[product_id]
        if product.stock < quantity:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Insufficient stock for {product.name}",
            )

        line_total = money(product.price * quantity)
        subtotal += line_total
        item_count += quantity

        quote_items.append(
            OrderQuoteItemResponse(
                product_id=product.id,
                product_name=product.name,
                quantity=quantity,
                unit_price=float(money(product.price)),
                line_total=float(line_total),
            )
        )

    normalized_subtotal, tax_amount, shipping_amount, total_amount = compute_totals(subtotal)

    return OrderQuoteResponse(
        city=city,
        item_count=item_count,
        subtotal=float(normalized_subtotal),
        tax_amount=float(tax_amount),
        shipping_amount=float(shipping_amount),
        total_amount=float(total_amount),
        currency=CURRENCY,
        items=quote_items,
    )


def to_order_response(order: Order) -> OrderResponse:
    items = [
        OrderItemResponse(
            product_id=item.product_id,
            product_name=item.product.name if item.product else "Unknown product",
            quantity=item.quantity,
            unit_price=float(money(item.unit_price)),
            line_total=float(money(item.unit_price * item.quantity)),
        )
        for item in order.items
    ]

    return OrderResponse(
        id=order.id,
        user_id=order.user_id,
        status=order.status,
        subtotal_amount=float(money(order.subtotal_amount)),
        tax_amount=float(money(order.tax_amount)),
        shipping_amount=float(money(order.shipping_amount)),
        total_amount=float(money(order.total_amount)),
        city=order.city,
        created_at=order.created_at,
        items=items,
    )


def calculate_order_quote(
    payload: OrderCreate,
    db: Session,
    *,
    lock_products: bool = False,
) -> tuple[OrderQuoteResponse, dict[int, Product]]:
    aggregated_quantities = aggregate_order_items(payload)
    product_ids = list(aggregated_quantities.keys())
    products_map = load_products(db, product_ids, lock_products=lock_products)
    quote = build_quote_from_quantities(payload.city, aggregated_quantities, products_map)
    return quote, products_map


@router.post("/quote", response_model=OrderQuoteResponse)
def quote_order(
    payload: OrderCreate,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderQuoteResponse:
    quote, _ = calculate_order_quote(payload, db)
    return quote


@router.post("", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderResponse:
    try:
        quote, products_map = calculate_order_quote(payload, db, lock_products=True)
        aggregated_quantities = {item.product_id: item.quantity for item in quote.items}

        order = Order(
            user_id=current_user.id,
            status=OrderStatus.pending,
            subtotal_amount=money(Decimal(str(quote.subtotal))),
            tax_amount=money(Decimal(str(quote.tax_amount))),
            shipping_amount=money(Decimal(str(quote.shipping_amount))),
            total_amount=money(Decimal(str(quote.total_amount))),
            city=quote.city,
        )
        db.add(order)
        db.flush()

        for product_id, quantity in aggregated_quantities.items():
            product = products_map[product_id]
            product.stock -= quantity
            db.add(
                OrderItem(
                    order_id=order.id,
                    product_id=product.id,
                    quantity=quantity,
                    unit_price=money(product.price),
                )
            )

        db.commit()
    except HTTPException:
        db.rollback()
        raise

    created_order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order.id)
        .first()
    )

    if not created_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found after creation")

    return to_order_response(created_order)


@router.get("/{order_id}/summary", response_model=OrderQuoteResponse)
def get_order_summary(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderQuoteResponse:
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product), joinedload(Order.user))
        .filter(Order.id == order_id)
        .first()
    )

    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    is_admin = current_user.type == UserType.admin
    is_owner = order.user_id == current_user.id
    if not is_admin and not is_owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    subtotal = money(order.subtotal_amount)
    tax_amount = money(order.tax_amount)
    shipping_amount = money(order.shipping_amount)
    total_amount = money(order.total_amount)

    quote_items: list[OrderQuoteItemResponse] = []
    item_count = 0
    for item in order.items:
        line_total = item.unit_price * item.quantity
        item_count += item.quantity
        quote_items.append(
            OrderQuoteItemResponse(
                product_id=item.product_id,
                product_name=item.product.name if item.product else "Unknown product",
                quantity=item.quantity,
                unit_price=float(money(item.unit_price)),
                line_total=float(money(line_total)),
            )
        )

    return OrderQuoteResponse(
        city=order.city,
        item_count=item_count,
        subtotal=float(subtotal),
        tax_amount=float(tax_amount),
        shipping_amount=float(shipping_amount),
        total_amount=float(total_amount),
        currency=CURRENCY,
        items=quote_items,
    )


@router.get("/me", response_model=list[OrderResponse])
def list_my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrderResponse]:
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.user_id == current_user.id)
        .order_by(Order.id.desc())
        .all()
    )
    return [to_order_response(order) for order in orders]


@router.get("", response_model=OrdersPage)
def list_orders(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    status_filter: OrderStatus | None = Query(default=None, alias="status"),
) -> OrdersPage:
    query = db.query(Order)
    if status_filter:
        query = query.filter(Order.status == status_filter)

    total = query.count()
    orders = (
        query.options(joinedload(Order.items).joinedload(OrderItem.product))
        .order_by(Order.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return OrdersPage(items=[to_order_response(order) for order in orders], total=total, page=page, limit=limit)


@router.put("/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    payload: OrderStatusUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> OrderResponse:
    order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order.status = payload.status
    db.add(order)
    db.commit()
    db.refresh(order)

    refreshed_order = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.product))
        .filter(Order.id == order.id)
        .first()
    )
    if not refreshed_order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    return to_order_response(refreshed_order)
