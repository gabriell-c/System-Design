"use client";

import { NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ExternalLink } from "lucide-react";
import RichTextEditor from "@/components/ui/RichTextEditor";
import AnchorHandle from "@/components/nodes/AnchorHandle";
import { cssDirection } from "@/components/ui/NodeGradientPicker";
import { fillPatternCss } from "@/components/ui/NodeFillPatternPicker";
import { resolveFreeIcon } from "@/lib/free-icons";
import { useGraphStore } from "@/lib/graph-store";
import type {
  FreeFillPattern,
  FreeHoverEffect,
  FreeNodeData,
  FreeNodeKind,
  FreeShadow,
  FreeTextAlign,
  FreeVerticalAlign,
} from "@/lib/types";

const SHAPE_STYLES: Record<
  FreeNodeKind,
  { className: string; style?: CSSProperties }
> = {
  "free-rectangle": {
    className: "border-2 bg-[var(--surface-2)]",
  },
  "free-circle": {
    className: "rounded-full border-2 bg-[var(--surface-2)]",
  },
  "free-oval": {
    className: "rounded-full border-2 bg-[var(--surface-2)]",
    style: { aspectRatio: "16/9" },
  },
  "free-diamond": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { transform: "rotate(45deg)" },
  },
  "free-triangle": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)" },
  },
  "free-hexagon": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" },
  },
  "free-octagon": {
    className: "border-2 bg-[var(--surface-2)]",
    style: { clipPath: "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)" },
  },
  "free-arrow-right": {
    className: "rounded-md border-2 bg-[var(--accent-muted)]",
    style: { clipPath: "polygon(0% 20%, 70% 20%, 70% 0%, 100% 50%, 70% 100%, 70% 80%, 0% 80%)" },
  },
  "free-arrow-double": {
    className: "rounded-md border-2 bg-[var(--accent-muted)]",
    style: { clipPath: "polygon(0% 20%, 70% 20%, 70% 0%, 100% 50%, 70% 100%, 70% 80%, 0% 80%)" },
  },
  "free-check": {
    className: "rounded-full border-2 bg-emerald-500/20 border-emerald-400",
    style: { color: "#34d399" },
  },
  "free-x": {
    className: "rounded-full border-2 bg-rose-500/20 border-rose-400",
    style: { color: "#f43f5e" },
  },
  "free-plus": {
    className: "rounded-full border-2 bg-indigo-500/20 border-indigo-400",
    style: { color: "#818cf8" },
  },
  "free-text": {
    className: "border border-dashed border-[var(--border)] bg-transparent px-2 py-1",
  },
  "free-edit": {
    className: "border border-dashed border-[var(--accent)]/50 bg-[var(--accent-muted)]/10 px-2 py-1",
  },
  "free-image": {
    className: "overflow-hidden border-2 bg-[var(--surface-2)]",
  },
  "free-video": {
    className: "overflow-hidden border-2 bg-black/40",
  },
  "free-audio": {
    className: "border-2 bg-[var(--surface-2)] px-2 py-1",
  },
  "free-note": {
    className: "border border-amber-400/40 shadow-sm px-2 py-2",
    style: { backgroundColor: "var(--warning-bg, #fef08a)" },
  },
  "free-link": {
    className: "border-2 border-[var(--accent)]/40 bg-[var(--accent-muted)]/20 px-3 py-2",
  },
};

const MEDIA_KINDS = new Set<FreeNodeKind>(["free-image", "free-video", "free-audio"]);
const TEXT_KINDS = new Set<FreeNodeKind>(["free-text", "free-edit", "free-note"]);

const SHADOW_CLASS: Record<FreeShadow, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
};

const TEXT_ALIGN_CLASS: Record<FreeTextAlign, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

const V_ALIGN_CLASS: Record<FreeVerticalAlign, string> = {
  top: "items-start",
  center: "items-center",
  bottom: "items-end",
};

const H_ALIGN_CLASS: Record<FreeTextAlign, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
};

