from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db
from app.core.security import hash_password
from app.db.session import Base
from app.main import app
from app.models import Product, User, UserType


@pytest.fixture()
def client(tmp_path) -> Generator[TestClient, None, None]:
    db_file = tmp_path / "test.db"
    engine = create_engine(
        f"sqlite:///{db_file}",
        connect_args={"check_same_thread": False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        db = TestingSessionLocal()
        try:
            admin = User(
                first_name="System",
                last_name="Admin",
                email="admin@test.com",
                phone_number="+12345678901",
                city="HQ",
                age=30,
                type=UserType.admin,
                hashed_password=hash_password("Admin@12345"),
            )
            db.add(admin)

            db.add_all(
                [
                    Product(
                        name="Velocity DDR5 16GB",
                        capacity_gb=16,
                        memory_type="DDR5",
                        speed_mhz=5600,
                        price=79.99,
                        stock=20,
                        description="Creator-focused RAM kit",
                        is_active=True,
                    ),
                    Product(
                        name="Steady DDR4 16GB",
                        capacity_gb=16,
                        memory_type="DDR4",
                        speed_mhz=3200,
                        price=49.99,
                        stock=30,
                        description="Budget RAM kit",
                        is_active=True,
                    ),
                ]
            )
            db.commit()
        finally:
            db.close()

        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
