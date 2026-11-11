"""Item 40 — compute_score_breakdown: fatores devem ser coerentes com a fórmula real.

Ruling: os fatores são contribuições NÃO somáveis (efeitos por nó + contexto
qualitativo). A linha "Score final" carrega a nota real; as penalidades de
severidade usam as constantes reais do runner (warning −0.4 / critical −1.0,
por nó, piso 2.0) e não somam na nota final. O teste fixa essa semântica
honesta.
"""

from __future__ import annotations

from app.schemas.analysis import (
    AnalysisResult,
    DomainCoherenceScore,
    Finding,
    GrowthReport,
    GrowthScenario,
    ReviewScorecard,
)
from app.services.p1_analysis import (
    SEVERITY_NODE_PENALTY,
    compute_score_breakdown,
)


def _result(score: float, findings: list[Finding]) -> AnalysisResult:
    return AnalysisResult(
        score=score,
        summary="ok",
        strengths=["a", "b"],
        risks=[],
        suggestions=[],
        findings=findings,
        node_scores={},
        growth=GrowthReport(
            small=GrowthScenario(ok=True),
            medium=GrowthScenario(ok=True),
            large=GrowthScenario(ok=True),
        ),
        ia_ok=True,
        ia_unavailable=False,
        agents_used=["heuristic", "consolidator"],
    )


def test_breakdown_reconciles_with_final_score():
    findings = [
        Finding(severity="critical", title="c1", detail="d", node_id="n1"),
        Finding(severity="critical", title="c2", detail="d", node_id="n2"),
        Finding(severity="warning", title="w1", detail="d", node_id="n1"),
        Finding(severity="warning", title="w2", detail="d"),
        Finding(severity="warning", title="w3", detail="d"),
        Finding(severity="info", title="i1", detail="d"),
    ]
    result = _result(6.5, findings)
    bd = compute_score_breakdown(result, [])

    # base/explained casam com a nota real (a breakdown não recalcula a nota)
    assert bd.base_score == 6.5
    assert bd.explained_score == 6.5

    by_label = {f.label: f for f in bd.factors}
    # A linha "Score final" reconcilia: impacto == nota final exibida
    assert by_label["Score final"].impact == 6.5
    # Penalidades usam as constantes reais (por finding, efeito em node_scores)
    assert by_label["Findings críticos"].impact == round(2 * SEVERITY_NODE_PENALTY["critical"], 1)  # -2.0
    assert by_label["Findings warning"].impact == round(3 * SEVERITY_NODE_PENALTY["warning"], 1)  # -1.2
    # Contexto qualitativo: honestamente não-somável (impacto zero)
    assert by_label["Pontos fortes"].impact == 0.0

    assert bd.finding_counts == {"critical": 2, "warning": 3, "info": 1}
    assert bd.critical_node_ids == ["n1", "n2"]
    # Não-aditividade documentada: só a linha "Score final" carrega a nota real
    assert sum(f.impact for f in bd.factors if f.label != "Score final") != 6.5


def test_breakdown_qualitative_factors_stay_zero():
    result = _result(8.0, [Finding(severity="info", title="i", detail="d")])
    result.domain_coherence = DomainCoherenceScore(an=9, ad=8, aa=8, ai=7, geral=8.0)
    result.review_scorecard = ReviewScorecard(
        narrative=8, views_completeness=8, placement=8, flow_continuity=8,
        operability=8, decision_quality=8, overall=8.0, review_ready=True,
    )
    bd = compute_score_breakdown(result, [])
    by_label = {f.label: f for f in bd.factors}
    assert by_label["Coerência de domínio"].impact == 0.0
    assert by_label["Review scorecard"].impact == 0.0
    assert by_label["Score final"].impact == 8.0
    assert bd.explained_score == 8.0
