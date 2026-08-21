/** P3.3.1 — Colaboração em tempo real (Yjs/CRDT stub + presence). */

export type CollabPresence = {
  userId: string;
  displayName: string;
  color: string;
  cursor?: { x: number; y: number };
  lastSeen: number;
};

export type CollabSession = {
  graphId: string;
  connected: boolean;
  peers: CollabPresence[];
  docVersion: number;
};

const COLORS = ["#6366f1", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"];

/** Provider stub — em produção trocar por Yjs + WebSocket. */
export class CollabProvider {
  private graphId: string;
  private listeners = new Set<(s: CollabSession) => void>();
  private session: CollabSession;
  private ws: WebSocket | null = null;

  constructor(graphId: string, userId: string, displayName: string) {
    this.graphId = graphId;
    this.session = {
      graphId,
      connected: false,
      peers: [
        {
          userId,
          displayName,
          color: COLORS[0],
          lastSeen: Date.now(),
        },
      ],
      docVersion: 0,
    };
  }

  connect(baseUrl: string): void {
    if (typeof window === "undefined") return;
    const wsUrl = baseUrl.replace(/^http/, "ws") + `/api/v1/ws/graphs/${this.graphId}`;
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.session = { ...this.session, connected: true };
        this.emit();
      };
      this.ws.onclose = () => {
        this.session = { ...this.session, connected: false };
        this.emit();
      };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as { type: string; peers?: CollabPresence[] };
          if (msg.type === "presence" && msg.peers) {
            this.session = { ...this.session, peers: msg.peers };
            this.emit();
          }
        } catch {
          /* ignore malformed */
        }
      };
    } catch {
      this.session = { ...this.session, connected: false };
      this.emit();
    }
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.session = { ...this.session, connected: false };
    this.emit();
  }

  broadcastCursor(x: number, y: number, userId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: "cursor", userId, x, y }));
  }

  subscribe(fn: (s: CollabSession) => void): () => void {
    this.listeners.add(fn);
    fn(this.session);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.session);
  }
}

export function createCollabProvider(graphId: string, userId: string, displayName: string): CollabProvider {
  return new CollabProvider(graphId, userId, displayName);
}
