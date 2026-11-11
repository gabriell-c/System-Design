/**
 * P3.3.1 — Colaboração em tempo real via WebSocket (`/api/v1/ws/collab`).
 *
 * Contrato cliente (o servidor injeta identidade a partir do token — cookies
 * de mesma origem viajam sozinhas no WebSocket):
 * - `hello` NÃO carrega identidade declarada pelo usuário; o servidor envia
 *   eventos de presença com userId/userName confiáveis;
 * - close 4001 = autenticação falhou, 4003 = não conectado / sala cheia →
 *   estado de erro permanente (sem loop de reconexão);
 * - estado remoto é mesclado por elemento (per id): novo/alterado localmente
 *   vence, remoto deletado é removido, excalidraw é preservado (união).
 */

export type CollabPresence = {
  userId: string;
  displayName: string;
  color: string;
  cursor?: { x: number; y: number };
  lastSeen: number;
};

/** Erro permanente — o provider não tenta reconectar nestes casos. */
export type CollabAuthError = "auth" | "room-full";

export type CollabSession = {
  graphId: string;
  connected: boolean;
  peers: CollabPresence[];
  docVersion: number;
  /** Populated on close code 4001 (auth) / 4003 (room full / not connected). */
  authError: CollabAuthError | null;
};

export type GraphSnapshot = {
  nodes: unknown[];
  edges: unknown[];
  /** Elementos de desenho livre (Excalidraw) — preserve local state on merge. */
  excalidrawElements?: unknown[];
  /** Pass-through fields: só presentes quando o snapshot remoto os carrega. */
  name?: string;
  analysis?: unknown;
  context?: string | null;
  nfr?: unknown;
};

export type MergedGraphSnapshot = {
  nodes: unknown[];
  edges: unknown[];
  excalidrawElements: unknown[];
  name?: string;
  analysis?: unknown;
  context?: string | null;
  nfr?: unknown;
};

type TouchedSets = {
  /** ids de nós criados/alterados localmente desde o último merge remoto. */
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
};

type GraphListener = (snapshot: MergedGraphSnapshot) => void;

