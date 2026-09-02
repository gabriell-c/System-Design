"""P3.3.1 — WebSocket room for presence + Yjs CRDT sync + comment events."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("archia.ws")

router = APIRouter(tags=["collab"])

# graph_id -> set of websockets
_rooms: dict[str, set[WebSocket]] = {}
# websocket -> presence payload
_presence: dict[WebSocket, dict[str, Any]] = {}
# Main asyncio loop (set from app lifespan) for sync→async broadcast
_main_loop: asyncio.AbstractEventLoop | None = None


def set_main_loop(loop: asyncio.AbstractEventLoop | None) -> None:
    global _main_loop
    _main_loop = loop


async def _broadcast(graph_id: str, message: dict[str, Any], exclude: WebSocket | None = None) -> None:
    dead: list[WebSocket] = []
    for ws in list(_rooms.get(graph_id, set())):
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:  # noqa: BLE001
            dead.append(ws)
    for ws in dead:
        _rooms.get(graph_id, set()).discard(ws)
        _presence.pop(ws, None)


def broadcast_comment_event(graph_id: str, event: str, comment: dict[str, Any]) -> None:
    """Fire-and-forget comment event to all peers in the graph room (from sync routes)."""
    message = {"type": event, "comment": comment, "graphId": graph_id}
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_broadcast(graph_id, message))
        return
    except RuntimeError:
        pass
    if _main_loop is not None and _main_loop.is_running():
        asyncio.run_coroutine_threadsafe(_broadcast(graph_id, message), _main_loop)
        return
    logger.debug("ws_broadcast_skip no_loop graph=%s event=%s", graph_id, event)


def _peers(graph_id: str) -> list[dict[str, Any]]:
    peers: list[dict[str, Any]] = []
    for ws in _rooms.get(graph_id, set()):
        p = _presence.get(ws)
        if p:
            peers.append(p)
    return peers


@router.websocket("/api/v1/ws/graphs/{graph_id}")
async def graph_collab_ws(websocket: WebSocket, graph_id: str) -> None:
    await websocket.accept()
    room = _rooms.setdefault(graph_id, set())
    room.add(websocket)
    logger.info("ws_join graph=%s peers=%s", graph_id, len(room))

    try:
        await websocket.send_json({"type": "presence", "peers": _peers(graph_id)})
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            mtype = msg.get("type")
            if mtype == "hello":
                _presence[websocket] = {
                    "userId": str(msg.get("userId") or "anon"),
                    "displayName": str(msg.get("displayName") or "Anônimo"),
                    "color": str(msg.get("color") or "#6366f1"),
                    "cursor": msg.get("cursor"),
                    "lastSeen": msg.get("lastSeen") or 0,
                }
                await _broadcast(graph_id, {"type": "presence", "peers": _peers(graph_id)})
            elif mtype == "cursor":
                presence = _presence.get(websocket)
                if presence:
                    presence["cursor"] = {"x": msg.get("x"), "y": msg.get("y")}
                    presence["lastSeen"] = msg.get("lastSeen") or presence.get("lastSeen")
                await _broadcast(
                    graph_id,
                    {
                        "type": "cursor",
                        "userId": msg.get("userId"),
                        "x": msg.get("x"),
                        "y": msg.get("y"),
                    },
                    exclude=websocket,
                )
            elif mtype == "ydoc-update":
                await _broadcast(
                    graph_id,
                    {
                        "type": "ydoc-update",
                        "update": msg.get("update"),
                        "userId": msg.get("userId"),
                    },
                    exclude=websocket,
                )
            elif mtype == "ydoc-sync-request":
                await _broadcast(
                    graph_id,
                    {
                        "type": "ydoc-sync-request",
                        "userId": msg.get("userId"),
                    },
                    exclude=websocket,
                )
            elif mtype == "ydoc-sync-response":
                await _broadcast(
                    graph_id,
                    {
                        "type": "ydoc-sync-response",
                        "update": msg.get("update"),
                        "toUserId": msg.get("toUserId"),
                        "userId": msg.get("userId"),
                    },
                    exclude=websocket,
                )
            elif mtype in ("comment.created", "comment.updated", "comment.deleted"):
                await _broadcast(graph_id, msg, exclude=websocket)
    except WebSocketDisconnect:
        pass
    finally:
        room.discard(websocket)
        _presence.pop(websocket, None)
        if not room:
            _rooms.pop(graph_id, None)
        else:
            await _broadcast(graph_id, {"type": "presence", "peers": _peers(graph_id)})
        logger.info("ws_leave graph=%s peers=%s", graph_id, len(room))
