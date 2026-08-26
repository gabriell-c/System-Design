"""Structured JSON logging + request correlation ID."""

from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

correlation_id_ctx: ContextVar[str] = ContextVar("correlation_id", default="-")


class CorrelationIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_ctx.get("-")  # type: ignore[attr-defined]
        return True


def configure_logging(*, level: str = "INFO", json_logs: bool = True) -> None:
    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level.upper())

    handler = logging.StreamHandler()
    handler.addFilter(CorrelationIdFilter())

    if json_logs:
        try:
            from pythonjsonlogger.jsonlog import JsonFormatter
        except ImportError:  # pragma: no cover
            from pythonjsonlogger.jsonlogger import (
                JsonFormatter,  # type: ignore[attr-defined]
            )

        formatter = JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s %(correlation_id)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s [%(correlation_id)s] %(name)s: %(message)s"
        )

    handler.setFormatter(formatter)
    root.addHandler(handler)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    header_name = "X-Request-ID"

    async def dispatch(self, request: Request, call_next) -> Response:
        cid = request.headers.get(self.header_name) or str(uuid.uuid4())
        token = correlation_id_ctx.set(cid)
        try:
            response = await call_next(request)
            response.headers[self.header_name] = cid
            return response
        finally:
            correlation_id_ctx.reset(token)


# Legacy path prefixes → /api/v1/... (Deprecation: true)
_LEGACY_PREFIXES = (
    "/auth",
    "/projects",
    "/profile",
    "/users",
)


class ApiVersionRewriteMiddleware(BaseHTTPMiddleware):
    """Rewrite legacy unversioned mounts to /api/v1 and stamp Deprecation."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.scope.get("path", "")
        rewritten = False
        for prefix in _LEGACY_PREFIXES:
            if path == prefix or path.startswith(prefix + "/"):
                request.scope["path"] = "/api/v1" + path
                rewritten = True
                break
        # Comments lived under /graphs/{id}/comments (without /api/v1)
        if not rewritten and path.startswith("/graphs/") and "/comments" in path:
            request.scope["path"] = "/api/v1" + path
            rewritten = True

        response = await call_next(request)
        if rewritten:
            response.headers["Deprecation"] = "true"
            response.headers["Sunset"] = "Sat, 01 Aug 2027 00:00:00 GMT"
            response.headers["Link"] = '</api/v1>; rel="successor-version"'
        return response
