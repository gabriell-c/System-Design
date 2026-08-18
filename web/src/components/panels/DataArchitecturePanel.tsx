"use client";

import { useState } from "react";
import { Plus, Trash2, Database, Key, Share2, RefreshCw } from "lucide-react";
import { useGraphStore } from "@/lib/graph-store";
import type {
  DataOwnership,
  ApiContract,
  EventTopic,
  DataLineage,
} from "@/lib/types";

export default function DataArchitecturePanel() {
  const nfr = useGraphStore((s) => s.nfr);
  const setNfr = useGraphStore((s) => s.setNfr);

  const [activeTab, setActiveTab] = useState<"ownership" | "api" | "events" | "lineage">("ownership");
  const [newItem, setNewItem] = useState("");

  // Data Ownership
  const dataOwnership: DataOwnership[] = nfr?.data_ownership ?? [];
  const addOwnership = () => {
    if (!newItem.trim()) return;
    const entry: DataOwnership = {
      entity: newItem.trim(),
      owner_team: "",
      owner_role: "",
      write_freq: "batch",
      retention_days: 365,
      pii: false,
      classification: "internal",
    };
    setNfr((prev) => ({
      ...prev,
      data_ownership: [...(prev?.data_ownership ?? []), entry],
    }));
    setNewItem("");
  };

  const removeOwnership = (index: number) => {
    setNfr((prev) => ({
      ...prev,
      data_ownership: prev?.data_ownership?.filter((_, i) => i !== index) ?? [],
    }));
  };

  // API Contracts
  const apiContracts: ApiContract[] = nfr?.api_contracts ?? [];
  const addApiContract = () => {
    if (!newItem.trim()) return;
    const entry: ApiContract = {
      service: newItem.trim(),
      endpoint: "",
      method: "GET",
      protocol: "rest",
      version: "v1",
    };
    setNfr((prev) => ({
      ...prev,
      api_contracts: [...(prev?.api_contracts ?? []), entry],
    }));
    setNewItem("");
  };

  const removeApiContract = (index: number) => {
    setNfr((prev) => ({
      ...prev,
      api_contracts: prev?.api_contracts?.filter((_, i) => i !== index) ?? [],
    }));
  };

  // Event Topics
  const eventTopics: EventTopic[] = nfr?.event_topics ?? [];
  const addEventTopic = () => {
    if (!newItem.trim()) return;
    const entry: EventTopic = {
      name: newItem.trim(),
      protocol: "kafka",
      schema_type: "jsonschema",
      retention_hours: 72,
      consumers: [],
      producers: [],
    };
    setNfr((prev) => ({
      ...prev,
      event_topics: [...(prev?.event_topics ?? []), entry],
    }));
    setNewItem("");
  };

  const removeEventTopic = (index: number) => {
    setNfr((prev) => ({
      ...prev,
      event_topics: prev?.event_topics?.filter((_, i) => i !== index) ?? [],
    }));
  };

  // Data Lineage
  const dataLineage: DataLineage[] = nfr?.data_lineage ?? [];
  const addLineage = () => {
    if (!newItem.trim()) return;
    const entry: DataLineage = {
      source_entity: newItem.trim(),
      target_entity: "",
      transform: "",
      frequency: "batch",
    };
    setNfr((prev) => ({
      ...prev,
      data_lineage: [...(prev?.data_lineage ?? []), entry],
    }));
    setNewItem("");
  };

  const removeLineage = (index: number) => {
    setNfr((prev) => ({
      ...prev,
      data_lineage: prev?.data_lineage?.filter((_, i) => i !== index) ?? [],
    }));
  };

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
          <Database size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Arquitetura de Dados</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Ownership, contratos de API, tópicos de eventos e lineage
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg">
        {[
          { id: "ownership", label: "Ownership", icon: Key },
          { id: "api", label: "API Contracts", icon: Share2 },
          { id: "events", label: "Eventos", icon: RefreshCw },
          { id: "lineage", label: "Lineage", icon: Database },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-emerald-500/20 text-emerald-300"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Ownership Tab */}
      {activeTab === "ownership" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Nome da entidade..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => e.key === "Enter" && addOwnership()}
            />
            <button
              onClick={addOwnership}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-2">
            {dataOwnership.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div>
                  <p className="text-sm font-medium text-slate-200">{entry.entity}</p>
                  <p className="text-xs text-slate-400">
                    {entry.owner_team && `${entry.owner_team} · `}
                    {entry.classification?.toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => removeOwnership(idx)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Contracts Tab */}
      {activeTab === "api" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Nome do serviço..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => e.key === "Enter" && addApiContract()}
            />
            <button
              onClick={addApiContract}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-2">
            {apiContracts.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div>
                  <p className="text-sm font-medium text-slate-200">{entry.service}</p>
                  <p className="text-xs text-slate-400">{entry.protocol?.toUpperCase()} · {entry.method}</p>
                </div>
                <button
                  onClick={() => removeApiContract(idx)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Tab */}
      {activeTab === "events" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Nome do tópico..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => e.key === "Enter" && addEventTopic()}
            />
            <button
              onClick={addEventTopic}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-2">
            {eventTopics.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div>
                  <p className="text-sm font-medium text-slate-200">{entry.name}</p>
                  <p className="text-xs text-slate-400">{entry.protocol} · {entry.schema_type}</p>
                </div>
                <button
                  onClick={() => removeEventTopic(idx)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lineage Tab */}
      {activeTab === "lineage" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Entidade origem..."
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              onKeyDown={(e) => e.key === "Enter" && addLineage()}
            />
            <button
              onClick={addLineage}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm text-white transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="space-y-2">
            {dataLineage.map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
                <div>
                  <p className="text-sm font-medium text-slate-200">{entry.source_entity}</p>
                  <p className="text-xs text-slate-400">→ {entry.target_entity || "..."}</p>
                </div>
                <button
                  onClick={() => removeLineage(idx)}
                  className="p-1 text-red-400 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
