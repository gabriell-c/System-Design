/**
 * S3b (item 69) — cálculo PURO da navegação por teclado do
 * `ui/Select` (listbox). Vive em módulo próprio, sem JSX, para ser
 * testável sob `node --experimental-strip-types` (`select.test.ts`);
 * importar `Select.tsx` direto num teste Node exigiria
 * `--experimental-transform-types` (o script atual usa strip-types).
 *
 * Semântica: clampa em [0, count-1]; lista vazia → 0 (sem crash).
 */
export function moveHighlight(highlight: number, dir: 1 | -1, count: number): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.max(0, highlight + dir));
}
