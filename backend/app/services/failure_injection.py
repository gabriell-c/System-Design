"""P0.5.4 — Injeção de falha em nó selecionado (não evento aleatório).

BFS determinístico sobre arestas de saída: o nó `X` falha, caminha as
arestas e marca o downstream como `unreachable` (indisponível) ou
`degraded` (degradado) conforme `mode` e o `failureBehavior` da aresta.

Modos (parâmetro `mode`):

- `down` — o nó ficou totalmente indisponível (HTTP 503). O nó falho e
  tudo que estiver no caminho sem mitigação fica `unreachable`; a
  `failureBehavior` da aresta decide se a falha atravessa:
  `retry`/`dlq` mantêm o downstream `degraded` (o fluxo passa pelo nó),
  `fallback` desvia o tráfego e CORTE a propagação (nada além do nó do
  fallback é atingido por esta falha).
- `timeout` — o nó não caiu, só estourou o SLA (latência extrema). O nó
  falho e o downstream atingido ficam `degraded` — ninguém vira
  `unreachable`. Regra de propagação (documentada): todos os vizinhos
  diretos viram `degraded`; vizinhos alcançados por aresta `retry`/`dlq`
  estendem a degradação mais UM hop (a latência da tentativa de retry
  alcança um nível abaixo) — e a propagação PARA aí: timeout não
  propaga em cadeia infinita. Arestas `none`/`fallback` não estendem.
- `degraded` — capacidade reduzida (error budget queimando): apenas o
  nó falho e os vizinhos diretos (arestas de saída) ficam `degraded`,
  sem propagação além do 1º hop.

`failureBehavior` da aresta (em `data` da aresta):

- `none` (ou ausente) — sem mitigação. Em `down`, a falha atravessa a
  aresta sem atenuação: o alvo vira `unreachable` e o BFS continua.
- `retry` — o chamador tenta novamente: o alvo sofre indisponibilidade
  transitória e se recupera (degradado). Em `down`, o fluxo passa pelo
  alvo (BFS continua); em `timeout`, estende a degradação um hop.
- `dlq` — a mensagem que falha vai para dead-letter queue: o alvo fica
  degradado (backlog da fila). Mesma semântica de propagação do `retry`.
- `fallback` — o tráfego é desviado para um backup: o alvo fica
  degradado (não indisponível) e, em `down`, a propagação para na
  aresta — o fallback isola a falha.

Métricas:

- `journeys_broken_pct` é a % de nós-serviço ("cards" — nós com `kind`
  fora de `zone`/`block`) que ficaram `unreachable`. Grafo sem
  nós-serviço reporta 0.0 (nunca 100 sobre denominador invisível).
- Em `timeout`/`degraded` nenhum nó vira `unreachable`, então
  `journeys_broken_pct` é 0.0 — a jornada está degradada, não quebrada.

Determinismo: todas as listas de saída são ordenadas; a mesma entrada
produz saída byte-idêntica.
"""

from __future__ import annotations

from collections import deque
from typing import Any

#: Limite de propagação unificado entre injeção de falha e blast radius.
#: As rotas clavam 1–20 e importam esta constante.
RESILIENCE_MAX_HOPS = 8

#: Comportamentos que mantêm o fluxo passando pelo nó degradado
#: (propagando em `down`; estendendo um hop em `timeout`).
_BEHAVIORS_THAT_KEEP_FLOW = {"retry", "dlq"}

_BEHAVIOR_DETAIL = {
    "fallback": "Tráfego desviado — serviço degradado, não indisponível.",
    "retry": "Comportamento retry — latência elevada ou fila.",
    "dlq": "Comportamento dlq — latência elevada ou fila.",
}


def _node_data(node: dict) -> dict[str, Any]:
    data = node.get("data") or {}
    return data if isinstance(data, dict) else {}


def _edge_data(edge: dict) -> dict[str, Any]:
    data = edge.get("data") or {}
    return data if isinstance(data, dict) else {}


def _label(node: dict) -> str:
    return str(_node_data(node).get("label") or node.get("id") or "?")


def _build_adjacency(edges: list[dict]) -> dict[str, list[tuple[str, dict]]]:
    adj: dict[str, list[tuple[str, dict]]] = {}
    for edge in edges:
        src = str(edge.get("source") or "")
        tgt = str(edge.get("target") or "")
        if not src or not tgt:
            continue
        adj.setdefault(src, []).append((tgt, _edge_data(edge)))
    return adj


def _behavior(edge_data: dict) -> str:
    return edge_data.get("failureBehavior") or "none"


def _inject_down(adj: dict, failed: str, max_hops: int, note) -> tuple[set[str], set[str]]:
    """Modo down: falha total. `retry`/`dlq` degradam e continuam; `fallback`
    degrada e corta; `none` torna unreachable e continua."""
    unreachable: set[str] = {failed}
    degraded: set[str] = set()
    visited = {failed}
    queue: deque[tuple[str, int]] = deque([(failed, 0)])
    while queue:
        current, hop = queue.popleft()
        if hop >= max_hops:
            continue
        for target, edge_data in adj.get(current, []):
            if target in visited:
                continue
            visited.add(target)
            behavior = _behavior(edge_data)
            if behavior == "fallback":
                degraded.add(target)
                note(edge_data, current, target)
                continue  # fallback corta a propagação
            if behavior in _BEHAVIORS_THAT_KEEP_FLOW:
                degraded.add(target)
                note(edge_data, current, target)
                queue.append((target, hop + 1))
                continue
            unreachable.add(target)
            queue.append((target, hop + 1))
    return unreachable, degraded


