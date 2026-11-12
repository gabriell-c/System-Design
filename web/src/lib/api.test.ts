import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// Reescreve importadores relativos sem extensão ("./api" → "./api.ts" e seu
// grafo de módulos) para os imports dinâmicos abaixo.
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

/**
 * Testes de api.ts: tratamento 409 (ApiConflictError com etag/updated_at) e
 * cabeçalho If-Match. fetch é mockado.
 *
 * (Sem lógica de retry no módulo — verificado por grep: nenhum retry/backoff;
 * a semântica de conflito é reativa, via ApiConflictError + lastEtag.)
 */

const realFetch = globalThis.fetch;
let nextResponses: unknown[] = [];

function mockFetchSequence(sequence: Array<[number, Record<string, unknown>?]>) {
  nextResponses = sequence;
  globalThis.fetch = (async () => {
    const entry = nextResponses.shift() ?? [200, {}];
    const status = entry[0];
    const body = entry[1];
    return new Response(body ? JSON.stringify(body) : null, {
      status,
      statusText: String(status),
    });
  }) as typeof fetch;
}

test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("409 → ApiConflictError com serverEtag/updatedAt do body", async () => {
  const { api, ApiConflictError } = await import("./api");
  mockFetchSequence([
    [
      409,
      {
        detail: {
          code: "graph_conflict",
          message: "graph was modified",
          server_etag: "etag-9",
          updated_at: "2026-01-01T00:00:00Z",
        },
      },
    ],
  ]);
  let caught: unknown;
  try {
    await api.updateGraph("g1", { name: "x" } as never, { ifMatch: "etag-1" });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ApiConflictError, `esperado ApiConflictError, veio: ${String(caught)}`);
  assert.equal((caught as ApiConflictError).status, 409);
  assert.equal((caught as ApiConflictError).serverEtag, "etag-9");
  assert.equal((caught as ApiConflictError).updatedAt, "2026-01-01T00:00:00Z");
  assert.match((caught as ApiConflictError).message, /graph was modified/);
});

test("409 com detail string simples ainda lança ApiConflictError", async () => {
  const { api, ApiConflictError } = await import("./api");
  mockFetchSequence([[409, { detail: "conflicto" }]]);
  let caught: unknown;
  try {
    await api.getGraph("g1");
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ApiConflictError);
  assert.match((caught as ApiConflictError).message, /conflicto/);
});

test("5xx → Error genérico (não 409)", async () => {
  const { api, ApiConflictError } = await import("./api");
  mockFetchSequence([[500, { detail: "boom" }]]);
  let caught: unknown;
  try {
    await api.getGraph("g1");
  } catch (err) {
    caught = err;
  }
  // api.ts lança `new Error(detail)` para erros que não são 409 (não existe classe ApiError)
  assert.ok(caught instanceof Error);
  assert.ok(!(caught instanceof ApiConflictError), "500 não deve ser ApiConflictError");
  assert.match((caught as Error).message, /boom/);
});

test("200 → JSON parseado; If-Match enviado apenas quando ifMatch presente", async () => {
  const { api } = await import("./api");
  const seen: Array<{ url: string; ifMatch: string | undefined }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string | undefined>;
    seen.push({ url: String(url), ifMatch: headers["If-Match"] });
    return new Response(JSON.stringify({ id: "g1", name: "n" }), { status: 200, statusText: "OK" });
  }) as typeof fetch;
  const res = await api.updateGraph("g1", { name: "n" } as never, { ifMatch: "etag-42" });
  assert.equal(res.id, "g1");
  assert.equal(seen[0]?.ifMatch, "etag-42");
  assert.match(seen[0]?.url ?? "", /graphs\/g1/);

  await api.updateGraph("g1", { name: "n" } as never, { force: true });
  assert.equal(seen[1]?.ifMatch, undefined, "force:true não envia If-Match");
});

test("204/2xx sem body → undefined (sem crash no json parse)", async () => {
  const { api } = await import("./api");
  globalThis.fetch = (async () => new Response(null, { status: 204, statusText: "No Content" })) as typeof fetch;
  const res = await api.deleteGraph("g1");
  assert.equal(res, undefined);
});

