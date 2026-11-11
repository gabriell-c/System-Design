/**
 * P4 — Tipos do graph-store (god-store fatiado em slices).
 *
 * `UiNotice` e `GraphSnapshot` são copiados VERBATIM de graph-store.ts.
 * `GraphState` idêntico ao original, exceto `_pendingTimeout` (removido do
 * state — agora vive em escopo de módulo em document-slice.ts). As 287+
 * call-sites de seletores continuam byte-compatíveis: mesmas chaves,
 * mesmas assinaturas.
 */
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
} from "@xyflow/react";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AnalysisResult,
  ArchEdgeData,
  ArchNodeData,
  BlockNodeData,
  CanvasComment,
  CanvasNodeData,
  CloudProvider,
  C4Level,
  FixAction,
  FreeNodeData,
  FreeNodeKind,
  GraphRecord,
  NoteNodeData,
  NodeKind,
  ProjectNfr,
  SavedView,
  SwimlaneKind,
  UserRole,
  ZoneKind,
  ZoneNodeData,
} from "../types";
import type { ProjectTemplate } from "../templates";
import type { FreeLayerDirection } from "../free-layer";
import type { ArchitectureView } from "../architecture-view";
import type { CanvasFilter } from "../canvas-filter";
import type { DiffHighlight } from "../diff-highlight";
import type { StackRecommendation } from "../stack-recommend";

export type UiNotice = {
  type: "error" | "info" | "success";
  text: string;
};

export type GraphSnapshot = {
  name: string;
  context: string;
  nfr: ProjectNfr;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  // Opcionais: snapshots antigos (persistidos) podem não trazê-los.
  excalidrawElements?: ExcalidrawElement[];
  selectedNodeIds?: string[];
  diagramKind?: string | null;
};

