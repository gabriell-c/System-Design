"""Audit middleware — logs graph mutations for compliance."""

from __future__ import annotations

import json

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.database import SessionLocal


class AuditMiddleware(BaseHTTPMiddleware):
    """Middleware that captures graph mutations and writes audit entries."""

    # Paths we care about
    MUTATION_PATHS = {
        "/api/v1/graphs",
        "/api/v1/graphs/",
        "/graphs/",
    }

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Only log mutations
        if request.method not in ("POST", "PUT", "PATCH", "DELETE"):
            return await call_next(request)

        # Skip non-graph paths
        if not any(request.url.path.startswith(p) for p in self.MUTATION_PATHS):
            return await call_next(request)

        # Fast path: let the request go through first
        response = await call_next(request)

        # Only log successful mutations
        if response.status_code not in (200, 201, 204):
            return response

        try:
            # Extract user email from Authorization header (simple Bearer token parse)
            auth_header = request.headers.get("authorization", "")
            user_email = "anonymous"
            if auth_header.startswith("Bearer "):
                auth_header[7:]
                # For now, skip token decode — the route handlers set the user
                # We'll rely on route-level audit calls for accurate user info

            # Extract graph_id from path
            graph_id = None
            parts = request.url.path.strip("/").split("/")
            for i, part in enumerate(parts):
                if part == "graphs" and i + 1 < len(parts):
                    graph_id = parts[i + 1]
                    break

            if not graph_id:
                return response

            # Read body for state diff
            body = await request.body()
            body_str = body.decode("utf-8") if body else "{}"
            try:
                body_json = json.loads(body_str)
            except json.JSONDecodeError:
                body_json = {}

            # Create audit entry
            from app.services.audit import AuditLogService
            db = SessionLocal()
            try:
                service = AuditLogService(db)
                action = request.method.lower()
                if request.method == "DELETE":
                    action = "delete"
                elif request.method == "PUT":
                    action = "update"
                elif request.method == "POST":
                    if "/analyze" in request.url.path:
                        action = "analyze"
                    else:
                        action = "create"

                service.log(
                    graph_id=graph_id,
                    user_email=user_email,
                    action=action,
                    entity_type="graph",
                    entity_id=graph_id,
                    previous_state={},
                    new_state=body_json,
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                )
            finally:
                db.close()

        except Exception:
            # Never let audit logging break the app
            pass

        return response
