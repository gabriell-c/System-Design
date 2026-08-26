# Plano de Melhorias — Archia (Local-First)

> **Data:** 2026-08-25  
> **Objetivo:** Identificar e documentar todos os pontos críticos de segurança, confiabilidade e usabilidade para um app que será usado localmente no PC do usuário.
> **Contexto:** O Archia é um editor visual de arquitetura de software que armazena dados em backend FastAPI + PostgreSQL/SQLite. O usuário espera que seus diagramas não se percam.
> **Status implementação:** P0–P2 aplicados em 25/08/2026 (auth projetos, JWT cookie-only, draft local, feedback sync, checksum, rate limit, DnD, online indicator, payload caps, audit email, embed público, PWA SW, Docker HEALTHCHECK, DEPLOY/OPS).

---

## Visão Geral do Problema

O projeto Archia tem **327 testes passando** e uma base sólida de funcionalidades. No entanto, para um cenário **local-first** (usuário baixa e roda no PC), existem lacunas críticas que podem resultar em:

1. **Perda de dados** — se o backend cair ou o usuário fechar a aba sem salvar
2. **Vazamento de dados** — rotas sem autenticação permitem acesso público
3. **Falhas silenciosas** — auto-save falha sem feedback ao usuário
4. **Risco de XSS** — JWT armazenado em localStorage
5. **Indisponibilidade total** — app para completamente se o backend cair

---

## 1. SEGURANÇA — Crítico

### 1.1. Rotas de projeto sem autenticação

**Onde:** `backend/app/routes/projects.py`

**Problema:** Duas rotas críticas não exigem autenticação:

```python
# Linha 158 — SEM current_user
def create_project(body: ProjectCreate, db: Session = Depends(get_db)) -> ProjectOut:

# Linha 194 — SEM current_user
def get_project(project_id: str, db: Session = Depends(get_db)) -> ProjectOut:
```

**Impacto:** Qualquer pessoa pode criar projetos e visualizar projetos existentes sem login.

**Por que é crítico:** Em um app local-first, o usuário pode confiar que seus projetos estão "seus". Se alguém descobrir o UUID de um projeto, pode acessá-lo sem credenciais.

**Correção:**

```python
# projects.py — criar projeto
@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    body: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ADICIONAR
) -> ProjectOut:

# projects.py — get projeto
@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # ADICIONAR
) -> ProjectOut:
```

**Testes necessários:**
- `test_project_create_requires_auth` — 401 sem token
- `test_project_get_requires_auth` — 401 sem token
- Verificar que existing tests still pass

---

### 1.2. JWT armazenado em localStorage (risco de XSS)

**Onde:** `web/src/lib/auth-store.ts` (linhas 154-161)

**Problema:** O zustand `persist` salva o token JWT em `localStorage`:

```typescript
persist(
  (set) => ({ ... }),
  {
    name: 'archia-auth-storage',
    partialize: (state) => ({
      token: state.token,  // SALVO NO localStorage!
      user: state.user,
      isAuthenticated: state.isAuthenticated,
    }),
  }
)
```

**Impacto:** Se houver qualquer vulnerabilidade XSS no app (mesmo que mínima), o token é roubado e pode ser usado para acessar a API.

**Por que é crítico:** O backend já define o cookie como `httponly=True` (linha 142 de `auth.py`), mas o frontend sobrescreve isso salvando o token em localStorage. Um script malicioso pode ler `localStorage` e enviar o token para um servidor atacante.

**Correção:** Remover o token do persist. Usar apenas o cookie HttpOnly para sessões:

```typescript
// auth-store.ts — modificar partialize
partialize: (state) => ({
  // REMOVER: token: state.token,
  user: state.user,
  isAuthenticated: state.isAuthenticated,
}),
```

**Observação:** O backend já envia o cookie `archia_session` com `httponly=True`. O frontend só precisa verificar se o cookie existe (via `fetch` com `credentials: 'include'`).

**Testes necessários:**
- Verificar que token não aparece em `localStorage` após login
- Verificar que requests usam cookie automaticamente

---

### 1.3. Rate limiting apenas em rotas de auth

**Onde:** `backend/app/rate_limit.py`

**Problema:** Rate limiting existe apenas para login (5/60s) e recuperação de senha (3/300s). Rotas custosas como análise e simulação não têm proteção.

**Impacto:** Um usuário mal-intencionado pode fazer spam de requisições de IA, estourando o budget de API.

**Correção:** Adicionar rate limiting em rotas de análise e simulação:

