/**
 * Performance utilities for large-scale diagrams (500+ nodes).
 *
 * P2.1.1 — Cluster/LOD: quando o canvas tem muitos nós, agrupa os que
 * estão próximos e reduz a complexidade de renderização (sem snap,
 * sem animações, sem guidelines).
 */

/** Agrupa IDs de nós em clusters baseado na proximidade spatial. */
export function clusterNodes(
  nodeIds: string[],
  nodes: Record<string, { x: number; y: number }>,
  threshold: number = 200,
): string[][] {
  if (nodeIds.length <= 20) return nodeIds.map((id) => [id]);
  const clusters: string[][] = [];
  const visited = new Set<string>();
  for (const id of nodeIds) {
    if (visited.has(id)) continue;
    const cluster: string[] = [id];
    visited.add(id);
    const base = nodes[id];
    for (const other of nodeIds) {
      if (visited.has(other)) continue;
      const n = nodes[other];
      if (!n || !base) continue;
      const dx = base.x - n.x;
      const dy = base.y - n.y;
      if (Math.sqrt(dx * dx + dy * dy) < threshold) {
        cluster.push(other);
        visited.add(other);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

/** Retorna tamanho ideal de renderização baseado na contagem de nós. */
export function lodConfig(nodeCount: number): {
  snapEnabled: boolean;
  guidelinesEnabled: boolean;
  animatedEdges: boolean;
  minZoom: number;
  clusteringThreshold: number;
} {
  if (nodeCount >= 500) {
    return {
      snapEnabled: false,
      guidelinesEnabled: false,
      animatedEdges: false,
      minZoom: 0.15,
      clusteringThreshold: 150,
    };
  }
  if (nodeCount >= 150) {
    return {
      snapEnabled: false,
      guidelinesEnabled: true,
      animatedEdges: false,
      minZoom: 0.12,
      clusteringThreshold: 200,
    };
  }
  return {
    snapEnabled: true,
    guidelinesEnabled: true,
    animatedEdges: nodeCount < 80,
    minZoom: 0.08,
    clusteringThreshold: 200,
  };
}

/** Threshold para ativar onlyRenderVisibleElements. */
export function shouldEnableVisibleElements(nodeCount: number): boolean {
  return nodeCount >= 120;
}
