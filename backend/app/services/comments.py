"""P1.4.2/P1.11 — @mentions parsing, notification hooks e moderação de comentários.

A moderação (editar/remover) é centralizada aqui para que as rotas de
comentários e anotações compartilhem a MESMA regra (autor, dono do grafo,
ou papel senior) em vez de cada rota reimplementar à mão.
"""

from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from app.models.graph import Comment, Graph
from app.models.user import User

logger = logging.getLogger("archia.comments")

MENTION_RE = re.compile(r"@([\w.+-]+@[\w.-]+\.\w+|[\w.-]+)")


def extract_mentions(text: str) -> list[str]:
    """Extract @mentions from comment text."""
    return list(dict.fromkeys(MENTION_RE.findall(text)))


def notify_mentions(mentions: list[str], graph_id: str, text: str) -> None:
    """Log mention notifications (hook for email/Slack integration)."""
    for mention in mentions:
        logger.info("mention graph=%s user=%s preview=%s", graph_id, mention, text[:80])


def _author_of(user: User) -> str:
    """Como as rotas gravam a autoria de um comentário (e-mail, ou 'anonymous')."""
    return user.email or "anonymous"


def can_moderate_comment(db: Session, user: User, graph: Graph, comment: Comment) -> bool:
    """P1.11 — quem pode editar/remover um comentário: o próprio autor, o dono
    do grafo, ou um papel senior/admin. Restrito a comentários deste grafo."""
    if comment.graph_id != graph.id:
        return False
    if getattr(comment, "author", None) == _author_of(user):
        return True
    if getattr(graph, "owner_id", None) == user.id:
        return True
    return getattr(user, "role", None) in ("senior", "admin")