```python
# backend/app/rate_limit.py — adicionar novas funções
def rate_limit_analyze(request: Request, user_email: str) -> None:
    """Rate limit: 10 requests per 60 seconds per user."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"analyze:{ip}:{user_email}", max_attempts=10, window_seconds=60)

def rate_limit_simulation(request: Request, user_email: str) -> None:
    """Rate limit: 5 requests per 60 seconds per user."""
    ip = request.client.host if request.client else "unknown"
    _rate_limit(f"simulation:{ip}:{user_email}", max_attempts=5, window_seconds=60)
```

Aplicar em:
- `backend/app/routes/graphs.py` — `/analyze` e `/graphs/{id}/analyze`
- `backend/app/routes/simulations.py` — `/run` e `/run-preset`

**Testes necessários:**
- `test_analyze_rate_limit` — 429 após 10 requisições
- `test_simulation_rate_limit` — 429 após 5 requisições

---

### 1.4. Embed público sem validação de ownership

**Onde:** `backend/app/routes/embed.py` (linhas 26-40)

**Problema:** O endpoint de embed não verifica se o usuário tem permissão para acessar o grafo:

```python
@router.get("/{graph_id}", response_model=EmbedPayload)
def get_embed(graph_id: str, db: Session = Depends(get_db)) -> EmbedPayload:
    graph = db.get(Graph, graph_id)
    # NÃO verifica project.is_public ou permissões
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    # Retorna dados do grafo para QUALQUER pessoa com o ID
```

**Impacto:** Se o usuário marcar um projeto como privado e compartilhar o link do embed, qualquer um com o ID do grafo pode embedar e ver o conteúdo.

**Correção:**

```python
@router.get("/{graph_id}", response_model=EmbedPayload)
def get_embed(
    graph_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> EmbedPayload:
    graph = db.get(Graph, graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    
    # Verificar se o grafo pertence a um projeto público
    if graph.project_id:
        project = db.query(Project).filter(Project.id == graph.project_id).first()
        if project and not project.is_public:
            # Verificar se o usuário tem acesso
            if current_user.email != project.owner_email:  # ou lógica de ACL
                raise HTTPException(status_code=403, detail="Access denied")
    
    # ... rest do código
```

**Observação:** Se o app for verdadeiramente local-first (usuário único no PC), essa validação pode ser simplificada: apenas verificar se o grafo existe.

---

### 1.5. Middleware de audit loga usuários como "anonymous"

**Onde:** `backend/app/middleware/audit.py` (linhas 41-47)

**Problema:** O middleware tenta extrair o email do usuário mas não decodifica o token:

```python
auth_header = request.headers.get("authorization", "")
user_email = "anonymous"
if auth_header.startswith("Bearer "):
    auth_header[7:]  # RESULTADO NÃO É USADO!
    # Comentário diz: "skip token decode"
```

**Impacto:** Todas as entradas de audit ficam como "anonymous", tornando o log inutilizável para compliance.

**Correção:** Decodificar o token no middleware:

```python
import jwt
from app.config import settings

# Dentro do dispatch:
auth_header = request.headers.get("authorization", "")
user_email = "anonymous"
if auth_header.startswith("Bearer "):
    token = auth_header[7:]
    try:
        payload = jwt.decode(token, settings.archia_jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id:
            # Buscar email do usuário no DB
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user:
                user_email = user.email
    except Exception:
        pass  # Manter "anonymous" se falhar
```

**Testes necessários:**
- `test_audit_logs_user_email` — verificar que audit entry tem email correto
- `test_audit_logs_anonymous_when_unauthenticated` — 401 não gera entry

---

## 2. CONFIABILIDADE DE DADOS — Crítico

### 2.1. Auto-save sem fallback local

**Onde:** `web/src/hooks/useAutoSave.ts`

**Problema:** O auto-save depende 100% do backend estar online:

```typescript
// Linha 12-27
if (!user || !user.auto_save_enabled || !graphId) return;
const ms = user.auto_save_interval_minutes * 60 * 1000;
timerRef.current = setInterval(() => {
  const state = useGraphStore.getState();
  if (state.graphId) {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4410";
    fetch(`${base}/api/v1/graphs/${state.graphId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodes: state.nodes, edges: state.edges }),
    }).catch(console.error);  // SILENCIOSO!
  }
}, ms);
```

**Impacto:** Se o backend cair, o usuário perde todo trabalho não salvo manualmente.

**Por que é crítico para local-first:** O usuário pode estar usando o app offline ou com conexão instável. Perder dados é o pior cenário possível.

**Correção — Opção A (IndexedDB):**

```typescript
// web/src/lib/local-storage.ts — NOVO ARQUIVO
const DB_NAME = 'archia-local';
const STORE_NAME = 'drafts';

