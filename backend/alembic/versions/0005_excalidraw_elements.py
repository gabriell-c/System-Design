"""Add graphs.excalidraw_elements_json for storing Excalidraw scenes.

Revision ID: 0005_excalidraw_elements
Revises: 0004_graphs_share_token
Create Date: 2026-09-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_excalidraw_elements"
down_revision: str | None = "0004_graphs_share_token"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "graphs",
        sa.Column(
            "excalidraw_elements_json",
            sa.Text(),
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("graphs", "excalidraw_elements_json")
