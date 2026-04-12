"""order_money_breakdown

Revision ID: a9b7c2d0e1f2
Revises: d55a528fb65b
Create Date: 2026-04-12 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a9b7c2d0e1f2"
down_revision: Union[str, Sequence[str], None] = "d55a528fb65b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("orders")}

    if "subtotal_amount" not in columns:
        op.add_column("orders", sa.Column("subtotal_amount", sa.Numeric(10, 2), nullable=True))
    if "tax_amount" not in columns:
        op.add_column("orders", sa.Column("tax_amount", sa.Numeric(10, 2), nullable=True))
    if "shipping_amount" not in columns:
        op.add_column("orders", sa.Column("shipping_amount", sa.Numeric(10, 2), nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE orders
            SET
                subtotal_amount = total_amount,
                tax_amount = ROUND(total_amount * 0.08, 2),
                shipping_amount = CASE WHEN total_amount >= 200.00 THEN 0.00 ELSE 6.99 END,
                total_amount = ROUND(
                    total_amount
                    + ROUND(total_amount * 0.08, 2)
                    + CASE WHEN total_amount >= 200.00 THEN 0.00 ELSE 6.99 END,
                    2
                )
            """
        )
    )

    inspector = sa.inspect(bind)
    columns = {column["name"]: column for column in inspector.get_columns("orders")}

    if columns["subtotal_amount"]["nullable"]:
        op.alter_column(
            "orders",
            "subtotal_amount",
            existing_type=sa.Numeric(10, 2),
            existing_nullable=True,
            nullable=False,
        )
    if columns["tax_amount"]["nullable"]:
        op.alter_column(
            "orders",
            "tax_amount",
            existing_type=sa.Numeric(10, 2),
            existing_nullable=True,
            nullable=False,
        )
    if columns["shipping_amount"]["nullable"]:
        op.alter_column(
            "orders",
            "shipping_amount",
            existing_type=sa.Numeric(10, 2),
            existing_nullable=True,
            nullable=False,
        )


def downgrade() -> None:
    op.execute(sa.text("UPDATE orders SET total_amount = subtotal_amount"))
    op.drop_column("orders", "shipping_amount")
    op.drop_column("orders", "tax_amount")
    op.drop_column("orders", "subtotal_amount")