test("testAiSettings: sem draft → POST sem body; com draft → body JSON do draft", async () => {
  const { api } = await import("./api");
  const seen: Array<{ url: string; body: string | null }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    seen.push({ url: String(url), body: typeof init?.body === "string" ? init.body : null });
    return new Response(JSON.stringify({ ok: true, detail: "ok", latency_ms: 12 }), {
      status: 200,
      statusText: "OK",
    });
  }) as typeof fetch;

  const r1 = await api.testAiSettings();
  assert.equal(r1.ok, true);
  assert.match(seen[0]?.url ?? "", /\/api\/v1\/settings\/ai\/test$/);
  assert.equal(seen[0]?.body, null, "sem draft → POST sem body (contrato antigo)");

  const draft: import("./api").AiSettingsDraft = {
    provider: "openai",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  };
  await api.testAiSettings(draft);
  assert.deepEqual(JSON.parse(seen[1]?.body ?? "{}"), draft, "draft sem api_key é enviado sem a chave");

  const withKey = { ...draft, api_key: "sk-test" };
  await api.testAiSettings(withKey);
  assert.deepEqual(JSON.parse(seen[2]?.body ?? "{}"), withKey, "api_key do draft é enviado quando presente");
});

test("getAiUsage: shape do endpoint + cache em memória de 60s no módulo", async () => {
  const { api } = await import("./api");
  const usageFixture: import("./api").AiUsage = {
    day: "2026-11-11",
    analyze_used: 12,
    auto_used: 3,
    llm_calls: 4,
    limit: 50,
    auto_limit: 20,
  };
  const seen: string[] = [];
  globalThis.fetch = (async (url: unknown, _init?: RequestInit) => {
    seen.push(String(url));
    return new Response(JSON.stringify(usageFixture), {
      status: 200,
      statusText: "OK",
    });
  }) as typeof fetch;

  const r1 = await api.getAiUsage();
  assert.deepEqual(r1, usageFixture);
  assert.match(seen[0] ?? "", /\/api\/v1\/settings\/ai\/usage$/);

  const r2 = await api.getAiUsage();
  assert.deepEqual(r2, r1, "segunda chamada dentro de 60s usa o cache");
  assert.equal(seen.length, 1, "cache do módulo evita o segundo fetch");
});

// ============================================================
// S3b — contrato (d): métodos de simulação/resiliência + 429
// (ApiRateLimitError com retryAfter number, duck-typed pelo S3a)
// ============================================================

test("runSimulationPreset: POST /simulations/run-preset, signal, output_format json por padrão", async () => {
  const { api } = await import("./api");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({}), { status: 200, statusText: "OK" });
  }) as typeof fetch;

  const controller = new AbortController();
  await api.runSimulationPreset({ preset_id: "p1", nodes: [], edges: [], seed: 42, realism_level: 0 }, controller.signal);
  assert.equal(calls.length, 1);
  assert.match(calls[0]?.url ?? "", /\/api\/v1\/simulations\/run-preset$/);
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.signal, controller.signal, "AbortSignal é repassado ao fetch");
  const body = JSON.parse(String(calls[0]?.init?.body ?? "{}")) as Record<string, unknown>;
  assert.equal(body.preset_id, "p1");
  assert.equal(body.output_format, "json", "default quando o payload omite output_format");
});

test("failureInjection: body {node_id, mode, max_hops} + signal", async () => {
  const { api } = await import("./api");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true }), { status: 200, statusText: "OK" });
  }) as typeof fetch;

  const controller = new AbortController();
  const res = await api.failureInjection("g7", { node_id: "n1", mode: "down", max_hops: 2 }, controller.signal);
  assert.equal(res.ok, true);
  assert.match(calls[0]?.url ?? "", /\/api\/v1\/graphs\/g7\/failure-injection$/);
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.signal, controller.signal);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body ?? "{}")), { node_id: "n1", mode: "down", max_hops: 2 });
});

