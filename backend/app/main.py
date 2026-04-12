from datetime import datetime, timezone
import logging
import time
from uuid import uuid4

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes.auth import router as auth_router
from app.api.routes.orders import router as orders_router
from app.api.routes.products import router as products_router
from app.api.routes.stats import router as stats_router
from app.api.routes.users import router as users_router
from app.core.config import settings


def configure_logging() -> None:
    level_name = settings.LOG_LEVEL.strip().upper()
    level = getattr(logging, level_name, logging.INFO)
    root_logger = logging.getLogger()

    if not root_logger.handlers:
        logging.basicConfig(
            level=level,
            format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        )
    else:
        root_logger.setLevel(level)


configure_logging()
logger = logging.getLogger(__name__)


app = FastAPI(
    title="RAM Store Auth API",
    version="0.1.0",
)


def build_error_payload(
    code: str,
    message: str,
    details: object | None = None,
    request_id: str | None = None,
) -> dict[str, object]:
    payload: dict[str, object] = {
        "error": {
            "code": code,
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    }
    if details is not None:
        payload["error"]["details"] = details
    if request_id:
        payload["error"]["request_id"] = request_id
    return payload


@app.middleware("http")
async def request_observability_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid4())
    request.state.request_id = request_id
    started_at = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        if settings.LOG_REQUESTS:
            logger.exception(
                "request_failed method=%s path=%s request_id=%s",
                request.method,
                request.url.path,
                request_id,
            )
        raise

    elapsed_ms = (time.perf_counter() - started_at) * 1000
    response.headers["X-Request-ID"] = request_id

    if settings.LOG_REQUESTS:
        logger.info(
            "request_completed method=%s path=%s status=%s duration_ms=%.2f request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            request_id,
        )

    return response


@app.middleware("http")
async def enforce_request_size(request: Request, call_next):
    request_id = getattr(request.state, "request_id", None)
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > settings.MAX_REQUEST_SIZE_BYTES:
                return JSONResponse(
                    status_code=413,
                    content=build_error_payload(
                        code="entity_too_large",
                        message="Request body is too large",
                        details={"max_bytes": settings.MAX_REQUEST_SIZE_BYTES},
                        request_id=request_id,
                    ),
                )
        except ValueError:
            return JSONResponse(
                status_code=400,
                content=build_error_payload(
                    code="invalid_content_length",
                    message="Invalid Content-Length header",
                    request_id=request_id,
                ),
            )
    return await call_next(request)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    detail = exc.detail
    message = detail if isinstance(detail, str) else "Request failed"
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content=build_error_payload(
            code=f"http_{exc.status_code}",
            message=message,
            details=detail,
            request_id=request_id,
        ),
        headers=exc.headers,
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=422,
        content=build_error_payload(
            code="validation_error",
            message="Request validation failed",
            details=exc.errors(),
            request_id=request_id,
        ),
    )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    request_id = getattr(request.state, "request_id", None)
    logger.exception("Database operation failed request_id=%s", request_id, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content=build_error_payload(
            code="database_error",
            message="Database operation failed",
            request_id=request_id,
        ),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, __: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.exception("Unhandled server exception request_id=%s", request_id)
    return JSONResponse(
        status_code=500,
        content=build_error_payload(
            code="internal_server_error",
            message="An unexpected error occurred",
            request_id=request_id,
        ),
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(stats_router)
app.include_router(products_router)
app.include_router(orders_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
