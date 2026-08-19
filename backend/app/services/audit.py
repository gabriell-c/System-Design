"""P1.4.4 — Audit trail service for compliance and change tracking."""

from __future__ import annotations

import json
from datetime import datetime

from sqlalchemy import desc


class AuditLogService:
    """Service for creating and querying audit log entries."""

    def __init__(self, db):
        self.db = db

    def log(
        self,
        graph_id: str,
        user_email: str,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        previous_state: dict | None = None,
        new_state: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> None:
        """Create an audit log entry."""
        from app.models.graph import AuditEntry, new_uuid

        entry = AuditEntry(
            id=new_uuid(),
            graph_id=graph_id,
            user_email=user_email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            previous_state=json.dumps(previous_state or {}, ensure_ascii=False),
            new_state=json.dumps(new_state or {}, ensure_ascii=False),
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(entry)
        self.db.commit()

    def get_entries(
        self,
        graph_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AuditEntry]:
        """Get audit entries for a graph."""
        from app.models.graph import AuditEntry

        return (
            self.db.query(AuditEntry)
            .filter(AuditEntry.graph_id == graph_id)
            .order_by(desc(AuditEntry.created_at))
            .limit(limit)
            .offset(offset)
            .all()
        )

    def get_entries_count(self, graph_id: str) -> int:
        """Get total count of audit entries."""
        from app.models.graph import AuditEntry

        return self.db.query(AuditEntry).filter(AuditEntry.graph_id == graph_id).count()