export async function saveDraftToLocal(graphId: string, data: GraphExport): Promise<void> {
  const db = await openDB();
  await db.put(STORE_NAME, { ...data, savedAt: new Date().toISOString() }, graphId);
}

export async function loadDraftFromLocal(graphId: string): Promise<GraphExport | null> {
  const db = await openDB();
  return await db.get(STORE_NAME, graphId) ?? null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
```

**Correção — Opção B (localStorage com limitação):**

Para graphs pequenos (< 1MB), usar localStorage como fallback imediato:

```typescript
// useAutoSave.ts — adicionar fallback
const LOCAL_STORAGE_KEY = 'archia-draft';

useEffect(() => {
  // Salvar rascunho local a cada 5 segundos
  const localTimer = setInterval(() => {
    const state = useGraphStore.getState();
    if (state.graphId && state.nodes.length > 0) {
      const draft = {
        graphId: state.graphId,
        name: state.name,
        nodes: state.nodes,
        edges: state.edges,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(draft));
      } catch (e) {
        console.error('Failed to save draft locally', e);
      }
    }
  }, 5000);

  return () => clearInterval(localTimer);
}, []);
```

**Recomendação:** Usar Opção B (localStorage) para rascunho imediato + Opção A (IndexedDB) para versão persistente.

**Testes necessários:**
- `test_autosave_fallback_to_local` — verificar que draft é salvo localmente quando backend falha
- `test_autosave_restores_from_local` — verificar que app restaura draft ao recarregar

---

### 2.2. Falha silenciosa do auto-save

**Onde:** `web/src/hooks/useAutoSave.ts` (linha 25)

**Problema:** Erros de rede são capturados e silenciosamente ignorados:

```typescript
}).catch(console.error);  // APENAS console.error, sem feedback ao usuário
```

**Impacto:** O usuário não sabe que o auto-save falhou e pode fechar a aba achando que está salvo.

**Correção:** Adicionar feedback visual no TopBar:

```typescript
// web/src/components/layout/TopBar.tsx — adicionar estado de conexão
const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'error' | 'offline'>('synced');

// Em useAutoSave.ts, atualizar status:
fetch(...)
  .then(res => {
    if (res.ok) setSyncStatus('synced');
    else setSyncStatus('error');
  })
  .catch(() => setSyncStatus('offline'));
```

**Ícone no TopBar:**
- Verde (synced): ✓
- Amarelo (saving): ↻ (spinner)
- Vermelho (error): ! com tooltip "Falha ao salvar. Verifique a conexão."
- Cinza (offline): ● com tooltip "Offline — rascunho salvo localmente"

**Testes necessários:**
- `test_sync_status_indicator` — verificar que ícone muda corretamente
- `test_offline_draft_saved` — verificar que rascunho é salvo no localStorage

---

### 2.3. Export sem checksum de integridade

**Onde:** `web/src/lib/export.ts`

**Problema:** O export JSON não tem checksum para detectar corrupção:

```typescript
export type GraphExport = {
  format: "system-design-saas.graph";
  version: 1;
  name: string;
  // ... dados do grafo
};
// SEM checksum!
```

**Impacto:** Se o arquivo for corrompido (download incompleto, erro de disco), o usuário não sabe até tentar importar e falhar.

**Correção:** Adicionar checksum SHA-256 no export:

```typescript
import { createHash } from 'crypto';

export type GraphExport = {
  format: "system-design-saas.graph";
  version: 1;
  name: string;
  checksum?: string;  // NOVO
  exportedAt: string;
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  analysis?: AnalysisResult | null;
};

