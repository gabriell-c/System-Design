"use client";

import { useState } from "react";
import { FileText, Lightbulb, LayoutTemplate, Database, Code, MessageSquare, Activity, Network, GitBranch } from "lucide-react";
import Toggle from "@/components/ui/Toggle";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { COMPLIANCE_OPTIONS } from "@/lib/nfr";
import { PROJECT_TEMPLATES } from "@/lib/templates";
import { useGraphStore } from "@/lib/graph-store";
import type { DataOwnership, ApiContract, EventTopic, ConsistencyPattern, DataLineage } from "@/lib/types";

const PLACEHOLDER = `Ex.: SaaS de agendamento para clínicas odontológicas.
Público: secretárias e dentistas no Brasil.
Escala inicial: ~2k usuários ativos / dia.
Restrições: LGPD, hospedagem barata no início, time de 2 devs.
Objetivo: MVP em 8 semanas com login, agenda e WhatsApp.`;

type Tab = "nfr" | "data" | "api" | "events" | "consistency" | "lineage";

export default function ContextPanel() {
  const context = useGraphStore((s) => s.context);
  const setContext = useGraphStore((s) => s.setContext);
  const nfr = useGraphStore((s) => s.nfr);
  const setNfr = useGraphStore((s) => s.setNfr);
  const applyTemplate = useGraphStore((s) => s.applyTemplate);
  const dirty = useGraphStore((s) => s.dirty);
  const nodes = useGraphStore((s) => s.nodes);
  const { confirm, dialog } = useConfirmDialog();
  const [activeTab, setActiveTab] = useState<Tab>("nfr");

  async function applyProjectTemplate(id: string) {
    const tpl = PROJECT_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (dirty || nodes.length > 0) {
      const ok = await confirm({
        title: `Aplicar template "${tpl.label}"?`,
        description: "Isso substitui o canvas, o brief e os NFRs atuais pelo modelo do template.",
        consequences: "Alterações não salvas no desenho atual serão perdidas (Ctrl+Z desfaz).",
        confirmLabel: "Aplicar template",
        tone: "danger",
      });
      if (!ok) return;
    }
    applyTemplate(tpl);
  }

  function addDataOwnership() {
    const item: DataOwnership = { entity: "", owner_team: "", classification: "internal" };
    setNfr({ ...nfr, data_ownership: [...(nfr.data_ownership || []), item] });
  }

  function updateDataOwnership(index: number, field: keyof DataOwnership, value: string | boolean | number) {
    const list = [...(nfr.data_ownership || [])];
    list[index] = { ...list[index], [field]: value as never };
    setNfr({ ...nfr, data_ownership: list });
  }

  function removeDataOwnership(index: number) {
    const list = [...(nfr.data_ownership || [])];
    list.splice(index, 1);
    setNfr({ ...nfr, data_ownership: list });
  }

  function addApiContract() {
    const item: ApiContract = { service: "", protocol: "rest" };
    setNfr({ ...nfr, api_contracts: [...(nfr.api_contracts || []), item] });
  }

  function updateApiContract(index: number, field: keyof ApiContract, value: string) {
    const list = [...(nfr.api_contracts || [])];
    list[index] = { ...list[index], [field]: value as never };
    setNfr({ ...nfr, api_contracts: list });
  }

  function removeApiContract(index: number) {
    const list = [...(nfr.api_contracts || [])];
    list.splice(index, 1);
    setNfr({ ...nfr, api_contracts: list });
  }

  function addEventTopic() {
    const item: EventTopic = { name: "", protocol: "kafka" };
    setNfr({ ...nfr, event_topics: [...(nfr.event_topics || []), item] });
  }

  function updateEventTopic(index: number, field: keyof EventTopic, value: string | number) {
    const list = [...(nfr.event_topics || [])];
    list[index] = { ...list[index], [field]: value as never };
    setNfr({ ...nfr, event_topics: list });
  }

  function removeEventTopic(index: number) {
    const list = [...(nfr.event_topics || [])];
    list.splice(index, 1);
    setNfr({ ...nfr, event_topics: list });
  }

  function addConsistencyPattern() {
    const list = nfr.consistency_patterns ? { ...nfr.consistency_patterns } : {};
    setNfr({ ...nfr, consistency_patterns: list });
  }

  function updateConsistencyPattern(key: string, value: ConsistencyPattern) {
    const list = nfr.consistency_patterns ? { ...nfr.consistency_patterns } : {};
    list[key] = value;
    setNfr({ ...nfr, consistency_patterns: list });
  }

  function removeConsistencyPattern(key: string) {
    const list = nfr.consistency_patterns ? { ...nfr.consistency_patterns } : {};
    delete list[key];
    setNfr({ ...nfr, consistency_patterns: list });
  }

  function addDataLineage() {
    const item: DataLineage = { source_entity: "", target_entity: "" };
    setNfr({ ...nfr, data_lineage: [...(nfr.data_lineage || []), item] });
  }

  function updateDataLineage(index: number, field: keyof DataLineage, value: string) {
    const list = [...(nfr.data_lineage || [])];
    list[index] = { ...list[index], [field]: value as never };
    setNfr({ ...nfr, data_lineage: list });
  }

  function removeDataLineage(index: number) {
    const list = [...(nfr.data_lineage || [])];
    list.splice(index, 1);
    setNfr({ ...nfr, data_lineage: list });
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "nfr", label: "NFRs", icon: <LayoutTemplate size={12} /> },
    { key: "data", label: "Dados", icon: <Database size={12} /> },
    { key: "api", label: "APIs", icon: <Code size={12} /> },
    { key: "events", label: "Eventos", icon: <Activity size={12} /> },
    { key: "consistency", label: "Consistência", icon: <Network size={12} /> },
    { key: "lineage", label: "Lineage", icon: <GitBranch size={12} /> },
  ];

  return (
    <div className="space-y-5 px-4 py-4">
      {dialog}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
          <FileText size={16} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-100">Contexto e NFRs</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
            Brief livre + restrições mensuráveis. A análise e o checklist de kickoff usam os dois.
          </p>
        </div>
      </div>

      <section>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-300">
          <LayoutTemplate size={12} />
          Templates de projeto
        </p>
        <ul className="grid gap-1.5">
          {PROJECT_TEMPLATES.map((tpl) => (
            <li key={tpl.id}>
              <button
                type="button"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-cyan-400/30 hover:bg-white/[0.03]"
                onClick={() => void applyProjectTemplate(tpl.id)}
              >
                <span className="block text-sm font-medium text-slate-100">{tpl.label}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{tpl.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500" htmlFor="project-context">
          Brief
        </label>
        <textarea
          id="project-context"
          className="mt-1 min-h-[100px] w-full resize-y rounded-lg border border-white/10 bg-[#0d1219] px-3 py-2 text-sm leading-relaxed text-slate-100 outline-none focus:border-cyan-400/50"
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={PLACEHOLDER}
          spellCheck
        />
        <p className="mt-1 text-[11px] text-slate-500">{context.trim().length} caracteres</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab.key
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* NFR Tab */}
      {activeTab === "nfr" && (
        <section className="space-y-3 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">NFRs estruturados</p>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="Usuários / dia" value={nfr.users_per_day} onChange={(v) => setNfr({ ...nfr, users_per_day: v })} />
            <NumField label="Budget US$/mês" value={nfr.budget_usd_month} onChange={(v) => setNfr({ ...nfr, budget_usd_month: v })} />
            <NumField label="Disponibilidade %" value={nfr.availability_pct} onChange={(v) => setNfr({ ...nfr, availability_pct: v })} />
            <NumField label="Latência p99 (ms)" value={nfr.latency_p99_ms} onChange={(v) => setNfr({ ...nfr, latency_p99_ms: v })} />
            <NumField label="Time (pessoas)" value={nfr.team_size} onChange={(v) => setNfr({ ...nfr, team_size: v })} />
            <NumField label="Prazo (semanas)" value={nfr.deadline_weeks} onChange={(v) => setNfr({ ...nfr, deadline_weeks: v })} />
          </div>

          <div>
            <p className="mb-1.5 text-[11px] text-slate-500">Compliance</p>
            <div className="flex flex-wrap gap-1.5">
              {COMPLIANCE_OPTIONS.map((opt) => {
                const on = nfr.compliance.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      on
                        ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-100"
                        : "border-white/10 text-slate-400 hover:border-white/20"
                    }`}
                    onClick={() =>
                      setNfr({
                        ...nfr,
                        compliance: on ? nfr.compliance.filter((c) => c !== opt) : [...nfr.compliance, opt],
                      })
                    }
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">Caminho até produção</p>
            {(
              [
                ["has_dev", "Ambiente de desenvolvimento"],
                ["has_staging", "Staging / homologação"],
                ["has_prod", "Produção"],
                ["has_ci_cd", "CI/CD"],
                ["has_backups", "Backups"],
                ["has_monitoring_plan", "Plano de monitoramento"],
              ] as const
            ).map(([key, label]) => (
              <Toggle
                key={key}
                checked={nfr.environments[key]}
                onChange={(checked) =>
                  setNfr({
                    ...nfr,
                    environments: { ...nfr.environments, [key]: checked },
                  })
                }
                label={<span className="text-xs">{label}</span>}
                className="py-1.5"
              />
            ))}
          </div>
        </section>
      )}

      {/* Data Ownership Tab */}
      {activeTab === "data" && (
        <section className="pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Data Ownership</p>
            <button
              type="button"
              className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/30"
              onClick={addDataOwnership}
            >
              + Entidade
            </button>
          </div>
          {(nfr.data_ownership || []).length === 0 && (
            <p className="text-xs text-slate-500 italic">Nenhuma entidade de dados definida. Adicione para mapear ownership e classificação.</p>
          )}
          {(nfr.data_ownership || []).map((item, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Entidade (ex: users, orders)"
                  value={item.entity}
                  onChange={(e) => updateDataOwnership(index, "entity", e.target.value)}
                />
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Owner team"
                  value={item.owner_team || ""}
                  onChange={(e) => updateDataOwnership(index, "owner_team", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  value={item.classification || "internal"}
                  onChange={(e) => updateDataOwnership(index, "classification", e.target.value)}
                >
                  <option value="public">Público</option>
                  <option value="internal">Interno</option>
                  <option value="confidential">Confidencial</option>
                  <option value="restricted">Restrito</option>
                </select>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={item.pii || false}
                    onChange={(e) => updateDataOwnership(index, "pii", e.target.checked)}
                    className="rounded border-white/10"
                  />
                  <span className="text-[11px] text-slate-400">PII</span>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeDataOwnership(index)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* API Contracts Tab */}
      {activeTab === "api" && (
        <section className="pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">API Contracts</p>
            <button
              type="button"
              className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/30"
              onClick={addApiContract}
            >
              + Contrato
            </button>
          </div>
          {(nfr.api_contracts || []).length === 0 && (
            <p className="text-xs text-slate-500 italic">Nenhum contrato de API definido. Adicione para documentar interfaces.</p>
          )}
          {(nfr.api_contracts || []).map((item, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Serviço"
                  value={item.service}
                  onChange={(e) => updateApiContract(index, "service", e.target.value)}
                />
                <select
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  value={item.protocol || "rest"}
                  onChange={(e) => updateApiContract(index, "protocol", e.target.value)}
                >
                  <option value="rest">REST</option>
                  <option value="graphql">GraphQL</option>
                  <option value="grpc">gRPC</option>
                  <option value="async">Async</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Endpoint (ex: /v1/users)"
                  value={item.endpoint || ""}
                  onChange={(e) => updateApiContract(index, "endpoint", e.target.value)}
                />
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Versão"
                  value={item.version || ""}
                  onChange={(e) => updateApiContract(index, "version", e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeApiContract(index)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Event Catalog Tab */}
      {activeTab === "events" && (
        <section className="pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Event Catalog</p>
            <button
              type="button"
              className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/30"
              onClick={addEventTopic}
            >
              + Tópico
            </button>
          </div>
          {(nfr.event_topics || []).length === 0 && (
            <p className="text-xs text-slate-500 italic">Nenhum tópico de evento definido. Adicione para mapear eventos do domínio.</p>
          )}
          {(nfr.event_topics || []).map((item, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Nome do tópico (ex: order.created)"
                  value={item.name}
                  onChange={(e) => updateEventTopic(index, "name", e.target.value)}
                />
                <select
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  value={item.protocol || "kafka"}
                  onChange={(e) => updateEventTopic(index, "protocol", e.target.value)}
                >
                  <option value="kafka">Kafka</option>
                  <option value="rabbitmq">RabbitMQ</option>
                  <option value="sns">AWS SNS</option>
                  <option value="pubsub">GCP Pub/Sub</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Schema type (avro, protobuf, jsonschema)"
                  value={item.schema_type || ""}
                  onChange={(e) => updateEventTopic(index, "schema_type", e.target.value)}
                />
                <input
                  type="number"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Retenção (horas)"
                  value={item.retention_hours || ""}
                  onChange={(e) => updateEventTopic(index, "retention_hours", Number(e.target.value))}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeEventTopic(index)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Consistency Patterns Tab */}
      {activeTab === "consistency" && (
        <section className="pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Padrões de Consistência</p>
            <button
              type="button"
              className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/30"
              onClick={addConsistencyPattern}
            >
              + Padrão
            </button>
          </div>
          <p className="text-xs text-slate-500">Defina o padrão de consistência para cada domínio ou serviço crítico.</p>
          {Object.entries(nfr.consistency_patterns || {}).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-white/10 bg-black/20 p-3 flex items-center gap-2">
              <span className="flex-1 text-xs text-slate-300 font-mono">{key}</span>
              <select
                className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                value={value}
                onChange={(e) => updateConsistencyPattern(key, e.target.value as ConsistencyPattern)}
              >
                <option value="strong">Strong</option>
                <option value="eventual">Eventual</option>
                <option value="causal">Causal</option>
                <option value="session">Session</option>
              </select>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() => removeConsistencyPattern(key)}
              >
                ✕
              </button>
            </div>
          ))}
          {Object.keys(nfr.consistency_patterns || {}).length === 0 && (
            <p className="text-xs text-slate-500 italic">Nenhum padrão de consistência definido.</p>
          )}
        </section>
      )}

      {/* Data Lineage Tab */}
      {activeTab === "lineage" && (
        <section className="pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Data Lineage</p>
            <button
              type="button"
              className="rounded-md bg-cyan-500/20 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500/30"
              onClick={addDataLineage}
            >
              + Linage
            </button>
          </div>
          {(nfr.data_lineage || []).length === 0 && (
            <p className="text-xs text-slate-500 italic">Nenhum lineage definido. Adicione para rastrear fluxo de dados.</p>
          )}
          {(nfr.data_lineage || []).map((item, index) => (
            <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Entidade fonte (ex: orders)"
                  value={item.source_entity}
                  onChange={(e) => updateDataLineage(index, "source_entity", e.target.value)}
                />
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Entidade destino (ex: analytics_db)"
                  value={item.target_entity}
                  onChange={(e) => updateDataLineage(index, "target_entity", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Transformação (opcional)"
                  value={item.transform || ""}
                  onChange={(e) => updateDataLineage(index, "transform", e.target.value)}
                />
                <input
                  type="text"
                  className="rounded-md border border-white/10 bg-[#0d1219] px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-400/50"
                  placeholder="Frequência (ex: real-time, daily)"
                  value={item.frequency || ""}
                  onChange={(e) => updateDataLineage(index, "frequency", e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeDataLineage(index)}
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="rounded-lg border border-white/8 bg-black/20 p-3 text-xs leading-relaxed text-slate-400">
        <p className="mb-1.5 flex items-center gap-1.5 font-medium text-slate-300">
          <Lightbulb size={12} className="text-amber-300" />
          Dica
        </p>
        Depois do brief, abra a aba <strong className="text-slate-300">Kickoff</strong> para ver o que ainda falta
        (auth, obs, ambientes…).
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block text-[11px] text-slate-500">
      {label}
      <input
        type="number"
        className="mt-1 w-full rounded-lg border border-white/10 bg-[#0d1219] px-2.5 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400/50"
        value={value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") onChange(null);
          else onChange(Number(raw));
        }}
      />
    </label>
  );
}
