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