def _inject_timeout(adj: dict, failed: str, max_hops: int, note) -> tuple[set[str], set[str]]:
    """Modo timeout: SLA estourado, nada fica unreachable.

    Regra: vizinhos diretos viram `degraded`; alcançados por aresta
    `retry`/`dlq`, estendem a degradação mais UM hop (a latência do retry
    alcança um nível abaixo) — e para aí (timeout não propaga em cadeia).
    """
    degraded: set[str] = {failed}
    visited = {failed}
    # (nó, hop, pode_expandar): só vizinhos via retry/dlq do nó falho
    # expandem, e apenas uma vez.
    queue: deque[tuple[str, int, bool]] = deque([(failed, 0, True)])
    while queue:
        current, hop, expands = queue.popleft()
        if hop >= max_hops or not expands:
            continue
        for target, edge_data in adj.get(current, []):
            if target in visited:
                continue
            visited.add(target)
            behavior = _behavior(edge_data)
            degraded.add(target)
            if behavior != "none":
                note(edge_data, current, target)
            if behavior in _BEHAVIORS_THAT_KEEP_FLOW:
                # hop == 0: vizinho do nó falho estende 1 hop; a extensão
                # não encadeia (alvo de nó-secundário nunca expande).
                queue.append((target, hop + 1, hop == 0))
    return set(), degraded


def _inject_degraded(adj: dict, failed: str, note) -> tuple[set[str], set[str]]:
    """Modo degraded: apenas o nó falho e vizinhos diretos, sem propagação."""
    degraded: set[str] = {failed}
    visited = {failed}
    for target, edge_data in adj.get(failed, []):
        if target in visited:
            continue
        visited.add(target)
        degraded.add(target)
        if _behavior(edge_data) != "none":
            note(edge_data, failed, target)
    return set(), degraded


def inject_failure(
    nodes: list[dict],
    edges: list[dict],
    failed_node_id: str,
    *,
    mode: str = "down",
    max_hops: int = RESILIENCE_MAX_HOPS,
) -> dict[str, Any]:
    """Simula falha no nó `failed_node_id` e propaga o impacto downstream.

    Semântica de `mode` (`down`/`timeout`/`degraded`) e de `failureBehavior`
    está documentada na docstring do módulo.
    """
    node_map = {str(n.get("id")): n for n in nodes if n.get("id")}
    if failed_node_id not in node_map:
        return {"ok": False, "error": f"Nó '{failed_node_id}' não encontrado no grafo."}
    if mode not in {"down", "timeout", "degraded"}:
        return {
            "ok": False,
            "error": f"Modo inválido '{mode}' — use 'down', 'timeout' ou 'degraded'.",
        }

    adj = _build_adjacency(edges)
    card_nodes = [
        nid
        for nid, n in node_map.items()
        if _node_data(n).get("kind") not in {"zone", "block"}
    ]
    total_cards = len(card_nodes)

    fallbacks: list[dict[str, str]] = []

    def _note(edge_data: dict, current: str, target: str) -> None:
        behavior = _behavior(edge_data)
        fallbacks.append(
            {
                "edge_behavior": behavior,
                "from": _label(node_map.get(current, {})),
                "to": _label(node_map.get(target, {})),
                "detail": _BEHAVIOR_DETAIL.get(behavior, "Sem mitigação — falha atravessa a aresta."),
            }
        )

    if mode == "down":
        unreachable, degraded = _inject_down(adj, failed_node_id, max_hops, _note)
    elif mode == "timeout":
        unreachable, degraded = _inject_timeout(adj, failed_node_id, max_hops, _note)
    else:
        unreachable, degraded = _inject_degraded(adj, failed_node_id, _note)

    critical_edges = [e for e in edges if _edge_data(e).get("isCriticalPath")]
    broken_critical = [
        e
        for e in critical_edges
        if str(e.get("source")) in unreachable or str(e.get("target")) in unreachable
    ]
    journeys_broken_pct = round(len(unreachable) / total_cards * 100, 1) if total_cards else 0.0

    mode_detail = {
        "down": "Indisponível — HTTP 503 / timeout.",
        "timeout": "Latência extrema — p99 > SLO.",
        "degraded": "Capacidade reduzida — error budget queimando.",
    }

    return {
        "ok": True,
        "failed_node_id": failed_node_id,
        "failed_label": _label(node_map[failed_node_id]),
        "mode": mode,
        "mode_detail": mode_detail[mode],
        "unreachable_node_ids": sorted(unreachable),
        "degraded_node_ids": sorted(degraded),
        "fallback_activations": fallbacks,
        "critical_path_broken": len(broken_critical),
        "critical_path_total": len(critical_edges),
        "journeys_broken_pct": journeys_broken_pct,
        "affected_node_ids": sorted(unreachable | degraded),
        "summary": (
            f"Falha em '{_label(node_map[failed_node_id])}' ({mode}): "
            f"{len(unreachable)} nós indisponíveis, {len(degraded)} degradados, "
            f"{journeys_broken_pct}% dos serviços afetados."
        ),
    }
