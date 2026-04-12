def register_client(client, email: str = "shopper@test.com"):
    payload = {
        "first_name": "Shop",
        "last_name": "User",
        "email": email,
        "phone_number": "+12345678912",
        "city": "Paris",
        "age": 27,
        "type": "client",
        "password": "Client@12345",
    }
    return client.post("/register", json=payload)


def login(client, email: str, password: str):
    return client.post("/login", json={"email": email, "password": password})


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_products_public_list_and_admin_create(client):
    public_list = client.get("/products")
    assert public_list.status_code == 200
    assert public_list.json()["total"] >= 2

    admin_login = login(client, "admin@test.com", "Admin@12345")
    admin_token = admin_login.json()["access_token"]

    create_payload = {
        "name": "Titan DDR5 32GB Kit",
        "capacity_gb": 32,
        "memory_type": "DDR5",
        "speed_mhz": 6000,
        "price": 149.99,
        "stock": 10,
        "description": "High-end dual-channel kit",
        "is_active": True,
    }

    created = client.post("/products", json=create_payload, headers=auth_headers(admin_token))
    assert created.status_code == 201
    assert created.json()["name"] == "Titan DDR5 32GB Kit"


def test_client_can_place_order_and_admin_can_update_status(client):
    register_client(client)

    client_login = login(client, "shopper@test.com", "Client@12345")
    admin_login = login(client, "admin@test.com", "Admin@12345")

    client_token = client_login.json()["access_token"]
    admin_token = admin_login.json()["access_token"]

    products = client.get("/products")
    product_id = products.json()["items"][0]["id"]

    quote_payload = {
        "city": "Paris",
        "items": [{"product_id": product_id, "quantity": 2}],
    }
    quote = client.post("/orders/quote", json=quote_payload, headers=auth_headers(client_token))
    assert quote.status_code == 200
    assert quote.json()["item_count"] == 2
    assert quote.json()["total_amount"] >= quote.json()["subtotal"]

    order_payload = {
        "city": "Paris",
        "items": [{"product_id": product_id, "quantity": 1}],
    }

    create_order = client.post("/orders", json=order_payload, headers=auth_headers(client_token))
    assert create_order.status_code == 201
    order_id = create_order.json()["id"]

    summary = client.get(f"/orders/{order_id}/summary", headers=auth_headers(client_token))
    assert summary.status_code == 200
    assert summary.json()["item_count"] >= 1
    assert summary.json()["total_amount"] >= summary.json()["subtotal"]

    my_orders = client.get("/orders/me", headers=auth_headers(client_token))
    assert my_orders.status_code == 200
    assert len(my_orders.json()) >= 1

    admin_orders = client.get("/orders", headers=auth_headers(admin_token))
    assert admin_orders.status_code == 200
    assert admin_orders.json()["total"] >= 1

    update_status = client.put(
        f"/orders/{order_id}/status",
        json={"status": "processing"},
        headers=auth_headers(admin_token),
    )
    assert update_status.status_code == 200
    assert update_status.json()["status"] == "processing"

    admin_summary = client.get(f"/orders/{order_id}/summary", headers=auth_headers(admin_token))
    assert admin_summary.status_code == 200


def test_client_cannot_access_admin_product_route(client):
    register_client(client)
    client_login = login(client, "shopper@test.com", "Client@12345")
    client_token = client_login.json()["access_token"]

    payload = {
        "name": "Blocked Product",
        "capacity_gb": 8,
        "memory_type": "DDR4",
        "speed_mhz": 3000,
        "price": 29.99,
        "stock": 5,
        "description": "Should fail",
        "is_active": True,
    }

    forbidden = client.post("/products", json=payload, headers=auth_headers(client_token))
    assert forbidden.status_code == 403


def test_order_amount_breakdown_is_consistent(client):
    register_client(client, email="totals@test.com")

    client_login = login(client, "totals@test.com", "Client@12345")
    client_token = client_login.json()["access_token"]

    products = client.get("/products")
    product = products.json()["items"][0]

    payload = {
        "city": "Paris",
        "items": [{"product_id": product["id"], "quantity": 1}],
    }

    quote = client.post("/orders/quote", json=payload, headers=auth_headers(client_token))
    assert quote.status_code == 200
    quote_data = quote.json()
    assert round(quote_data["subtotal"] + quote_data["tax_amount"] + quote_data["shipping_amount"], 2) == round(
        quote_data["total_amount"], 2
    )

    created = client.post("/orders", json=payload, headers=auth_headers(client_token))
    assert created.status_code == 201
    created_data = created.json()
    assert round(
        created_data["subtotal_amount"] + created_data["tax_amount"] + created_data["shipping_amount"],
        2,
    ) == round(created_data["total_amount"], 2)

    summary = client.get(f"/orders/{created_data['id']}/summary", headers=auth_headers(client_token))
    assert summary.status_code == 200
    summary_data = summary.json()
    assert round(summary_data["subtotal"] + summary_data["tax_amount"] + summary_data["shipping_amount"], 2) == round(
        summary_data["total_amount"],
        2,
    )


def test_order_with_insufficient_stock_returns_conflict(client):
    register_client(client, email="stock@test.com")

    client_login = login(client, "stock@test.com", "Client@12345")
    client_token = client_login.json()["access_token"]

    products = client.get("/products")
    product = products.json()["items"][0]

    payload = {
        "city": "Paris",
        "items": [{"product_id": product["id"], "quantity": product["stock"] + 1}],
    }

    quote = client.post("/orders/quote", json=payload, headers=auth_headers(client_token))
    assert quote.status_code == 409
    assert quote.json()["error"]["code"] == "http_409"
