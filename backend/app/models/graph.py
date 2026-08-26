import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def new_uuid() -> str:
    """Client-side PK — evita FlushError sob concorrência no SQLite."""
    return str(uuid.uuid4())


class Graph(Base):
    __tablename__ = "graphs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    context_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    nfr_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    nodes_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    edges_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    analysis_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    review_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewer_role: Mapped[str | None] = mapped_column(String(16), nullable=True)
    owner_team: Mapped[str | None] = mapped_column(String(80), nullable=True)
    diagram_kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    parent_graph_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    c4_parent_node_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project | None"] = relationship(back_populates="diagrams")
    versions: Mapped[list["GraphVersion"]] = relationship(
        back_populates="graph", cascade="all, delete-orphan", order_by="GraphVersion.created_at.desc()"
    )


class GraphVersion(Base):
    __tablename__ = "graph_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    nodes_json: Mapped[str] = mapped_column(Text, nullable=False)
    edges_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    graph: Mapped[Graph] = relationship(back_populates="versions")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    context: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    nfr_json: Mapped[str] = mapped_column(Text, nullable=False, default="{}")
    is_public: Mapped[bool] = mapped_column(default=False)
    archived: Mapped[bool] = mapped_column(default=False)
    pinned: Mapped[bool] = mapped_column(default=False)
    project_kind: Mapped[str] = mapped_column(String(20), nullable=False, default="architecture")
    share_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    diagrams: Mapped[list[Graph]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="Graph.created_at"
    )
    access_entries: Mapped[list["ProjectAccess"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectAccess(Base):
    """ACL por usuário em um projeto: read (só ver) ou full (editar/excluir)."""

    __tablename__ = "project_access"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="read")  # read | full
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    project: Mapped[Project] = relationship(back_populates="access_entries")


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"))
    node_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str] = mapped_column(String(200), nullable=False)
    position_x: Mapped[float | None] = mapped_column(nullable=True)
    position_y: Mapped[float | None] = mapped_column(nullable=True)
    resolved: Mapped[bool] = mapped_column(default=False)
    assignee: Mapped[str | None] = mapped_column(String(200), nullable=True)
    mentions_json: Mapped[str] = mapped_column(Text, default="[]")
    thread_parent_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SimulationScenario(Base):
    __tablename__ = "simulation_scenarios"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AuditEntry(Base):
    __tablename__ = "audit_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), index=True)
    user_email: Mapped[str] = mapped_column(String(200), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    previous_state: Mapped[str] = mapped_column(Text, default="{}")
    new_state: Mapped[str] = mapped_column(Text, default="{}")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GraphAccess(Base):
    """P2.2.3 — ACL por squad/owner_team em grafos.

    Um squad (ex: 'ads-team') pode ter permissões diferentes
    sobre o mesmo grafo: read, write ou admin.
    """
    __tablename__ = "graph_access"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), index=True)
    team: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="read")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GraphBoundaryContract(Base):
    """P2.2.2 — Contrato de borda entre subsystems (zonas).

    Define como dois subsystems se comunicam: protocolo, descrição, SLA.
    """
    __tablename__ = "graph_boundary_contracts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    graph_id: Mapped[str] = mapped_column(String(36), ForeignKey("graphs.id", ondelete="CASCADE"), index=True)
    source_zone: Mapped[str] = mapped_column(String(100), nullable=False)
    target_zone: Mapped[str] = mapped_column(String(100), nullable=False)
    protocol: Mapped[str] = mapped_column(String(50), nullable=False, default="async")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    sla_ms: Mapped[int | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
