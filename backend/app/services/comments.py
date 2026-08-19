"""P1.4.2 — @mentions parsing and notification hooks."""

from __future__ import annotations

import logging
import re

logger = logging.getLogger("archia.comments")

MENTION_RE = re.compile(r"@([\w.+-]+@[\w.-]+\.\w+|[\w.-]+)")


def extract_mentions(text: str) -> list[str]:
    """Extract @mentions from comment text."""
    return list(dict.fromkeys(MENTION_RE.findall(text)))


def notify_mentions(mentions: list[str], graph_id: str, text: str) -> None:
    """Log mention notifications (hook for email/Slack integration)."""
    for mention in mentions:
        logger.info("mention graph=%s user=%s preview=%s", graph_id, mention, text[:80])
