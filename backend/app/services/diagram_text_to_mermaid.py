"""
Serviço que converte texto livre em diagramas Mermaid.
Detecta fluxo, sequência ou gráfico com base na estrutura do texto.
"""

import re
from enum import Enum


class DiagramType(str, Enum):
    FLOW = "flow"
    SEQUENCE = "seq"
    GRAPH = "graph"

def parse_text_to_mermaid(text: str) -> tuple[DiagramType, str]:
    """
    Analisa o texto e gera código Mermaid.
    Retorna (tipo, codigo_mermaid).
    """
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # Detectar se é sequência (número ou lista)
    if _looks_like_sequence(lines):
        return DiagramType.SEQUENCE, _build_sequence(lines)

    # Detectar se é fluxo (setas, marcadores de fluxo)
    if _looks_like_flow(lines):
        return DiagramType.FLOW, _build_flow(lines)

    # Padrão genérico: fluxo
    return DiagramType.FLOW, _build_flow(lines)

def _looks_like_sequence(lines: list[str]) -> bool:
    """Texto começa com números ou marcadores de lista."""
    if not lines:
        return False
    first = lines[0]
    # padrões: "1.", "1 -", "1)"
    return bool(re.match(r"^\d+[\.\)\-]", first))

def _looks_like_flow(lines: list[str]) -> bool:
    """Texto contém setas ou palavras-chave de fluxo."""
    patterns = [r"->", r"-->", r"=>", r"flui", r"vai"]
    return any(re.search(p, text, re.IGNORECASE) for text in lines for p in patterns)

def _build_flow(lines: list[str]) -> str:
    nodes = []
    edges = []
    for i, line in enumerate(lines):
        # Limpar marcadores numéricos/letras
        clean = re.sub(r"^\d+[\.\)\-]\s*", "", line).strip()
        node_id = f"node{i}"
        nodes.append(f"    {node_id}[\"{clean}\"]")
        if i > 0:
            edges.append(f"    node{i-1} --> {node_id}")

    result = ["flowchart TB"]
    result.extend(nodes)
    result.extend(edges)
    return "\n".join(result)

def _build_sequence(lines: list[str]) -> str:
    # Remover marcadores iniciais
    clean_lines = [re.sub(r"^\d+[\.\)\-]\s*", "", line).strip() for line in lines]
    result = ["sequenceDiagram"]
    # Atores genéricos alternados: User, System
    actors = ["User", "System"]
    for i, text in enumerate(clean_lines):
        actor = actors[i % 2]
        result.append(f"    {actor} ->> {actors[1 - i % 2]}: {text}")
    return "\n".join(result)