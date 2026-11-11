/**
 * Performance utilities for large-scale diagrams (500+ nodes).
 *
 * P2.1.1 — Cluster/LOD: quando o canvas tem muitos nós, agrupa os que
 * estão próximos e reduz a complexidade de renderização (sem snap,
 * sem animações, sem guidelines).
 */

/** Retorna configurações de LOD a partir da contagem de nós. */
export function lodConfig(nodeCount: number): {
  snapEnabled: boolean;
  animatedEdges: boolean;
} {
  if (nodeCount >= 500) {
    return {
      snapEnabled: false,
      animatedEdges: false,
    };
  }
  if (nodeCount >= 150) {
    return {
      snapEnabled: false,
      animatedEdges: false,
    };
  }
  return {
    snapEnabled: true,
    animatedEdges: nodeCount < 80,
  };
}

/** Threshold para ativar onlyRenderVisibleElements. */
export function shouldEnableVisibleElements(nodeCount: number, freeMode = false): boolean {
  return nodeCount >= (freeMode ? 40 : 120);
}
