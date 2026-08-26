"use client";

import { useState } from "react";
import { Plus, Trash2, RefreshCw, Workflow } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";
import type { EventTopic } from "@/lib/types";
import PanelEmpty from "@/components/ui/PanelEmpty";

export default function EventCatalogPanel() {
  const nfr = useGraphStore((s) => s.nfr);
  const setNfr = useGraphStore((s) => s.setNfr);
  const pushUiNotice = useGraphStore((s) => s.pushUiNotice);

  const [newItem, setNewItem] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const topics: EventTopic[] = nfr?.event_topics ?? [];

  const addTopic = () => {
    if (!newItem.trim()) return;
    const entry: EventTopic = {
      name: newItem.trim(),
      protocol: "kafka",
      schema_type: "jsonschema",
      retention_hours: 72,
    };
    setNfr((prev) => ({
      ...prev,
      event_topics: [...(prev?.event_topics ?? []), entry],
    }));
    setNewItem("");
    pushUiNotice({ type: "success", text: "Tópico adicionado ao catálogo." });
  };

  const removeTopic = (idx: number) => {
    setNfr((prev) => ({
      ...prev,
      event_topics: prev?.event_topics?.filter((_, i) => i !== idx) ?? [],
    }));
  };

  const updateTopic = (idx: number, field: keyof EventTopic, value: string | undefined) => {
    setNfr((prev) => {
      const topics = [...(prev.event_topics ?? [])];
      topics[idx] = { ...topics[idx], [field]: value };
      return { ...prev, event_topics: topics };
    });
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
          <RefreshCw size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Event Catalog</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--muted-fg)]">
            Schema registry, versões, DLQ e retenção amarrados aos tópicos Kafka do desenho (P1.1.3).
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Nome do tópico…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-violet-500"
          onKeyDown={(e) => e.key === "Enter" && addTopic()}
        />
        <button
          onClick={addTopic}
          className="px-3 py-2 bg-violet-600 hover:bg-violet-500 rounded text-sm text-white transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-3">
        {topics.map((entry, idx) => (
          <div key={idx} className="rounded-lg border border-[var(--border)] bg-black/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-100">{entry.name}</p>
              <button
                type="button"
                onClick={() => removeTopic(idx)}
                className="p-1 text-rose-400 hover:text-rose-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label className="flex flex-col gap-2">
                <span className="text-[var(--muted)]">Protocolo</span>
                <select
                  className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-slate-100"
                  value={entry.protocol ?? "kafka"}
                  onChange={(e) => updateTopic(idx, "protocol", e.target.value)}
                >
                  <option value="kafka">Kafka</option>
                  <option value="rabbitmq">RabbitMQ</option>
                  <option value="sns">SNS</option>
                  <option value="pubsub">Pub/Sub</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[var(--muted)]">Schema</span>
                <select
                  className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-slate-100"
                  value={entry.schema_type ?? "jsonschema"}
                  onChange={(e) => updateTopic(idx, "schema_type", e.target.value)}
                >
                  <option value="json">JSON</option>
                  <option value="jsonschema">JSON Schema</option>
                  <option value="avro">Avro</option>
                  <option value="protobuf">Protobuf</option>
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[var(--muted)]">Versão</span>
                <input
                  className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-slate-100"
                  value={entry.schema_version ?? ""}
                  onChange={(e) => updateTopic(idx, "schema_version", e.target.value)}
                  placeholder="v1.0.0"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[var(--muted)]">Retenção (h)</span>
                <input
                  type="number"
                  className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-slate-100"
                  value={entry.retention_hours ?? 72}
                  onChange={(e) => updateTopic(idx, "retention_hours", e.target.value)}
                />
              </label>
            </div>
            <label className="flex flex-col gap-2">
              <span className="text-[var(--muted)]">Schema registry URL</span>
              <input
                className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-slate-100"
                value={entry.schema_registry_url ?? ""}
                onChange={(e) => updateTopic(idx, "schema_registry_url", e.target.value)}
                placeholder="https://schema-registry.internal"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[var(--muted)]">DLQ (nome do tópico)</span>
              <input
                className="rounded border border-[var(--border)] bg-[var(--surface-1)] px-2 py-1 text-slate-100"
                value={entry.dlq ?? ""}
                onChange={(e) => updateTopic(idx, "dlq", e.target.value)}
                placeholder="topic-name-dlq"
              />
            </label>
          </div>
        ))}
        {topics.length === 0 && (
          <PanelEmpty
            icon={Workflow}
            title="Nenhum tópico cadastrado"
            description="Adicione um tópico acima para documentar eventos do domínio."
          />
        )}
      </div>
    </div>
  );
}
