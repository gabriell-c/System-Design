"""Ownership (owner_id), token_version, password_reset_codes, analysis_fingerprint.

Revision ID: 0006_ownership
Revises: 0005_excalidraw_elements
Create Date: 2026-11-04
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_ownership"
down_revision: str | None = "0005_excalidraw_elements"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _oldest_user_id() -> int | None:
    """Deterministic backfill target: oldest user in the DB (or None)."""
    bind = op.get_bind()
    row = bind.execute(sa.text("SELECT id FROM users ORDER BY id ASC LIMIT 1")).first()
    return int(row[0]) if row else None


def upgrade() -> None:
    oldest = _oldest_user_id()

    # owner_id adicionado como NULLABLE primeiro para permitir backfill,
    # depois tornado NOT NULL quando há dono para atribuir.
    for table in ("projects", "graphs"):
        with op.batch_alter_table(table) as batch:
            batch.add_column(
                sa.Column(
                    "owner_id",
                    sa.Integer(),
                    sa.ForeignKey("users.id", ondelete="CASCADE"),
                    nullable=True,
                )
            )

    if oldest is not None:
        op.execute(
            sa.text("UPDATE projects SET owner_id = :oid WHERE owner_id IS NULL"),
            {"oid": oldest},
        )
        op.execute(
            sa.text("UPDATE graphs SET owner_id = :oid WHERE owner_id IS NULL"),
            {"oid": oldest},
        )
        for table in ("projects", "graphs"):
            with op.batch_alter_table(table) as batch:
                batch.alter_column("owner_id", nullable=False)
    # Se não há usuários no banco, não há para quem atribuir dono: coluna fica
    # NULLABLE (novas linhas sempre terão dono definido pelas rotas).

    with op.batch_alter_table("graphs") as batch:
        batch.add_column(
            sa.Column("analysis_fingerprint", sa.String(length=64), nullable=True)
        )

    op.add_column(
        "users",
        sa.Column(
            "token_version",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )

    op.create_table(
        "password_reset_codes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("phone", sa.String(length=32), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_password_reset_codes_user_id", "password_reset_codes", ["user_id"])
    op.create_index("ix_password_reset_codes_phone", "password_reset_codes", ["phone"])


def downgrade() -> None:
    op.drop_index("ix_password_reset_codes_phone", table_name="password_reset_codes")
    op.drop_index("ix_password_reset_codes_user_id", table_name="password_reset_codes")
    op.drop_table("password_reset_codes")
    op.drop_column("users", "token_version")
    with op.batch_alter_table("graphs") as batch:
        batch.drop_column("owner_id")
        batch.drop_column("analysis_fingerprint")
    with op.batch_alter_table("projects") as batch:
        batch.drop_column("owner_id")
