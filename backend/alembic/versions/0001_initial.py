"""Initial schema — Archia core tables.

Revision ID: 0001_initial
Revises:
Create Date: 2026-08-21
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=100), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="user"),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("birth_date", sa.DateTime(), nullable=True),
        sa.Column("auto_save_enabled", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("auto_save_interval_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sessions_token", "sessions", ["token"], unique=True)

    op.create_table(
        "projects",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("context", sa.Text(), nullable=False, server_default=""),
        sa.Column("nfr_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "graphs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("project_id", sa.String(length=36), sa.ForeignKey("projects.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("context_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("nfr_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("nodes_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("edges_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("analysis_json", sa.Text(), nullable=True),
        sa.Column("review_status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("reviewer_role", sa.String(length=16), nullable=True),
        sa.Column("owner_team", sa.String(length=80), nullable=True),
        sa.Column("diagram_kind", sa.String(length=32), nullable=True),
        sa.Column("parent_graph_id", sa.String(length=36), nullable=True),
        sa.Column("c4_parent_node_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "graph_versions",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("nodes_json", sa.Text(), nullable=False),
        sa.Column("edges_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "comments",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("node_id", sa.String(length=36), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=200), nullable=False),
        sa.Column("position_x", sa.Float(), nullable=True),
        sa.Column("position_y", sa.Float(), nullable=True),
        sa.Column("resolved", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("assignee", sa.String(length=200), nullable=True),
        sa.Column("mentions_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("thread_parent_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "simulation_scenarios",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_simulation_scenarios_graph_id", "simulation_scenarios", ["graph_id"])

    op.create_table(
        "audit_entries",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_email", sa.String(length=200), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("previous_state", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("new_state", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_entries_graph_id", "audit_entries", ["graph_id"])

    op.create_table(
        "graph_access",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("team", sa.String(length=80), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="read"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("graph_id", "team", name="uq_graph_access_graph_team"),
    )
    op.create_index("ix_graph_access_graph_id", "graph_access", ["graph_id"])
    op.create_index("ix_graph_access_team", "graph_access", ["team"])

    op.create_table(
        "graph_boundary_contracts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("graph_id", sa.String(length=36), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_zone", sa.String(length=100), nullable=False),
        sa.Column("target_zone", sa.String(length=100), nullable=False),
        sa.Column("protocol", sa.String(length=50), nullable=False, server_default="async"),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("sla_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_graph_boundary_contracts_graph_id", "graph_boundary_contracts", ["graph_id"])

    op.create_table(
        "ai_settings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("provider", sa.String(length=32), nullable=False, server_default="omniroute"),
        sa.Column("base_url", sa.String(length=500), nullable=False, server_default="http://localhost:20128/v1"),
        sa.Column("api_key", sa.Text(), nullable=False, server_default=""),
        sa.Column("model", sa.String(length=120), nullable=False, server_default="auto/coding"),
        sa.Column("enabled", sa.String(length=8), nullable=False, server_default="true"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ai_settings")
    op.drop_table("graph_boundary_contracts")
    op.drop_table("graph_access")
    op.drop_table("audit_entries")
    op.drop_table("simulation_scenarios")
    op.drop_table("comments")
    op.drop_table("graph_versions")
    op.drop_table("graphs")
    op.drop_table("projects")
    op.drop_table("sessions")
    op.drop_table("users")
