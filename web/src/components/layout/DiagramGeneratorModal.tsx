"use client";

import { useState } from "react";
import { useProjectStore } from "@/lib/project-store";
import { useGraphStore } from "@/lib/graph-store";

export default function DiagramGeneratorModal({ onClose }: { onClose: () => void }) {
  const { activeProjectId } = useProjectStore();
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);
  const generateDiagramFromText = useGraphStore((s) => s.generateDiagramFromText);
  const reset = useGraphStore((s) => s.reset);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!activeProjectId) {
      pushUiNotice({ type: "error", text: "Nenhum projeto ativo." });
      return;
    }
    if (!text.trim()) {
      pushUiNotice({ type: "error", text: "Digite um texto para o diagrama." });
      return;
    }
    setLoading(true);
    try {
      // Reset to clear existing nodes
      reset();
      // Generate diagram from text
      const result = generateDiagramFromText(text.trim(), name.trim() || "Diagrama gerado");
      if (result.nodeCount > 0) {
        pushUiNotice({ type: "success", text: `Diagrama gerado: ${result.nodeCount} nós, ${result.edgeCount} conexões.` });
        // Close modal after successful generation
        setTimeout(onClose, 500);
      }
    } catch (err: any) {
      pushUiNotice({ type: "error", text: err?.message || "Erro ao gerar diagrama" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-[var(--surface-1)] w-full max-w-2xl rounded-lg p-4 shadow-xl">
        <h2 className="text-lg font-semibold text-[var(--foreground)] mb-2">Criar Diagrama a partir de Texto</h2>
        <div className="mb-2">
          <label className="block text-xs text-[var(--muted)]">Nome (opcional)</label>
          <input
            className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm text-[var(--foreground)]"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ex: Fluxo de Processamento"
          />
        </div>
        <div className="mb-2">
          <label className="block text-xs text-[var(--muted)]">Texto do diagrama</label>
          <textarea
            className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm text-[var(--foreground)]"
            rows={8}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Cole aqui a descrição do seu diagrama...

Exemplo:
1. Roteiro pronto
2. Tratamento com IA
3. Eleven labs (áudio)
4. Hey gen (vídeo)
5. Estúdio"
          />
        </div>
        <div className="mb-2 flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={loading || !text.trim()}
            className="rounded bg-[var(--accent)] px-3 py-1 text-sm text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            {loading ? "Gerando…" : "Gerar Diagrama"}
          </button>
          <button
            onClick={onClose}
            className="rounded border border-[var(--border)] px-3 py-1 text-sm text-[var(--muted-fg)] transition hover:bg-[var(--surface-3)]"
          >
            Fechar
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] mt-2">
          Dica: use numeração (1., 2., 3.) ou marcadores (-) para separar os passos.
        </p>
      </div>
    </div>
  );
}
