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
import { fileURLToPath } from "node:url";

export function resolve(specifier, context, next) {
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
