def register_client(client, email: str = "client@test.com"):
    payload = {
        "first_name": "Client",
        "last_name": "User",
        "email": email,
        "phone_number": "+12345678911",
        "city": "Berlin",
        "age": 25,
        "type": "client",
        "password": "Client@12345",
    }
    return client.post("/register", json=payload)


def login(client, email: str, password: str):
    return client.post("/login", json={"email": email, "password": password})


def auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_register_login_and_duplicate_email(client):
    register_response = register_client(client)
    assert register_response.status_code == 201

    duplicate_response = register_client(client)
    assert duplicate_response.status_code == 400

    login_response = login(client, "client@test.com", "Client@12345")
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()


def test_login_invalid_credentials_returns_401(client):
    register_client(client)

    invalid = login(client, "client@test.com", "WrongPassword123")
    assert invalid.status_code == 401


def test_register_admin_role_is_rejected(client):
    payload = {
        "first_name": "Eve",
        "last_name": "Escalation",
        "email": "eve-admin@test.com",
        "phone_number": "+12345678912",
        "city": "Berlin",
        "age": 28,
        "type": "admin",
        "password": "AdminTry@12345",
    }

    response = client.post("/register", json=payload)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "http_403"


def test_rbac_admin_can_list_users_client_cannot(client):
    register_client(client)

    admin_login = login(client, "admin@test.com", "Admin@12345")
    client_login = login(client, "client@test.com", "Client@12345")

    assert admin_login.status_code == 200
    assert client_login.status_code == 200

    admin_token = admin_login.json()["access_token"]
    client_token = client_login.json()["access_token"]

    admin_users = client.get("/users", headers=auth_headers(admin_token))
    assert admin_users.status_code == 200
    assert admin_users.json()["total"] >= 2

    client_users = client.get("/users", headers=auth_headers(client_token))
    assert client_users.status_code == 403


def test_stats_routes_require_auth(client):
    register_client(client)

    count_anon = client.get("/stats/count")
    avg_anon = client.get("/stats/average-age")
    cities_anon = client.get("/stats/top-cities")

    assert count_anon.status_code == 401
    assert avg_anon.status_code == 401
    assert cities_anon.status_code == 401

    client_login = login(client, "client@test.com", "Client@12345")
    assert client_login.status_code == 200
    client_token = client_login.json()["access_token"]
    client_headers = auth_headers(client_token)

    count = client.get("/stats/count", headers=client_headers)
    avg = client.get("/stats/average-age", headers=client_headers)
    cities = client.get("/stats/top-cities", headers=client_headers)

    assert count.status_code == 200
    assert avg.status_code == 200
    assert cities.status_code == 200

    assert "total_users" in count.json()
    assert "average_age" in avg.json()
    assert "top_cities" in cities.json()


def test_cannot_demote_last_admin(client):
    register_client(client)

    admin_login = login(client, "admin@test.com", "Admin@12345")
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    users_page = client.get("/users", headers=auth_headers(admin_token))
    assert users_page.status_code == 200

    admin_user = next(user for user in users_page.json()["items"] if user["email"] == "admin@test.com")
    demote = client.put(
        f"/users/{admin_user['id']}",
        json={"type": "client"},
        headers=auth_headers(admin_token),
    )

    assert demote.status_code == 409
    assert demote.json()["error"]["code"] == "http_409"


def test_validation_error_returns_standard_error_envelope(client):
    invalid_payload = {
        "first_name": "Client",
        "last_name": "User",
        "email": "not-an-email",
        "phone_number": "+12345678911",
        "city": "Berlin",
        "age": 25,
        "type": "client",
        "password": "Client@12345",
    }

    response = client.post("/register", json=invalid_payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_request_too_large_returns_standard_error_envelope(client):
    huge_password = "A" * (1_048_576 + 100)
    payload = {
        "first_name": "Client",
        "last_name": "User",
        "email": "huge@test.com",
        "phone_number": "+12345678911",
        "city": "Berlin",
        "age": 25,
        "type": "client",
        "password": huge_password,
    }

    response = client.post("/register", json=payload)
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "entity_too_large"