export function toExportPayload(...): GraphExport {
  const payload = {
    format: "system-design-saas.graph",
    version: 1,
    name: name.trim() || "Arquitetura sem nome",
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
    analysis: analysis ?? null,
  };
  
  // Calcular checksum (excluir campo checksum se existir)
  const { checksum: _, ...payloadForHash } = payload;
  const json = JSON.stringify(payloadForHash, Object.keys(payloadForHash).sort());
  const checksum = createHash('sha256').update(json).digest('hex');
  
  return { ...payload, checksum };
}
```

**Validação na importação:**

```typescript
export function parseImportPayload(raw: unknown): GraphExport {
  // ... validações existentes ...
  
  if (data.checksum) {
    const { checksum: _, ...payloadForHash } = data;
    const json = JSON.stringify(payloadForHash, Object.keys(payloadForHash).sort());
    const expected = createHash('sha256').update(json).digest('hex');
    if (checksum !== expected) {
      throw new Error('Arquivo corrompido: checksum não corresponde.');
    }
  }
  
  return data as GraphExport;
}
```

**Testes necessários:**
- `test_export_includes_checksum` — verificar que export tem campo checksum
- `test_import_validates_checksum` — verificar que import falha com arquivo corrompido
- `test_import_backwards_compatible` — verificar que import funciona sem checksum (versões antigas)

---

## 3. USABILIDADE — Importante

### 3.1. Drag-and-drop de arquivo no canvas

**Onde:** `web/src/components/canvas/DesignCanvas.tsx`

**Problema:** O canvas aceita drag-and-drop apenas para componentes da paleta, não para arquivos JSON.

**Impacto:** O usuário precisa usar o menu "Mais" > "Importar JSON" para importar um arquivo. Isso não é intuitivo.

**Correção:** Adicionar suporte a drop de arquivo JSON no canvas:

```typescript
// DesignCanvas.tsx — adicionar handler de drop
const onFileDrop = useCallback((event: React.DragEvent) => {
  event.preventDefault();
  const file = event.dataTransfer.files?.[0];
  if (!file || !file.name.endsWith('.json')) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = parseImportPayload(JSON.parse(e.target?.result as string));
      loadSnapshot(parsed.name, parsed.nodes, parsed.edges, parsed.analysis, parsed.context, parsed.nfr);
      pushUiNotice({ type: "success", text: "Arquitetura importada." });
    } catch (err) {
      pushUiNotice({ type: "error", text: err instanceof Error ? err.message : "Falha ao importar." });
    }
  };
  reader.readAsText(file);
}, [loadSnapshot, pushUiNotice]);

// No return:
<div onDrop={onFileDrop} onDragOver={(e) => e.preventDefault()}>
  {/* canvas content */}