test("blastRadius: mesmo shape do body, /graphs/{id}/blast-radius + signal", async () => {
  const { api } = await import("./api");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ ok: true, node_labels: { n1: "N1" } }), { status: 200, statusText: "OK" });
  }) as typeof fetch;

  const controller = new AbortController();
  const res = await api.blastRadius("g7", { node_id: "n1", mode: "timeout", max_hops: 3 }, controller.signal);
  assert.equal(res.node_labels?.n1, "N1");
  assert.match(calls[0]?.url ?? "", /\/api\/v1\/graphs\/g7\/blast-radius$/);
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.signal, controller.signal);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body ?? "{}")), { node_id: "n1", mode: "timeout", max_hops: 3 });
});

test("runScenario: POST /graphs/{id}/simulation-scenarios/{sid}/run, signal, sem body", async () => {
  const { api } = await import("./api");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ seed: 9 }), { status: 200, statusText: "OK" });
  }) as typeof fetch;

  const controller = new AbortController();
  await api.runScenario("g7", "sc1", controller.signal);
  assert.match(calls[0]?.url ?? "", /\/api\/v1\/graphs\/g7\/simulation-scenarios\/sc1\/run$/);
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.signal, controller.signal);
  assert.equal(calls[0]?.init?.body, undefined, "o cenário roda contra o grafo atual — sem body");
});

test("exportSimulation: devolve Response bruto (Content-Disposition respeitado); format vence payload", async () => {
  const { api } = await import("./api");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response("rps,0\n500\n", {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="sim-42-load.csv"',
      },
    });
  }) as typeof fetch;

  const controller = new AbortController();
  const resp = await api.exportSimulation(
    { preset_id: "p1", nodes: [], edges: [], seed: 42, realism_level: 0, output_format: "json" },
    "csv",
    controller.signal,
  );
  assert.ok(resp instanceof Response, "corpo não-JSON: o chamador recebe o Response");
  assert.equal(resp.headers.get("Content-Disposition"), 'attachment; filename="sim-42-load.csv"');
  assert.equal(await resp.text(), "rps,0\n500\n");
  const body = JSON.parse(String(calls[0]?.init?.body ?? "{}")) as Record<string, unknown>;
  assert.equal(body.output_format, "csv", "format explícito vence payload.output_format");
  assert.equal(calls[0]?.init?.signal, controller.signal);
});

test("429 → ApiRateLimitError com retryAfter number (header Retry-After)", async () => {
  const { api, ApiRateLimitError } = await import("./api");
  globalThis.fetch = (async () =>
    new Response(null, {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "Retry-After": "60" },
    })) as typeof fetch;
  let caught: unknown;
  try {
    await api.failureInjection("g7", { node_id: "n1" });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ApiRateLimitError, `esperado ApiRateLimitError, veio: ${String(caught)}`);
  const error = caught as ApiRateLimitError;
  assert.equal(error.status, 429);
  assert.equal(error.retryAfter, 60);
  assert.equal(typeof error.retryAfter, "number", "S3a duck-type 'retryAfter' in err → sempre number");
});

test("429 sem Retry-After → fallback 60s (janela padrão do backend); também no export", async () => {
  const { api, ApiRateLimitError } = await import("./api");
  globalThis.fetch = (async () =>
    new Response(null, { status: 429, statusText: "Too Many Requests" })) as typeof fetch;
  let caught: unknown;
  try {
    await api.exportSimulation({ preset_id: "p", nodes: [], edges: [], seed: 1, realism_level: 0 }, "prometheus");
  } catch (err) {
    caught = err;
  }
  assert.ok(caught instanceof ApiRateLimitError, "export raw também converte 429");
  assert.equal((caught as ApiRateLimitError).retryAfter, 60);
});

test("runSimulation removido do client (endpoint segue no backend)", async () => {
  const { api } = await import("./api");
  assert.ok(!("runSimulation" in api), "método morto removido — sem chamador no client");
  assert.ok("runSimulationPreset" in api);
});
