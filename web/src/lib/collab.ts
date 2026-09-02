/** P3.3.1 — Colaboração em tempo real com Yjs CRDT + presence via WebSocket. */

import * as Y from "yjs";

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

export type GraphSnapshot = {
  nodes: unknown[];
  edges: unknown[];
};

type GraphListener = (snapshot: GraphSnapshot) => void;

const COLORS = ["#6366f1", "#a78bfa", "#f472b6", "#34d399", "#fbbf24"];

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Provider — Yjs doc synced over Archia WebSocket room. */
export class CollabProvider {
  private graphId: string;
  private userId: string;
  private displayName: string;
  private color: string;
  private listeners = new Set<(s: CollabSession) => void>();
  private graphListeners = new Set<GraphListener>();
  private session: CollabSession;
  private ws: WebSocket | null = null;
  private doc: Y.Doc;
  private nodesArr: Y.Array<unknown>;
  private edgesArr: Y.Array<unknown>;
  private applyingRemote = false;
  private offlineQueue: string[] = [];

  constructor(graphId: string, userId: string, displayName: string) {
    this.graphId = graphId;
    this.userId = userId;
    this.displayName = displayName;
    this.color = COLORS[Math.abs(hash(userId)) % COLORS.length]!;
    this.doc = new Y.Doc();
    this.nodesArr = this.doc.getArray("nodes");
    this.edgesArr = this.doc.getArray("edges");
    this.session = {
      graphId,
      connected: false,
      peers: [
        {
          userId,
          displayName,
          color: this.color,
          lastSeen: Date.now(),
        },
      ],
      docVersion: 0,
    };

    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      if (origin === "remote" || this.applyingRemote) return;
      this.session = { ...this.session, docVersion: this.session.docVersion + 1 };
      this.emit();
      this.send({
        type: "ydoc-update",
        update: toBase64(update),
        userId: this.userId,
      });
      this.emitGraph();
    });
  }

  get ydoc(): Y.Doc {
    return this.doc;
  }

  connect(baseUrl: string): void {
    if (typeof window === "undefined") return;
    const wsUrl = baseUrl.replace(/^http/, "ws") + `/api/v1/ws/graphs/${this.graphId}`;
    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        this.session = { ...this.session, connected: true };
        this.emit();
        this.send({
          type: "hello",
          userId: this.userId,
          displayName: this.displayName,
          color: this.color,
          lastSeen: Date.now(),
        });
        // Ask peers for full state
        this.send({ type: "ydoc-sync-request", userId: this.userId });
        // Flush queued updates
        for (const raw of this.offlineQueue.splice(0)) {
          this.ws?.send(raw);
        }
      };
      this.ws.onclose = () => {
        this.session = { ...this.session, connected: false };
        this.emit();
      };
      this.ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            type: string;
            peers?: CollabPresence[];
            update?: string;
            userId?: string;
            toUserId?: string;
            x?: number;
            y?: number;
          };
          if (msg.type === "presence" && msg.peers) {
            this.session = { ...this.session, peers: msg.peers };
            this.emit();
          } else if (msg.type === "ydoc-update" && msg.update) {
            this.applyRemoteUpdate(msg.update);
          } else if (msg.type === "ydoc-sync-request" && msg.userId && msg.userId !== this.userId) {
            const state = Y.encodeStateAsUpdate(this.doc);
            this.send({
              type: "ydoc-sync-response",
              update: toBase64(state),
              toUserId: msg.userId,
              userId: this.userId,
            });
          } else if (
            msg.type === "ydoc-sync-response" &&
            msg.update &&
            (!msg.toUserId || msg.toUserId === this.userId)
          ) {
            this.applyRemoteUpdate(msg.update);
          } else if (msg.type === "cursor" && msg.userId) {
            const peers = this.session.peers.map((p) =>
              p.userId === msg.userId
                ? { ...p, cursor: { x: msg.x ?? 0, y: msg.y ?? 0 }, lastSeen: Date.now() }
                : p,
            );
            this.session = { ...this.session, peers };
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

  /** Replace local Yjs graph from app state (e.g. after load). */
  seedFromSnapshot(snapshot: GraphSnapshot): void {
    this.applyingRemote = true;
    try {
      this.doc.transact(() => {
        this.nodesArr.delete(0, this.nodesArr.length);
        this.edgesArr.delete(0, this.edgesArr.length);
        this.nodesArr.insert(0, snapshot.nodes);
        this.edgesArr.insert(0, snapshot.edges);
      }, "seed");
    } finally {
      this.applyingRemote = false;
    }
  }

  /** Push local edits into the shared doc (called by editor when graph changes). */
  pushLocalSnapshot(snapshot: GraphSnapshot): void {
    if (this.applyingRemote) return;
    const cur = JSON.stringify(this.snapshot());
    const next = JSON.stringify(snapshot);
    if (cur === next) return;
    this.doc.transact(() => {
      this.nodesArr.delete(0, this.nodesArr.length);
      this.edgesArr.delete(0, this.edgesArr.length);
      this.nodesArr.insert(0, snapshot.nodes);
      this.edgesArr.insert(0, snapshot.edges);
    }, "local");
  }

  snapshot(): GraphSnapshot {
    return {
      nodes: this.nodesArr.toArray(),
      edges: this.edgesArr.toArray(),
    };
  }

  broadcastCursor(x: number, y: number): void {
    this.send({ type: "cursor", userId: this.userId, x, y, lastSeen: Date.now() });
  }

  subscribe(fn: (s: CollabSession) => void): () => void {
    this.listeners.add(fn);
    fn(this.session);
    return () => this.listeners.delete(fn);
  }

  onGraphChange(fn: GraphListener): () => void {
    this.graphListeners.add(fn);
    return () => this.graphListeners.delete(fn);
  }

  private applyRemoteUpdate(b64: string): void {
    this.applyingRemote = true;
    try {
      Y.applyUpdate(this.doc, fromBase64(b64), "remote");
      this.session = { ...this.session, docVersion: this.session.docVersion + 1 };
      this.emit();
      this.emitGraph();
    } finally {
      this.applyingRemote = false;
    }
  }

  private send(payload: Record<string, unknown>): void {
    const raw = JSON.stringify(payload);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (payload.type === "ydoc-update") this.offlineQueue.push(raw);
      return;
    }
    this.ws.send(raw);
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.session);
  }

  private emitGraph(): void {
    const snap = this.snapshot();
    for (const fn of this.graphListeners) fn(snap);
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function createCollabProvider(graphId: string, userId: string, displayName: string): CollabProvider {
  return new CollabProvider(graphId, userId, displayName);
}