const HOVER_CLASS: Record<FreeHoverEffect, string> = {
  none: "",
  glow: "free-node-hover-glow",
  scale: "free-node-hover-scale",
  shadow: "free-node-hover-shadow",
};

const BORDER_STYLE_CLASS: Record<string, string> = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
};

const FONT_WEIGHT: Record<string, number | string> = {
  normal: 400,
  medium: 500,
  bold: 700,
};

function FreeNodeInner({ id, data, selected }: NodeProps<Node<FreeNodeData>>) {
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const shape = SHAPE_STYLES[data.kind];
  const isText = TEXT_KINDS.has(data.kind);
  const isMedia = MEDIA_KINDS.has(data.kind);
  const isLink = data.kind === "free-link";
  const isNote = data.kind === "free-note";

  const [shiftHeld, setShiftHeld] = useState(false);
  const aspectRef = useRef(1);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const onResizeStart = useCallback(() => {
    const el = document.querySelector(`[data-id="${id}"]`) as HTMLElement | null;
    if (el) {
      const w = el.offsetWidth || 1;
      const h = el.offsetHeight || 1;
      aspectRef.current = w / h;
    }
  }, [id]);

  const textAlign: FreeTextAlign = data.textAlign ?? "center";
  const verticalAlign: FreeVerticalAlign = data.verticalAlign ?? "center";
  const shadow: FreeShadow = data.shadow ?? (data.kind === "free-note" ? "sm" : "none");
  const hoverEffect: FreeHoverEffect = data.hoverEffect ?? "none";
  const fillPattern: FreeFillPattern = data.fillPattern ?? "none";
  const Icon = resolveFreeIcon(data.iconId);
  const iconSize = data.iconSize ?? 16;

  const patternBg = fillPatternCss(fillPattern);
  const gradient = data.backgroundGradient;

  const customStyle: CSSProperties = {
    ...shape.style,
    contain: "layout style paint",
    backgroundColor: gradient
      ? undefined
      : (data.backgroundColor ?? shape.style?.backgroundColor),
    backgroundImage: gradient
      ? `linear-gradient(${cssDirection(gradient.direction)}, ${gradient.from}, ${gradient.to})${
          patternBg ? `, ${patternBg}` : ""
        }`
      : patternBg,
    backgroundSize: patternBg && !gradient ? "8px 8px" : undefined,
    color: data.textColor,
    borderColor: data.borderColor ?? undefined,
    borderRadius: data.borderRadius != null ? `${data.borderRadius}px` : undefined,
    borderWidth: data.borderWidth != null ? `${data.borderWidth}px` : undefined,
    opacity: data.opacity != null ? data.opacity : undefined,
  };

  const fontStyle: CSSProperties = {
    color: data.textColor ?? "var(--foreground)",
    fontSize: data.fontSize != null ? `${data.fontSize}px` : undefined,
    fontWeight: data.fontWeight ? FONT_WEIGHT[data.fontWeight] : undefined,
    fontStyle: data.fontStyle === "italic" ? "italic" : undefined,
    textAlign,
  };

  function renderIcon() {
    if (!Icon) return null;
    return <Icon size={iconSize} className="shrink-0" style={{ color: data.textColor }} aria-hidden />;
  }

  function renderContent() {
    if (data.kind === "free-image" && data.mediaUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.mediaUrl}
          alt={data.label}
          className="h-full w-full object-cover"
          draggable={false}
        />
      );
    }
    if (data.kind === "free-image") {
      return <span className="text-xs text-[var(--muted-fg)]">Cole a URL da imagem nas props</span>;
    }
    if (data.kind === "free-video" && data.mediaUrl) {
      return (
        <video
          src={data.mediaUrl}
          className="h-full w-full object-contain"
          controls
          preload="metadata"
        />
      );
    }
    if (data.kind === "free-video") {
      return <span className="text-xs text-[var(--muted-fg)]">Cole a URL do vídeo nas props</span>;
    }
    if (data.kind === "free-audio" && data.mediaUrl) {
      return <audio src={data.mediaUrl} className="w-full" controls preload="metadata" />;
    }
    if (data.kind === "free-audio") {
      return <span className="text-xs text-[var(--muted-fg)]">Cole a URL do áudio nas props</span>;
    }
    if (isLink) {
      const href = data.linkUrl?.trim();
      return (
        <a
          href={href && href !== "https://" ? href : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
          style={fontStyle}
          onClick={(e) => {
            if (!href || href === "https://") e.preventDefault();
          }}
        >
          {Icon ? renderIcon() : <ExternalLink size={14} />}
          {data.label || "Link"}
        </a>
      );
    }
    if (isText) {
      return (
        <>
          {isNote ? (
            <RichTextEditor
              className="h-full w-full border-none bg-transparent"
              value={data.notes ?? data.text ?? ""}
              onChange={(html) => {
                updateNodeData(id, {
                  notes: html,
                  label: html.replace(/<[^>]+>/g, "").slice(0, 40) || "Nota",
                });
              }}
              placeholder="Escreva uma nota…"
            />
          ) : (
            <div className="flex h-full w-full gap-1.5 items-start">
              {renderIcon()}
              <textarea
                className="h-full w-full resize-none bg-transparent focus:outline-none max-h-48 overflow-y-auto"
                style={{ ...fontStyle, fontSize: data.fontSize != null ? `${data.fontSize}px` : "0.875rem" }}
                value={data.text ?? data.label}
                onChange={(e) => {
                  const val = e.target.value;
                  updateNodeData(id, {
                    text: val,
                    label: val.slice(0, 60) || "Texto",
                  });
                }}
                placeholder="Digite aqui…"
              />
            </div>
          )}
        </>
      );
    }
    return (
      <span className="flex items-center gap-1.5 font-medium" style={{ ...fontStyle, fontSize: data.fontSize != null ? `${data.fontSize}px` : "0.875rem" }}>
        {renderIcon()}
        {data.label}
      </span>
    );
  }

  const borderStyleClass = data.borderStyle ? BORDER_STYLE_CLASS[data.borderStyle] : "";

  return (
    <div
      className={`relative h-full w-full ${selected ? "ring-2 ring-[var(--accent)]/70" : ""} ${HOVER_CLASS[hoverEffect]}`}
      aria-label={data.label}
      style={{ contain: "layout style" }}
    >
      <NodeResizer
        minWidth={48}
        minHeight={32}
        isVisible={selected}
        keepAspectRatio={shiftHeld}
        lineClassName="!border-[var(--accent)]/40"
        handleClassName="!h-3 !w-3 !rounded-sm !border-indigo-300 !bg-indigo-500"
        onResizeStart={onResizeStart}
      />

      <div
        className={`flex h-full w-full border-[var(--border)] px-3 py-2 transition-[box-shadow,transform] duration-150 ${shape.className} ${SHADOW_CLASS[shadow]} ${TEXT_ALIGN_CLASS[textAlign]} ${V_ALIGN_CLASS[verticalAlign]} ${H_ALIGN_CLASS[textAlign]} ${borderStyleClass}`}
        style={customStyle}
      >
        {renderContent()}
      </div>

      {!isText && !isMedia && !isLink && (
        <>
          <AnchorHandle tone="block" nodeId={id} handleId="f-left" type="target" position={Position.Left} style={{ top: "50%" }} className={selected ? "" : "opacity-40 hover:opacity-100"} />
          <AnchorHandle tone="block" nodeId={id} handleId="f-right" type="source" position={Position.Right} style={{ top: "50%" }} className={selected ? "" : "opacity-40 hover:opacity-100"} />
          <AnchorHandle tone="block" nodeId={id} handleId="f-top" type="target" position={Position.Top} style={{ left: "50%" }} className={selected ? "" : "opacity-40 hover:opacity-100"} />
          <AnchorHandle tone="block" nodeId={id} handleId="f-bottom" type="source" position={Position.Bottom} style={{ left: "50%" }} className={selected ? "" : "opacity-40 hover:opacity-100"} />
        </>
      )}
    </div>
  );
}

const FreeNode = memo(FreeNodeInner);
FreeNode.displayName = "FreeNode";
export default FreeNode;
