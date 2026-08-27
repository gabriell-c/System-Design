"""Add project_kind to projects (architecture | free).

Revision ID: 0003_project_kind
Revises: 0002_project_fields
Create Date: 2026-08-25
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_project_kind"
down_revision: str | None = "0002_project_fields"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "project_kind",
            sa.String(length=20),
            nullable=False,
            server_default="architecture",
        ),
    )


def downgrade() -> None:
    op.drop_column("projects", "project_kind")
