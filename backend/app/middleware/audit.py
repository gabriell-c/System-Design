"""Audit middleware — logs graph mutations for compliance."""

from __future__ import annotations

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
            user_email = "anonymous"
            auth_header = request.headers.get("authorization", "")
            session_cookie = request.cookies.get("archia_session")
            token: str | None = None
            if session_cookie:
                token = session_cookie
            elif auth_header.startswith("Bearer "):
                token = auth_header[7:].strip() or None

            if token:
                try:
                    from app.auth import decode_token
                    from app.database import SessionLocal as _SL
                    from app.models.user import User as UserModel

                    payload = decode_token(token)
                    if payload:
                        uid = payload.get("sub")
                        email = payload.get("email")
                        if email:
                            user_email = str(email)
                        elif uid is not None:
                            udb = _SL()
                            try:
                                user = udb.query(UserModel).filter(UserModel.id == int(uid)).first()
                                user_email = user.email if user else str(uid)
                            finally:
                                udb.close()
                        else:
                            user_email = "authenticated"
                except Exception:
                    user_email = "authenticated"

            # Extract graph_id from path
            graph_id = None
            parts = request.url.path.strip("/").split("/")
            for i, part in enumerate(parts):
                if part == "graphs" and i + 1 < len(parts):
                    graph_id = parts[i + 1]
                    break

            if not graph_id:
                return response

            # Body already consumed by ASGI stack; log metadata only here.
            body_json: dict = {}

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
                    user_email=str(user_email),
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
