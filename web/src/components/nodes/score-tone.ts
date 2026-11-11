/** Classes de tom para o badge de resiliência/score (ArchiNode + SagaNode). */
export function scoreTone(score?: number | null): string {
  if (score == null) return "bg-slate-700 text-slate-300";
  if (score >= 8) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
  if (score >= 6) return "bg-amber-500/20 text-amber-200 border-amber-500/40";
  return "bg-rose-500/20 text-rose-200 border-rose-500/40";
}
