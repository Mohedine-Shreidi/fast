from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.db.session import Base, SessionLocal, engine
from app.models import Product, User, UserType


def seed_admin(db: Session) -> None:
    admin_email = "admin@ramstore.com"
    admin_password = "Admin@12345"
    exists = db.query(User).filter(User.email == admin_email).first()
    if exists:
        updated = False

        if exists.type != UserType.admin:
            exists.type = UserType.admin
            updated = True

        if not verify_password(admin_password, exists.hashed_password):
            exists.hashed_password = hash_password(admin_password)
            updated = True

        if updated:
            db.add(exists)
            db.commit()
        return

    admin = User(
        first_name="System",
        last_name="Admin",
        email=admin_email,
        phone_number="+12345678901",
        city="HQ",
        age=30,
        type=UserType.admin,
        hashed_password=hash_password(admin_password),
    )
    db.add(admin)
    db.commit()


def seed_products(db: Session) -> None:
    seed_data = [
        {
            "name": "Velocity DDR5 16GB",
            "capacity_gb": 16,
            "memory_type": "DDR5",
            "speed_mhz": 5600,
            "price": 79.99,
            "stock": 20,
            "description": "Balanced performance for modern creator rigs.",
            "is_active": True,
        },
        {
            "name": "Titan DDR5 32GB Kit",
            "capacity_gb": 32,
            "memory_type": "DDR5",
            "speed_mhz": 6000,
            "price": 149.99,
            "stock": 15,
            "description": "Dual-channel high-speed kit for gaming and editing.",
            "is_active": True,
        },
        {
            "name": "Steady DDR4 16GB",
            "capacity_gb": 16,
            "memory_type": "DDR4",
            "speed_mhz": 3200,
            "price": 49.99,
            "stock": 30,
            "description": "Reliable value memory for budget builds.",
            "is_active": True,
        },
    ]

    for item in seed_data:
        exists = db.query(Product).filter(Product.name == item["name"]).first()
        if exists:
            updated = False

            # Keep seeded products usable for repeated smoke tests.
            if not exists.is_active:
                exists.is_active = True
                updated = True

            if exists.stock < item["stock"]:
                exists.stock = item["stock"]
                updated = True

            if updated:
                db.add(exists)
            continue
        db.add(Product(**item))

    db.commit()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    try:
        seed_admin(session)
        seed_products(session)
        print("Admin seed completed.")
    finally:
        session.close()
