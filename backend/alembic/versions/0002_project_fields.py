"""Add dashboard fields to projects + project_access ACL table.

Revision ID: 0002_project_fields
Revises: 0001_initial
Create Date: 2026-08-21
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0002_project_fields"
down_revision: str | None = "0001_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "projects",
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
    )
    op.add_column(
        "projects",
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "projects",
        sa.Column("archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "projects",
        sa.Column("pinned", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "projects",
        sa.Column("share_token", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_projects_share_token", "projects", ["share_token"], unique=True)

    op.create_table(
        "project_access",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "project_id",
            sa.String(length=36),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("email", sa.String(length=200), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="read"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_project_access_project_id", "project_access", ["project_id"])
    op.create_index("ix_project_access_email", "project_access", ["email"])


def downgrade() -> None:
    op.drop_index("ix_project_access_email", table_name="project_access")
    op.drop_index("ix_project_access_project_id", table_name="project_access")
    op.drop_table("project_access")
    op.drop_index("ix_projects_share_token", table_name="projects")
    op.drop_column("projects", "share_token")
    op.drop_column("projects", "pinned")
    op.drop_column("projects", "archived")
    op.drop_column("projects", "is_public")
    op.drop_column("projects", "description")
