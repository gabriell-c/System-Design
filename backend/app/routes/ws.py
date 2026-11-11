"""Sala WebSocket de colaboração (contrato P2 plain-JSON) + rota legado de comentários.

P3.3.1 — o cliente de referência é `web/src/lib/collab.ts` (pacote P2, SEM Yjs).
Dois endpoints compartilham as mesmas salas por grafo (`_rooms`):

`/api/v1/ws/collab` — contrato P2:
- autenticação por cookie de sessão (`archia_session`, cookies de mesma origem
  viajam sozinhos no WebSocket); query param `?token=` Bearer é aceito para
  clientes de API/testes.
- o cliente manda `hello {type, graph_id}` SEM identidade declarada (P1.1
  anti-spoofing): a presença é 100% injetada pelo servidor
  (`user_id`/`user_name` do token autenticado).
- server → client: `hello-ack`, `snapshot` (ao entrar: estado da sala ou do DB),
  `state-update` (bridge dos pares), `presence`/`presence-update`.
- close codes (P2): 4001 = auth falhou; 4003 = sem acesso ao grafo / sala
  cheia / hello inválido. 4001/4003 são "permanentes" para o cliente (sem
  loop de reconexão); qualquer outro close ele trata como transitório.
- limites (P1.1): 20 peers por sala; mensagem > 64KB é DESCARTADA (log) sem
  fechar a conexão — o push coalescido do P2 carrega o estado completo do
  grafo, que pode legítima exceder 64KB em grafos grandes; fechar com 1009
  viraria loop de reconexão (1009 é "transitório" para o cliente P2).

`/api/v1/ws/graphs/{graph_id}` — rota legado ainda usada por
`CanvasComments.tsx` (eventos `comment.created/updated/deleted`, emitidos
pelas rotas REST via `broadcast_comment_event`). Mesma auth/limites; close
4001/4003 unificado. Protocolo Yjs (ydoc-*) e `cursor` foram removidos: sem
consumidor no front P2.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.database import SessionLocal
from app.models.graph import Graph
from app.models.user import User
from app.routes._graph_helpers import can_view_graph

logger = logging.getLogger("archia.ws")

router = APIRouter(tags=["collab"])

# graph_id -> set of websockets (salas compartilhadas entre /collab e a rota legado)
_rooms: dict[str, set[WebSocket]] = {}
# websocket -> payload de presença (identidade 100% do servidor — anti-spoofing)
_presence: dict[WebSocket, dict[str, Any]] = {}
# graph_id -> último state-update aceito (cache efêmero da sala; o DB é a fonte de verdade)
_room_state: dict[str, dict[str, Any]] = {}
# Main asyncio loop (set via app lifespan) para broadcast sync→async
_main_loop: asyncio.AbstractEventLoop | None = None

# P1.1 — limites de sala
MAX_WS_MESSAGE_BYTES = 64 * 1024  # 64KB por mensagem
MAX_PEERS_PER_ROOM = 20
SESSION_COOKIE_NAME = "archia_session"

# Close codes do contrato P2 (web/src/lib/collab.ts — PERMANENT_CLOSE_CODES)
WS_CLOSE_UNAUTHORIZED = 4001  # auth falhou
WS_CLOSE_FORBIDDEN = 4003  # sem acesso / sala cheia / hello inválido

# Campos que um state-update P2 pode carregar (diff nodes/edges/excalidraw + pass-through)
_STATE_FIELDS = ("nodes", "edges", "excalidraw_elements", "name", "analysis", "context", "nfr")


def _extract_ws_token(ws: WebSocket) -> str | None:
    """Token do handshake: Bearer no query param `token` ou cookie de sessão."""
    raw = ws.query_params.get("token") or ""
    if raw.lower().startswith("bearer "):
        raw = raw[7:]
    raw = raw.strip()
    if raw:
        return raw
    return ws.cookies.get(SESSION_COOKIE_NAME)


def _authenticate_websocket(ws: WebSocket, db: Session) -> User | None:
    """Resolve o usuário do WS; None se token ausente/inválido/revogado (P1.4)."""
    token = _extract_ws_token(ws)
    if not token:
        return None
    payload = decode_token(token)
    if not payload or payload.get("type", "access") != "access":
        return None
    user = db.get(User, int(payload.get("sub", 0)))
    if user is None:
        return None
    # P1.4 — token_version: token emitido antes de revogar a sessão fica inválido.
    if int(payload.get("tv", 0) or 0) != int(user.token_version or 0):
        return None
    return user


def set_main_loop(loop: asyncio.AbstractEventLoop | None) -> None:
    global _main_loop
    _main_loop = loop


def _json_dict(raw: str) -> dict[str, Any] | None:
    try:
        msg = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return msg if isinstance(msg, dict) else None


def _too_large(raw: str) -> bool:
    return len(raw.encode("utf-8")) > MAX_WS_MESSAGE_BYTES


def _safe_list(raw: str | None) -> list:
    try:
        data = json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def _safe_obj(raw: str | None) -> dict | None:
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _snapshot_payload(graph: Graph) -> dict[str, Any]:
    """Snapshot P2: último state-update da sala (cache), senão o estado do DB.

    Pass-through fields (analysis/context/nfr) só entram quando definidos —
    o cliente P2 preserva o valor local para chaves ausentes.
    """
    payload: dict[str, Any] = {"type": "snapshot", "graph_id": graph.id}
    cached = _room_state.get(graph.id)
    if cached is not None:
        payload.update({k: v for k, v in cached.items() if v is not None})
        return payload
    payload["nodes"] = _safe_list(graph.nodes_json)
    payload["edges"] = _safe_list(graph.edges_json)
    payload["excalidraw_elements"] = _safe_list(getattr(graph, "excalidraw_elements_json", "[]"))
    payload["name"] = graph.name
    analysis = _safe_obj(graph.analysis_json)
    if analysis is not None:
        payload["analysis"] = analysis
    context = getattr(graph, "context_text", None)
    if context:
        payload["context"] = context
    nfr = _safe_obj(getattr(graph, "nfr_json", None))
    if nfr:
        payload["nfr"] = nfr
    return payload


def _peers(graph_id: str, exclude: WebSocket | None = None) -> list[dict[str, Any]]:
    """Lista completa de pares da sala (o cliente P2 substitui a lista toda)."""
    out: list[dict[str, Any]] = []
    for ws in _rooms.get(graph_id, set()):
        if ws is exclude:
            continue
        p = _presence.get(ws)
        if p:
            out.append(dict(p))
    return out


async def _broadcast(graph_id: str, message: dict[str, Any], exclude: WebSocket | None = None) -> None:
    dead: list[WebSocket] = []
    for ws in list(_rooms.get(graph_id, set())):
        if ws is exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:  # noqa: BLE001 — socket morto: remove da sala
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


async def _leave_room(graph_id: str, ws: WebSocket) -> None:
    """Remove o peer e notifica os restantes (presence-update) — P2: quem sai da
    lista de peers some da UI. Sala vazia limpa também o cache efêmero de estado."""
    room = _rooms.get(graph_id)
    if room is None:
        return
    room.discard(ws)
    _presence.pop(ws, None)
    if not room:
        _rooms.pop(graph_id, None)
        _room_state.pop(graph_id, None)
        return
    await _broadcast(graph_id, {"type": "presence-update", "peers": _peers(graph_id)})


def _presence_of(user: User) -> dict[str, Any]:
    """Presença 100% injetada pelo servidor — campos de identidade do cliente
    declarados em qualquer payload são ignorados (anti-spoofing, P1.1)."""
    return {"user_id": str(user.id), "user_name": user.username}


@router.websocket("/api/v1/ws/collab")
async def ws_collab(websocket: WebSocket) -> None:
    """Sala P2 de colaboração — contrato exato em `web/src/lib/collab.ts`."""
    db = SessionLocal()
    joined_graph: str | None = None
    try:
        await websocket.accept()
        user = _authenticate_websocket(websocket, db)
        if user is None:
            await websocket.close(code=WS_CLOSE_UNAUTHORIZED, reason="unauthorized")
            return

        # P2: o graph_id chega na primeira mensagem (`hello`), não na URL.
        raw = await websocket.receive_text()
        if _too_large(raw):
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="message too large")
            return
        msg = _json_dict(raw)
        graph_id = msg.get("graph_id") if msg is not None else None
        if msg is None or msg.get("type") != "hello" or not isinstance(graph_id, str) or not graph_id:
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="expected hello")
            return

        graph = db.get(Graph, graph_id)
        if graph is None or not can_view_graph(db, user, graph):
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="forbidden")
            return
        room = _rooms.setdefault(graph_id, set())
        if len(room) >= MAX_PEERS_PER_ROOM:
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="room full")
            return

        room.add(websocket)
        _presence[websocket] = _presence_of(user)
        joined_graph = graph_id

        await websocket.send_json({"type": "hello-ack", "graph_id": graph_id})
        await websocket.send_json(_snapshot_payload(graph))
        # Quem entra recebe a lista completa (o cliente P2 substitui a lista em
        # cada evento); os demais pares recebem o anúncio do novo par.
        presence_event = {"type": "presence", "peers": _peers(graph_id)}
        await websocket.send_json(presence_event)
        await _broadcast(graph_id, presence_event, exclude=websocket)

        while True:
            raw = await websocket.receive_text()
            if _too_large(raw):
                # O push coalescido do P2 carrega o estado completo; descarta-se
                # (e loga) em vez de fechar — ver docstring do módulo.
                logger.warning("ws_collab_drop graph=%s bytes=%d", graph_id, len(raw))
                continue
            msg = _json_dict(raw)
            if msg is None:
                continue
            mtype = msg.get("type")
            if mtype == "state-update":
                # O socket está preso à sala do hello — ids de grafo distintos são ignorados.
                if msg.get("graph_id") not in (None, graph_id):
                    continue
                diff = {k: msg.get(k) for k in _STATE_FIELDS if msg.get(k) is not None}
                if diff:
                    _room_state.setdefault(graph_id, {}).update(diff)
                    await _broadcast(
                        graph_id,
                        {"type": "state-update", "graph_id": graph_id, **diff},
                        exclude=websocket,
                    )
            elif mtype == "hello":
                # Re-hello (idempotente, p.ex. após flap de rede): re-anuncia presença.
                await _broadcast(
                    graph_id,
                    {"type": "presence", "peers": _peers(graph_id)},
                    exclude=websocket,
                )
            # `comment.*` chega às duas rotas via broadcast_comment_event; o
            # cliente P2 ignora tipos desconhecidos (switch default: no-op).
    except WebSocketDisconnect:
        pass
    finally:
        if joined_graph is not None:
            await _leave_room(joined_graph, websocket)
        db.close()


@router.websocket("/api/v1/ws/graphs/{graph_id}")
async def ws_graph(graph_id: str, websocket: WebSocket) -> None:
    """Rota legado (CanvasComments.tsx): eventos `comment.*` + presença.

    Mesma auth/limites de /ws/collab; o payload de presença é o injetado pelo
    servidor (identidade declarada pelo cliente é ignorada).
    """
    db = SessionLocal()
    joined = False
    try:
        await websocket.accept()
        user = _authenticate_websocket(websocket, db)
        if user is None:
            await websocket.close(code=WS_CLOSE_UNAUTHORIZED, reason="unauthorized")
            return
        graph = db.get(Graph, graph_id)
        if graph is None or not can_view_graph(db, user, graph):
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="forbidden")
            return
        room = _rooms.setdefault(graph_id, set())
        if len(room) >= MAX_PEERS_PER_ROOM:
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="room full")
            return

        room.add(websocket)
        _presence[websocket] = _presence_of(user)
        joined = True
        await websocket.send_json({"type": "presence", "peers": _peers(graph_id)})
        await _broadcast(graph_id, {"type": "presence", "peers": _peers(graph_id)}, exclude=websocket)

        while True:
            raw = await websocket.receive_text()
            if _too_large(raw):
                logger.warning("ws_graph_drop graph=%s bytes=%d", graph_id, len(raw))
                continue
            msg = _json_dict(raw)
            if msg is None:
                continue
            mtype = str(msg.get("type", ""))
            if mtype.startswith("comment."):
                await _broadcast(graph_id, msg, exclude=websocket)
            elif mtype == "hello":
                await _broadcast(
                    graph_id,
                    {"type": "presence", "peers": _peers(graph_id)},
                    exclude=websocket,
                )
    except WebSocketDisconnect:
        pass
    finally:
        if joined:
            await _leave_room(graph_id, websocket)
        db.close()