export type GraphState = {
  name: string;
  context: string;
  nfr: ProjectNfr;
  graphId: string | null;
  projectId: string | null; // NEW: track which project this graph belongs to
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  analysis: AnalysisResult | null;
  analyzing: boolean;
  analyzeError: string | null;
  uiNotice: UiNotice | null;
  recommendations: StackRecommendation[];
  userRole: UserRole;
  dirty: boolean;
  lastSavedAt: string | null;
  past: GraphSnapshot[];
  future: GraphSnapshot[];
  architectureView: ArchitectureView;
  canvasFilter: CanvasFilter;
  savedViewsTick: number;
  focusedZoneId: string | null;
  ownerTeam: string;
  canvasComments: CanvasComment[];
  highlightNodeIds: string[];
  blastUnreachableIds: string[];
  blastDegradedIds: string[];
  blastHighlightEdgeIds: string[];
  diffHighlights: DiffHighlight[];
  diagramKind: string | null;
  parentGraphId: string | null;
  c4ParentNodeId: string | null;
  sequenceMode: boolean;
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  lastEtag: string | null;
  setLastEtag: (etag: string | null) => void;
  saveStatus: "saved" | "saving" | "dirty" | "error";
  setSaveStatus: (status: "saved" | "saving" | "dirty" | "error") => void;
  analyzePhase: "idle" | "analyzing" | "scoring" | "review" | "done";
  setAnalyzePhase: (phase: "idle" | "analyzing" | "scoring" | "review" | "done") => void;
  excalidrawElements: ExcalidrawElement[];
  selectedExcalidrawElementId: string | null;
  setExcalidrawElements: (elements: ExcalidrawElement[]) => void;
  setSelectedExcalidrawElementId: (id: string | null) => void;
  _pendingNodesChanges: NodeChange<Node<CanvasNodeData>>[] | null;
  setName: (name: string) => void;
  setContext: (context: string) => void;
  setNfr: (nfr: ProjectNfr | ((prev: ProjectNfr) => ProjectNfr)) => void;
  setArchitectureView: (view: ArchitectureView) => void;
  setCanvasFilter: (filter: CanvasFilter) => void;
  saveView: (name: string, tags?: string[]) => SavedView;
  loadView: (view: SavedView) => void;
  setFocusedZoneId: (id: string | null) => void;
  /** P3.1.1 — drill-down para vista 4+1 */
  drillDownToView: (view: ArchitectureView) => void;
  setOwnerTeam: (team: string) => void;
  setCanvasComments: (comments: CanvasComment[]) => void;
  setHighlightNodeIds: (ids: string[]) => void;
  setDiffHighlights: (highlights: DiffHighlight[]) => void;
  setBlastRadiusHighlight: (payload: {
    unreachable: string[];
    degraded: string[];
    edgeIds: string[];
  } | null) => void;
  clearBlastRadiusHighlight: () => void;
  addPatternNodes: (nodes: Node<CanvasNodeData>[]) => void;
  applyFixFromFinding: (action: FixAction) => boolean;
  applyTemplate: (template: ProjectTemplate) => void;
  setUserRole: (role: UserRole) => void;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: string[]) => void;
  setSelectedEdgeId: (id: string | null) => void;
  clearUiNotice: () => void;
  pushUiNotice: (notice: UiNotice) => void;
  dismissRecommendations: () => void;
  onNodesChange: (changes: NodeChange<Node<CanvasNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  disconnectHandle: (nodeId: string, handleId: string) => number;
  disconnectEdge: (edgeId: string) => boolean;
  addCatalogNode: (
    catalogId: string,
    position: { x: number; y: number },
    parentId?: string | null,
  ) => boolean;
  addBlock: (domain: NodeKind, position: { x: number; y: number }, label?: string) => void;
  addZone: (
    zoneKind: ZoneKind,
    position: { x: number; y: number },
    opts?: { label?: string; provider?: CloudProvider; boundedContext?: string },
  ) => void;
  addSwimlane: (
    swimlaneKind: SwimlaneKind,
    position: { x: number; y: number },
    opts?: { label?: string },
  ) => void;
  addNote: (position: { x: number; y: number }, text?: string) => void;
  addFreeNode: (kind: FreeNodeKind, position: { x: number; y: number }, label?: string) => string;
  generateDiagramFromText: (text: string, name?: string) => { nodeId: string; nodeCount: number; edgeCount: number };
  moveFreeNodeLayer: (nodeId: string, direction: FreeLayerDirection) => void;
  applyFreeTemplate: (templateId: "simple-flow" | "decision-tree" | "process") => void;
  addCidrBlock: (position: { x: number; y: number }, cidr?: string, label?: string) => void;
  addTenantBoundary: (
    position: { x: number; y: number },
    opts?: { label?: string; tenantMode?: "pool" | "silo" | "bridge" },
  ) => void;
  applyAutoLayout: () => void;
  setC4Level: (nodeId: string, level: C4Level) => void;
  highlightCriticalPath: () => void;
  clearCriticalPathHighlight: () => void;
  setSequenceMode: (on: boolean) => void;
  updateEdgeData: (edgeId: string, patch: Partial<ArchEdgeData>) => void;
  renameNode: (id: string, label: string) => void;
  attachNodeToBlock: (nodeId: string, blockId: string) => boolean;
  detachNode: (nodeId: string) => void;
  deleteSelected: () => void;
  resolveNestingAfterDrag: (nodeId: string) => void;
  reconcileOrphanCards: () => void;
  checkpointDrag: () => void;
  updateNodeData: (
    id: string,
    patch: Partial<
      | ArchNodeData
      | ZoneNodeData
      | NoteNodeData
      | BlockNodeData
      | FreeNodeData
    >,
  ) => void;
  updateNodeConfig: (id: string, config: ArchNodeData["config"]) => void;
  setAnalysis: (analysis: AnalysisResult | null) => void;
  setAnalyzing: (value: boolean, error?: string | null) => void;
  loadGraph: (graph: GraphRecord) => void;
  loadSnapshot: (
    name: string,
    nodes: Node<CanvasNodeData>[],
    edges: Edge[],
    analysis?: AnalysisResult | null,
    context?: string,
    nfr?: ProjectNfr | null,
  ) => void;
  /**
   * Aplica estado remoto (colaboração) SEM entrar no undo, SEM marcar dirty e
   * SEM tocar excalidrawElements a não ser que o payload os carregue.
   * Fields ausentes no payload não são sobrescritos.
   */
  applyRemote: (remote: {
    nodes?: Node<CanvasNodeData>[];
    edges?: Edge[];
    excalidrawElements?: ExcalidrawElement[];
    name?: string;
    analysis?: AnalysisResult | null;
    context?: string | null;
    nfr?: ProjectNfr;
  }) => void;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
  markSaved: (id: string, etag?: string | null) => void;
};
