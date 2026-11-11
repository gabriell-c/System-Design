import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

// Reescreve importadores relativos sem extensão ("./catalog" → "./catalog.ts" e
// seu grafo) para os imports dinâmicos abaixo.
register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));

const VALID_PROVIDERS = new Set(["aws", "azure", "gcp", "generic"]);

test("ids do CATALOG são únicos (sem colisão entre base/multi-cloud/patterns/network)", async () => {
  const { CATALOG, CATALOG_INDEX } = await import("./catalog");
  const ids = CATALOG.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "há ids duplicados no CATALOG");
  // Índice cobre o conjunto exato
  assert.equal(CATALOG_INDEX.size, ids.length);
  for (const id of ids) assert.ok(CATALOG_INDEX.has(id), `índice ausente para ${id}`);
  // Near-dups removidos do catálogo de padrões
  assert.ok(!CATALOG_INDEX.has("pat-cqrs-pat"), "pat-cqrs-pat deveria ter sido removido");
  assert.ok(!CATALOG_INDEX.has("pat-cdc-pat"), "pat-cdc-pat deveria ter sido removido");
});

test("providerOf sempre devolve um CloudProvider válido", async () => {
  const { CATALOG, providerOf } = await import("./catalog");
  for (const item of CATALOG) {
    const p = providerOf(item);
    assert.ok(VALID_PROVIDERS.has(p), `provider inválido "${p}" em ${item.id}`);
  }
  // Itens base AWS resolvem para o enum (não para o nome de exibição)
  const { findCatalog } = await import("./catalog");
  assert.equal(providerOf(findCatalog("cloud-aws-rds")!), "aws");
  assert.equal(providerOf(findCatalog("cloud-gcp")!), "gcp");
  assert.equal(providerOf(findCatalog("cloud-azure")!), "azure");
});

test("stack-recommend: toda chave e todo techId resolvem em CATALOG", async () => {
  const { RECOMMENDATION_RULES } = await import("./stack-recommend");
  const { findCatalog } = await import("./catalog");
  for (const [addedId, rules] of Object.entries(RECOMMENDATION_RULES)) {
    assert.ok(findCatalog(addedId), `chave de regra não resolve: ${addedId}`);
    assert.ok(rules.length > 0, `regra vazia para ${addedId}`);
    for (const rule of rules) {
      assert.ok(findCatalog(rule.techId), `techId não resolve: ${rule.techId} (regra ${addedId})`);
      assert.ok(rule.reason.length > 0, `reason vazio para ${addedId}→${rule.techId}`);
    }
  }
});

test("stack-recommend dispara para um item real (feature não é morta)", async () => {
  const { checkRecommendations } = await import("./stack-recommend");
  const recs = checkRecommendations("be-django", []);
  assert.ok(recs.length > 0, "esperava recomendações para be-django");
  assert.ok(recs.some((r) => r.techId === "db-postgres"), "deve sugerir PostgreSQL");
});

test("todo id de ícone oficial e de atributos existe em CATALOG", async () => {
  const { OFFICIAL_ICON_IDS } = await import("./catalog-icons");
  const { listCatalogAttributes } = await import("./catalog-attrs");
  const { findCatalog } = await import("./catalog");
  for (const id of OFFICIAL_ICON_IDS) {
    assert.ok(findCatalog(id), `ícone oficial para id inexistente: ${id}`);
  }
  const attrs = listCatalogAttributes();
  assert.ok(attrs.length > 7, "catalog-attrs deveria ter sido expandido");
  for (const a of attrs) {
    assert.ok(findCatalog(a.catalogId), `attrs para id inexistente: ${a.catalogId}`);
  }
});

test("multi-cloud: provider + capability obrigatórios; rede: id único e pesquisável", async () => {
  const { MULTI_CLOUD_CATALOG } = await import("./catalog-multicloud");
  const { NETWORK_CATALOG } = await import("./catalog-network");
  // Multi-cloud: paridade exige provider enum + capability
  for (const item of MULTI_CLOUD_CATALOG) {
    assert.ok(item.provider, `${item.id} sem provider enum`);
    assert.ok(item.capability, `${item.id} sem capability`);
  }
  // Rede: itens provider-agnósticos (P2.3.1/2) também são aceitos; todo item é pesquisável
  for (const cat of [NETWORK_CATALOG]) {
    const ids = cat.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, "colisão de id em NETWORK_CATALOG");
    for (const item of cat) {
      const searchable = (item.tags?.length ?? 0) > 0 || item.capability || item.provider;
      assert.ok(searchable, `${item.id} sem campo pesquisável (tags/capability/provider)`);
    }
  }
});
