"use client";

import {
  Bot,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  Save,
  Sparkles,
} from "lucide-react";
import PanelHeader from "@/components/ui/PanelHeader";
import { useEffect, useState } from "react";
import CustomSelect from "@/components/ui/Select";
import Toggle from "@/components/ui/Toggle";
import { api, type AiProvider, type AiSettings, type AiSettingsDraft, type AiUsage } from "@/lib/api";

// Mesma chave lida pelo EditorShell (auto-analyze) — fonte única de verdade.
const AUTO_ANALYZE_KEY = "archia-auto-analyze";

const PROVIDERS: { id: AiProvider; label: string; hint: string; base: string; model: string }[] = [
  {
    id: "omniroute",
    label: "OmniRoute",
    hint: "Gateway local OpenAI-compatible",
    base: "http://localhost:20128/v1",
    model: "auto/coding",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "api.openai.com",
    base: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "Claude Messages API",
    base: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest",
  },
  {
    id: "custom",
    label: "Custom / OpenAI-compat",
    hint: "Qualquer endpoint /v1/chat/completions",
    base: "https://api.example.com/v1",
    model: "custom-model",
  },
];

export default function SettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<AiSettings | null>(null);

  const [provider, setProvider] = useState<AiProvider>("omniroute");
  const [baseUrl, setBaseUrl] = useState("http://localhost:20128/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("auto/coding");
  const [enabled, setEnabled] = useState(true);
  // Item 37 — consentimento de envio de dados do grafo a provedor externo.
  const [llmDataConsent, setLlmDataConsent] = useState(false);
  // Item 41 — badge de uso do dia; null → bloco oculto (erro ou ainda
  // carregando). Cache de 60s é módulo-level em api.ts.
  const [usage, setUsage] = useState<AiUsage | null>(null);
  // false no SSR; sincroniza com a chave localStorage após mount (evita
  // mismatch de hidratação — o toggle escreve no localStorage, o EditorShell lê daí).
  const [autoAnalyze, setAutoAnalyze] = useState(false);

  useEffect(() => {
    try {
      setAutoAnalyze(localStorage.getItem(AUTO_ANALYZE_KEY) === "1");
    } catch {
      /* localStorage indisponível — mantém o padrão desligado */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .getAiSettings()
      .then((data) => {
        if (!alive) return;
        setRemote(data);
        setProvider(data.provider);
        setBaseUrl(data.base_url);
        setModel(data.model);
        setEnabled(data.enabled);
        setLlmDataConsent(data.llm_data_consent ?? false);
        setApiKey("");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Falha ao carregar configurações");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Item 41 — uso do dia (badge): erro → mantém usage null → bloco oculto,
  // sem crash; cache de 60s vive no api.ts.
  useEffect(() => {
    let alive = true;
    api
      .getAiUsage()
      .then((u) => {
        if (alive) setUsage(u);
      })
      .catch(() => {
        /* item 41 — endpoint indisponível: esconde o bloco, não derruba o painel */
      });
    return () => {
      alive = false;
    };
  }, []);

  function applyPreset(next: AiProvider) {
    setProvider(next);
    const preset = PROVIDERS.find((p) => p.id === next);
    if (!preset) return;
    setBaseUrl(preset.base);
    setModel(preset.model);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      const data = await api.updateAiSettings({
        provider,
        base_url: baseUrl.trim(),
        model: model.trim(),
        enabled,
        llm_data_consent: llmDataConsent,
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
      });
      setRemote(data);
      setApiKey("");
      setStatus("Configuração de IA salva. As próximas análises usam este provedor.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    // Testa o draft atual SEM salvar: o endpoint usa os campos informados
    // (e a chave salva quando api_key é omitido).
    setTesting(true);
    setStatus(null);
    setError(null);
    const draft: AiSettingsDraft = {
      provider,
      base_url: baseUrl.trim(),
      model: model.trim(),
      ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
    };
    try {
      const result = await api.testAiSettings(draft);
      if (result.ok) {
        setStatus(`${result.detail}${result.latency_ms != null ? ` · ${result.latency_ms}ms` : ""}`);
      } else {
        setError(result.detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no teste");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-8 text-sm text-[var(--muted-fg)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando configurações…
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <PanelHeader
        icon={Bot}
        chipClass="bg-violet-500/15 text-violet-300"
        title="Provedor de IA"
        subtitle="Configure URL, chave e modelo usados pelos agentes de análise. A chave nunca é exibida por completo."
      />

      <Toggle
        checked={enabled}
        onChange={setEnabled}
        label={
          <>
            <Sparkles size={14} className="text-indigo-300" />
            Usar IA nas análises (senão só heurística)
          </>
        }
      />

      {/* Item 37 — consentimento de envio de dados do grafo a provedor externo. */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3">
        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
            checked={llmDataConsent}
            onChange={(e) => setLlmDataConsent(e.target.checked)}
          />
          <span className="min-w-0">
            <span className="block font-medium text-[var(--foreground)]">
              Enviar dados do grafo para provedor externo
            </span>
            <span className="block text-[12px] leading-relaxed text-[var(--muted)]">
              Quando ativo, os labels/notas/contexto do grafo são enviados ao
              provedor de IA escolhido.
            </span>
          </span>
        </label>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          <PlugZap size={12} />
          Provider
        </label>
        <CustomSelect
          className="mt-1"
          value={provider}
          options={PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(value) => applyPreset(value as AiProvider)}
        />
        <p className="mt-1 text-sm text-[var(--muted)]">{PROVIDERS.find((p) => p.id === provider)?.hint}</p>
      </div>

      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="ai-base">
          Base URL
        </label>
        <input
          id="ai-base"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          spellCheck={false}
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="ai-key">
          <KeyRound size={12} />
          API Key
        </label>
        <div className="mt-1 flex gap-1.5">
          <input
            id="ai-key"
            type={showKey ? "text" : "password"}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              remote?.api_key_set
                ? `Salva: ${remote.api_key_masked} (deixe vazio para manter)`
                : "Cole a chave aqui"
            }
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="btn-ghost px-2"
            aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
            onClick={() => setShowKey((v) => !v)}
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]" htmlFor="ai-model">
          Model
        </label>
        <input
          id="ai-model"
          className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 font-mono text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-[var(--accent)]/50"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="gpt-4o-mini"
          spellCheck={false}
        />
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-3">
        <Toggle
          checked={autoAnalyze}
          onChange={(v) => {
            setAutoAnalyze(v);
            try {
              localStorage.setItem(AUTO_ANALYZE_KEY, v ? "1" : "0");
            } catch {
              /* ignore */
            }
          }}
          label={
            <span className="min-w-0">
              <span className="block font-medium text-[var(--foreground)]">Análise automática</span>
              <span className="block text-[12px] leading-relaxed text-[var(--muted)]">
                Roda a análise em silêncio ~2s após mudanças no canvas (desligado por padrão).
              </span>
            </span>
          }
        />
      </div>

      {/* Item 41 — badge de uso do dia; oculto (usage === null) em erro ou
      *  antes do fetch completar. Cache de 60s evita refetch a cada mount. */}
      {usage && (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--muted)]">
          Análises hoje: {usage.analyze_used}/{usage.limit} · auto {usage.auto_used}/{usage.auto_limit}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <button type="button" className="btn-primary flex w-full items-center justify-center gap-2" disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar configuração
        </button>
        <button
          type="button"
          className="btn-ghost flex w-full items-center justify-center gap-2"
          disabled={testing}
          onClick={() => void testConnection()}
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Testar conexão
        </button>
      </div>

      {status && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-100">{status}</p>
      )}
      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">{error}</p>
      )}
    </div>
  );
}
