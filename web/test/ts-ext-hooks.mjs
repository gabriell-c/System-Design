/**
 * Hook de resolução para rodar testes de src/lib com `node --experimental-strip-types --test`.
 *
 * Os módulos de produção usam importadores relativos sem extensão ("./blocks"),
 * que o Node ESM não resolve (exige extensão explícita). Este hook reescreve
 * specifiers relativos sem extensão para `.ts` quando o arquivo existe,
 * sem alterar nenhum arquivo de produção.
 *
 * Uso (no topo do arquivo de teste, ANTES de qualquer import dinâmico):
 *   import { register } from "node:module";
 *   register(new URL("../../test/ts-ext-hooks.mjs", import.meta.url));
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

// S3a — raiz `@/` (alias do tsconfig) → `web/src/` para testes de hooks que
// importam `@/lib/*` sob Node (o tsconfig aponta `@/*` → `./src/*`).
const SRC_ROOT = new URL("../src/", import.meta.url);

function resolveAlias(specifier) {
  if (!specifier.startsWith("@/")) return null;
  const target = new URL(specifier.slice(2), SRC_ROOT);
  const filePath = fileURLToPath(target);
  if (existsSync(filePath + ".ts")) return pathToFileURL(filePath + ".ts").href;
  if (existsSync(filePath + "/index.ts")) return pathToFileURL(filePath + "/index.ts").href;
  if (existsSync(filePath)) return pathToFileURL(filePath).href;
  return null;
}

export function resolve(specifier, context, next) {
  const aliased = resolveAlias(specifier);
  if (aliased) return next(aliased, context);
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[cm]?[jt]sx?$/.test(specifier);
  if (isRelative && !hasExtension && context.parentURL) {
    const candidate = new URL(specifier + ".ts", context.parentURL);
    if (existsSync(fileURLToPath(candidate))) {
      return next(specifier + ".ts", context);
    }
  }
  return next(specifier, context);
}
