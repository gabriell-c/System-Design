"""Add graphs.share_token for read-only shareable links.

Revision ID: 0004_graphs_share_token
Revises: 0003_project_kind
Create Date: 2026-08-27
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_graphs_share_token"
down_revision: str | None = "0003_project_kind"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "graphs",
        sa.Column(
            "share_token",
            sa.String(length=64),
            nullable=True,
        ),
    )
    op.create_index(op.f("ix_graphs_share_token"), "graphs", ["share_token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_graphs_share_token"), table_name="graphs")
    op.drop_column("graphs", "share_token")
