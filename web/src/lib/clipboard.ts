/**
 * Copia texto para a área de transferência de forma portável.
 *
 * `navigator.clipboard` só existe em contextos seguros (https:// ou
 * localhost). Em deploy via http:// ele é `undefined`, então usamos o
 * fallback legado `document.execCommand("copy")` para não quebrar a ação.
 * Retorna `true` só quando a cópia efetivamente ocorreu.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // falha (ex.: permissão negada) → tenta o fallback abaixo
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.left = "0";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, ta.value.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}