const COLORS = ["#6366f1", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"];
const COLLAB_PATH = "/api/v1/ws/collab";
/** 4001 auth falhou / 4003 sala cheia ou não conectado — sem reconexão. */
const PERMANENT_CLOSE_CODES = new Set([4001, 4003]);
/** Coalescing de state-update: no máx. 1 mensagem de push a cada 300ms. */
const PUSH_THROTTLE_MS = 300;
/** Teto da fila offline: cada mensagem é um snapshot full (idempotente/LWW),
 *  então as mais antigas são suplantadas — descarta as que estouram o teto. */
const OFFLINE_QUEUE_MAX = 20;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function elementId(item: unknown): string | null {
  if (typeof item !== "object" || item === null) return null;
  const id = (item as { id?: unknown }).id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function hashByIds(items: unknown[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const item of items) {
    const id = elementId(item);
    if (id) out.set(id, JSON.stringify(item));
  }
  return out;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Last-writer-wins por elemento:
 * - id em `localTouched` (novo/alterado localmente) → versão local vence;
 * - id presente só no remoto → versão remota entra;
 * - id em ambos sem toque local → versão remota vence;
 * - id local inexistente no remoto e sem toque local → remoto deletou → sai.
 * Unrelated ids nunca são afetados. Excalidraw: união (locais primeiro).
 */
export function mergeGraphSnapshots(
  local: GraphSnapshot,
  remote: GraphSnapshot,
  localTouched: TouchedSets,
): MergedGraphSnapshot {
  const mergeGroup = (
    localItems: unknown[],
    remoteItems: unknown[],
    touched: ReadonlySet<string>,
  ): unknown[] => {
    const remoteById = new Map<string, unknown>();
    for (const item of remoteItems) {
      const id = elementId(item);
      if (id) remoteById.set(id, item);
    }
    const merged: unknown[] = [];
    const seen = new Set<string>();
    for (const item of localItems) {
      const id = elementId(item);
      if (!id) {
        merged.push(item);
        continue;
      }
      // Local só sobrevive se foi tocado localmente (novo ou alterado).
      if (touched.has(id)) {
        merged.push(item);
        seen.add(id);
      }
    }
    for (const [id, item] of remoteById) {
      if (!seen.has(id)) merged.push(item);
    }
    return merged;
  };

  const nodes = mergeGroup(local.nodes, remote.nodes, localTouched.nodes);
  const edges = mergeGroup(local.edges, remote.edges, localTouched.edges);

  const localExcalidraw = local.excalidrawElements ?? [];
  // Remoto sem excalidrawElements → não se perde nada: estado local inteiro.
  const excalidrawElements =
    remote.excalidrawElements === undefined
      ? [...localExcalidraw]
      : unionExcalidraw(localExcalidraw, remote.excalidrawElements);

  const out: MergedGraphSnapshot = { nodes, edges, excalidrawElements };
  if (remote.name !== undefined) out.name = remote.name;
  if (remote.analysis !== undefined) out.analysis = remote.analysis;
  if (remote.context !== undefined) out.context = remote.context;
  if (remote.nfr !== undefined) out.nfr = remote.nfr;
  return out;
}

function unionExcalidraw(local: unknown[], remote: unknown[]): unknown[] {
  const remoteById = new Map<string, unknown>();
  for (const item of remote) {
    const id = elementId(item);
    if (id) remoteById.set(id, item);
  }
  const localIds = new Set<string>();
  for (const item of local) {
    const id = elementId(item);
    if (id) localIds.add(id);
  }
  const out = [...local];
  for (const [id, item] of remoteById) {
    if (!localIds.has(id)) out.push(item);
  }
  return out;
}

/** Provider — estado element-wise syncado pela sala WS de colaboração. */
export class CollabProvider {
  private graphId: string;
  private listeners = new Set<(s: CollabSession) => void>();
  private graphListeners = new Set<GraphListener>();
  private session: CollabSession;
  private ws: WebSocket | null = null;
  private closed = false;
  private authError: CollabAuthError | null = null;
  /** Último estado local conhecido (nodes/edges/excalidraw + fields pass-through). */
  private lastLocal: GraphSnapshot;
  private baselineHashes: { nodes: Map<string, string>; edges: Map<string, string> } | null = null;
  private lastPushedHashes: { nodes: Map<string, string>; edges: Map<string, string> };
  private touchedNodes = new Set<string>();
  private touchedEdges = new Set<string>();
  private offlineQueue: string[] = [];
  /** Última baseURL em que connect() foi chamado — reconexão deriva dela (sem hardcode). */
  private lastBaseURL: string | null = null;
  /** Coalesce push: no máximo uma state-update a cada PUSH_THROTTLE_MS. */
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingPush: string | null = null;

  constructor(graphId: string) {
    this.graphId = graphId;
    this.session = {
      graphId,
      connected: false,
      peers: [],
      docVersion: 0,
      authError: null,
    };
    this.lastLocal = { nodes: [], edges: [], excalidrawElements: [] };
    this.lastPushedHashes = { nodes: new Map(), edges: new Map() };
  }

  /** Seed inicial (estado carregado da API) — estabelece a baseline sem tocar "touched". */
  seedFromSnapshot(snapshot: GraphSnapshot): void {
    this.lastLocal = this.withExcalidraw(snapshot, []);
    this.baselineHashes = {
      nodes: hashByIds(snapshot.nodes),
      edges: hashByIds(snapshot.edges),
    };
    this.lastPushedHashes = {
      nodes: new Map(this.baselineHashes.nodes),
      edges: new Map(this.baselineHashes.edges),
    };
    this.touchedNodes.clear();
    this.touchedEdges.clear();
  }

  /**
   * Local change: atualiza o estado local rastreado e (coalescido) envia a
   * sala uma `state-update` no máximo a cada PUSH_THROTTLE_MS.
   * Novo/alterado desde o último push entra no set de touched — usado para o
   * merge last-writer-wins.
   */
  pushLocalSnapshot(snapshot: GraphSnapshot): void {
    this.lastLocal = this.withExcalidraw(snapshot, this.lastLocal.excalidrawElements ?? []);
    this.markTouched(snapshot);
    this.pendingPush = JSON.stringify({
      type: "state-update",
      graph_id: this.graphId,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      excalidraw_elements: snapshot.excalidrawElements ?? [],
    });
    if (this.pushTimer) return;
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      if (this.pendingPush === null) return;
      const message = this.pendingPush;
      this.pendingPush = null;
      this.send(message);
    }, PUSH_THROTTLE_MS);
  }

  private send(message: string): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.offlineQueue.push(message);
      if (this.offlineQueue.length > OFFLINE_QUEUE_MAX) {
        this.offlineQueue.shift();
      }
    }
  }

  private markTouched(snapshot: GraphSnapshot): void {
    const diff = (
      items: unknown[],
      group: "nodes" | "edges",
    ): void => {
      const current = hashByIds(items);
      const previous = this.lastPushedHashes[group];
      if (this.baselineHashes === null) {
        // Primeira observação = baseline (estado inicial vindo da API).
        this.baselineHashes = { nodes: hashByIds(snapshot.nodes), edges: hashByIds(snapshot.edges) };
      } else if (previous.size > 0) {
        for (const [id, h] of current) {
          if (previous.get(id) !== h) {
            const target = group === "nodes" ? this.touchedNodes : this.touchedEdges;
            target.add(id);
          }
        }
      }
      this.lastPushedHashes[group] = current;
    };
    diff(snapshot.nodes, "nodes");
    diff(snapshot.edges, "edges");
  }

  connect(baseURL: string): void {
    if (this.ws || this.closed) return;
    this.lastBaseURL = baseURL;
    const isLocal = /localhost|127\.0\.0\.1/i.test(baseURL);
    const base = isLocal ? `http://127.0.0.1:${new URL(baseURL).port}` : baseURL;
    const url = new URL(COLLAB_PATH, base)
      .toString()
      .replace(/^http:/, "ws:")
      .replace(/^https:/, "wss:");
    // WebSocket de mesma origem: cookies viajam automaticamente.
    this.ws = new WebSocket(url);
    this.ws.onopen = () => {
      this.session = { ...this.session, connected: true, authError: null, peers: [] };
      this.emit();
      // hello SEM identidade — o servidor injeta presença a partir do token.
      this.ws?.send(JSON.stringify({ type: "hello", graph_id: this.graphId }));
      if (this.offlineQueue.length) {
        const pending = this.offlineQueue;
        this.offlineQueue = [];
        for (const message of pending) this.ws?.send(message);
      }
    };
    this.ws.onmessage = (event) => this.onMessage(event);
    this.ws.onclose = (event) => this.onClose(event);
  }

  private onMessage(event: MessageEvent): void {
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(String(event.data)) as Record<string, unknown>;
    } catch {
      return;
    }
    switch (m.type) {
      case "hello-ack":
        this.session = { ...this.session, connected: true };
        this.emit();
        break;
      case "snapshot":
      case "state-update":
        this.handleRemoteState(m);
        break;
      case "presence":
      case "presence-update": {
        // Presença 100% do servidor (identidade confiável do token).
        const raw = Array.isArray(m.peers) ? m.peers : [];
        const peers = (raw as Array<Record<string, unknown>>)
          .map((p) => {
            const userId = String(p.user_id ?? p.userId ?? "");
            if (!userId) return null;
            return {
              userId,
              displayName: String(p.user_name ?? p.displayName ?? ""),
              color:
                typeof p.color === "string"
                  ? p.color
                  : COLORS[Math.abs(hash(userId)) % COLORS.length]!,
              cursor:
                typeof p.x === "number" && typeof p.y === "number" ? { x: p.x, y: p.y } : undefined,
              lastSeen: Date.now(),
            } as CollabPresence;
          })
          .filter((p): p is CollabPresence => p !== null);
        this.session = { ...this.session, peers };
        this.emit();
        break;
      }
      default:
        break;
    }
  }

  private handleRemoteState(m: Record<string, unknown>): void {
    const remote: GraphSnapshot = {
      nodes: asArray(m.nodes),
      edges: asArray(m.edges),
      excalidrawElements: m.excalidraw_elements === undefined ? undefined : asArray(m.excalidraw_elements),
      name: typeof m.name === "string" ? m.name : undefined,
      analysis: m.analysis === undefined ? undefined : m.analysis,
      context: typeof m.context === "string" ? m.context : m.context === null ? null : undefined,
      nfr: m.nfr,
    };
    const merged = mergeGraphSnapshots(this.lastLocal, remote, {
      nodes: this.touchedNodes,
      edges: this.touchedEdges,
    });
    // Re-sincroniza baseline com o estado mesclado: apenas toques locais
    // posteriores a este merge contam como "touched".
    this.lastLocal = this.withExcalidraw(merged, merged.excalidrawElements);
    this.baselineHashes = {
      nodes: hashByIds(merged.nodes),
      edges: hashByIds(merged.edges),
    };
    this.lastPushedHashes = {
      nodes: new Map(this.baselineHashes.nodes),
      edges: new Map(this.baselineHashes.edges),
    };
    this.touchedNodes.clear();
    this.touchedEdges.clear();
    this.session = { ...this.session, docVersion: this.session.docVersion + 1 };
    this.graphListeners.forEach((listener) => listener(merged));
  }

  private withExcalidraw(snapshot: GraphSnapshot, fallback: unknown[]): GraphSnapshot {
    return {
      ...snapshot,
      excalidrawElements: snapshot.excalidrawElements ?? fallback,
    };
  }

  private onClose(event: CloseEvent): void {
    this.ws = null;
    const permanent = PERMANENT_CLOSE_CODES.has(event.code);
    if (permanent) {
      this.closed = true;
      this.authError = event.code === 4001 ? "auth" : "room-full";
      this.offlineQueue = [];
    }
    this.session = {
      ...this.session,
      connected: false,
      authError: permanent ? this.authError : this.session.authError,
    };
    this.emit();
    if (!permanent && this.lastBaseURL) {
      setTimeout(() => {
        if (!this.closed && this.session.connected === false && this.lastBaseURL) {
          this.connect(this.lastBaseURL);
        }
      }, 2000);
    }
  }

  close(): void {
    this.closed = true;
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    this.pendingPush = null;
    this.offlineQueue = [];
    this.ws?.close();
    this.ws = null;
    this.session = { ...this.session, connected: false };
  }

  subscribe(listener: (s: CollabSession) => void): () => void {
    this.listeners.add(listener);
    listener(this.session);
    return () => {
      this.listeners.delete(listener);
    };
  }

  onGraphChange(listener: GraphListener): () => void {
    this.graphListeners.add(listener);
    return () => {
      this.graphListeners.delete(listener);
    };
  }

  private emit(): void {
    this.listeners.forEach((l) => l(this.session));
  }
}

export function createCollabProvider(graphId: string): CollabProvider {
  return new CollabProvider(graphId);
}