</div>
```

**Testes necessários:**
- `test_drop_json_file_imports_graph` — verificar que arquivo JSON é importado
- `test_drop_invalid_file_shows_error` — verificar que arquivo inválido mostra erro

---

### 3.2. Indicador de status de conexão

**Onde:** `web/src/components/layout/TopBar.tsx`

**Problema:** Não há indicador visual de se o app está online/offline.

**Correção:** Adicionar indicador de conexão usando `navigator.onLine`:

```typescript
// TopBar.tsx
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// No JSX:
{!isOnline && (
  <span className="flex items-center gap-1 text-xs text-amber-400" title="Offline">
    <CloudOff size={14} />
    Offline
  </span>
)}
```

**Testes necessários:**
- `test_offline_indicator_shows` — verificar que indicador aparece quando offline
- `test_online_indicator_hides` — verificar que indicador some quando online

---

### 3.3. Mensagens de erro mais úteis

**Onde:** Vários arquivos de componente

**Problema:** Mensagens de erro genéricas como "Falha ao salvar" não dão contexto ao usuário.

**Correção:** Adicionar mensagens específicas:

```typescript
// TopBar.tsx — save()
catch (err) {
  const message = err instanceof Error ? err.message : "Erro desconhecido";
  if (message.includes('Network') || message.includes('fetch')) {
    pushUiNotice({ 
      type: "error", 
      text: "Não foi possível salvar. Verifique sua conexão com a internet." 
    });
  } else {
    pushUiNotice({ 
      type: "error", 
      text: `Falha ao salvar: ${message}` 
    });
  }
}
```

---

## 4. PERFORMANCE — Recomendado

### 4.1. Validação de tamanho de payload

**Onde:** `backend/app/schemas/graph.py`

**Problema:** Não há limite máximo para número de nodes/edges. Um usuário pode enviar um grafo com 100k nós e travar o servidor.

**Correção:** Adicionar validação no schema:

```python
# backend/app/schemas/graph.py
class GraphPayload(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    context: str = Field(default="", max_length=20000)
    nfr: ProjectNfr | None = None
    nodes: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    edges: list[dict[str, Any]] = Field(default_factory=list, max_length=2000)
    # ... outros campos
```

**Testes necessários:**
- `test_graph_payload_max_nodes` — 422 se nodes > 500
- `test_graph_payload_max_edges` — 422 se edges > 2000

---

## 5. OPERAÇÃO — Recomendado

### 5.1. Service Worker para PWA

**Onde:** `web/` (necessário criar arquivo)

**Problema:** O app não funciona offline. Se o usuário perder conexão, não pode visualizar nem editar gráficos.

**Correção:** Adicionar Service Worker com cache de assets estáticos e dados do gráfico:

```typescript
// web/src/service-worker.ts — NOVO ARQUIVO
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('archia-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/favicon.ico',
        '/_next/static/chunks/main.js',
        // ... outros assets
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

**Configuração no Next.js:**

```typescript
// web/next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    workerModules: true,
  },
};

export default nextConfig;
```

**Testes necessários:**
- `test_service_worker_installed` — verificar que SW é registrado
- `test_offline_assets_cached` — verificar que assets estão em cache

---

### 5.2. Health checks para Docker

**Onde:** `backend/Dockerfile`

**Problema:** O Dockerfile não tem health check, dificultando monitoramento em production.

**Correção:**

```dockerfile
# backend/Dockerfile
EXPOSE 4410

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4410/api/health || exit 1

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 4410"]
```

---

## 6. DOCUMENTAÇÃO — Recomendado

### 6.1. Runbook de deploy

**Onde:** `docs/` (necessário criar)

**Problema:** Não existe documentação de deploy/ops para o app.

**Arquivos necessários:**
- `docs/DEPLOY.md` — passo a passo para deploy em produção
- `docs/OPS.md` — monitoramento, logs, troubleshooting
- `docs/DATA-BACKUP.md` — como fazer backup do banco de dados

---

## Resumo das Prioridades

| Prioridade | Item | Impacto | Esforço | Arquivo(s) | Status |
|------------|------|---------|---------|------------|--------|
| **P0** | Auth em create_project/get_project | Segurança | Baixo | `projects.py` | Feito 25/08/2026 |
| **P0** | JWT fora do localStorage | Segurança | Médio | `auth-store.ts`, `api.ts` | Feito 25/08/2026 |
| **P0** | Fallback local para auto-save | Confiabilidade | Médio | `useAutoSave.ts`, `local-draft.ts` | Feito 25/08/2026 |
| **P0** | Feedback de falha no auto-save | Usabilidade | Baixo | `useAutoSave.ts`, `TopBar.tsx` | Feito 25/08/2026 |
| **P1** | Checksum no export | Confiabilidade | Baixo | `export.ts` | Feito 25/08/2026 |
| **P1** | Rate limiting em análise/simulação | Segurança/Custo | Médio | `rate_limit.py`, `graphs.py`, `simulations.py` | Feito 25/08/2026 |
| **P1** | Drag-and-drop de arquivo | Usabilidade | Baixo | `DesignCanvas.tsx` | Feito 25/08/2026 |
| **P1** | Indicador de conexão | Usabilidade | Baixo | `TopBar.tsx` | Feito 25/08/2026 |
| **P2** | Validação de tamanho de payload | Estabilidade | Baixo | `graph.py` | Feito 25/08/2026 |
| **P2** | Audit com user_email correto | Compliance | Médio | `audit.py` | Feito 25/08/2026 |
| **P2** | Embed com validação de ownership | Segurança | Médio | `embed.py` | Feito 25/08/2026 |
| **P2** | Service Worker (PWA) | Usabilidade offline | Alto | `public/sw.js`, `layout.tsx` | Feito 25/08/2026 |
| **P2** | Health checks no Docker | Operacional | Baixo | `Dockerfile` (API + web) | Feito 25/08/2026 |
| **P2** | Runbook de deploy | Documentação | Alto | `docs/DEPLOY.md`, `docs/OPS.md` | Feito 25/08/2026 |

---

## Como Usar Este Documento

1. **Começar pelos P0** — são os que mais arriscam perda de dados ou vazamento
2. **Testar cada correção** — usar o checklist em `.cursor/rules/checklist-codigo.mdc`
3. **Atualizar este documento** — marcar itens como "Feito" com data e link do PR

---

## Notas Técnicas

- Todas as correções devem seguir o padrão do repo (FastAPI + SQLAlchemy, Next.js + TypeScript)
- Testes devem ser adicionados antes das correções (red-green-refactor)
- Commits devem seguir Conventional Commits (ex: `fix(security): add auth to project routes`)
- Nenhuma credencial deve ser commitada

---

*Documento criado em 2026-08-25. Revisar a cada sprint.*
