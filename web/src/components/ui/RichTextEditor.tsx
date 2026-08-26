"use client";

import { useEffect, useRef, useCallback } from "react";

const FONT_SIZES = ["12px", "14px", "16px", "18px", "24px"];
const COLORS = ["#f1f5f9", "#94a3b8", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];

type Props = {
  value?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

function applyFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export default function RichTextEditor({
  value = "",
  onChange,
  placeholder = "输入内容...",
  className = "",
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastContent = useRef(value);

  useEffect(() => {
    if (editorRef.current && lastContent.current !== value) {
      editorRef.current.innerHTML = value || "";
      lastContent.current = value;
    }
  }, [value]);

  const handleChange = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (html !== lastContent.current) {
        lastContent.current = html;
        onChange(html);
      }
    }
  }, [onChange]);

  return (
    <div className={`border border-[var(--border)] bg-[var(--surface-1)] rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 border-b border-[var(--border)] bg-black/20">
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          title="粗体"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          title="斜体"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="4" x2="10" y2="4"></line>
            <line x1="14" y1="20" x2="5" y2="20"></line>
            <line x1="15" y1="4" x2="9" y2="20"></line>
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          title="下划线"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 3v7a6 6 0 0 0 12 0V3"></path>
            <line x1="4" y1="21" x2="20" y2="21"></line>
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("strikeThrough"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          title="删除线"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 4H9a3 3 0 0 0-2.83 4"></path>
            <path d="M14 12a4 4 0 0 1 0 8H6"></path>
            <line x1="4" y1="12" x2="20" y2="12"></line>
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("insertCode"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)] font-mono text-xs"
          title="代码"
        >
          &lt;/&gt;
        </button>

        <div className="w-px h-5 bg-[var(--border)] mx-1" />

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          title="无序列表"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="8" y1="6" x2="21" y2="6"></line>
            <line x1="8" y1="12" x2="21" y2="12"></line>
            <line x1="8" y1="18" x2="21" y2="18"></line>
            <circle cx="4" cy="6" r="1" fill="currentColor"></circle>
            <circle cx="4" cy="12" r="1" fill="currentColor"></circle>
            <circle cx="4" cy="18" r="1" fill="currentColor"></circle>
          </svg>
        </button>
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); applyFormat("insertOrderedList"); }}
          className="h-7 w-7 flex items-center justify-center rounded text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          title="有序列表"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="10" y1="6" x2="21" y2="6"></line>
            <line x1="10" y1="12" x2="21" y2="12"></line>
            <line x1="10" y1="18" x2="21" y2="18"></line>
            <text x="3" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
            <text x="3" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
            <text x="3" y="20" fontSize="7" fill="currentColor" stroke="none">3</text>
          </svg>
        </button>

        <div className="w-px h-5 bg-[var(--border)] mx-1" />

        {/* Font size */}
        <select
          className="h-7 px-2 text-xs bg-[var(--surface-2)] border border-[var(--border)] rounded text-slate-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          onChange={(e) => { e.preventDefault(); applyFormat("fontSize", e.target.value); }}
          defaultValue=""
        >
          <option value="" disabled>字号</option>
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>

        {/* Text color */}
        <div className="flex items-center gap-0.5">
          <input
            type="color"
            className="w-6 h-6 rounded border border-[var(--border)] bg-transparent cursor-pointer"
            onChange={(e) => { e.preventDefault(); applyFormat("foreColor", e.target.value); }}
            defaultValue="#f1f5f9"
          />
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); applyFormat("foreColor", color); }}
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleChange}
        onBlur={handleChange}
        className="min-h-[160px] max-h-[400px] overflow-y-auto px-3 py-2 text-sm leading-relaxed text-slate-100 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_code]:bg-black/40 [&_code]:px-1 [&_code]:font-mono [&_code]:text-xs"
        data-placeholder={placeholder}
        style={placeholder ? ({ "--placeholder": `"${placeholder}"` } as React.CSSProperties) : undefined}
      />
    </div>
  );
}
