"use client";

import { useEffect } from "react";
import type { DependencyList } from "react";

/**
 * P4 — encapsula o padrão `useEffect + let cancelled = false` repetido em
 * 8 painéis (Cost, Slo, Wiki, AuditTrail, Consistency, Governance, History,
 * LineageView). O `runner` recebe `isCancelled()` e mantém seu próprio
 * try/catch/finally — o comportamento de erro/cleanup é idêntico ao
 * useEffect original; o hook só cuida do flag de cancelamento.
 */
export function useApiEffect(
  runner: (isCancelled: () => boolean) => void | Promise<void>,
  deps: DependencyList,
) {
  /* eslint-disable react-hooks/exhaustive-deps -- `deps` vem do chamador
   * (mesmo array do useEffect original); `runner` muda a cada render e, se
   * fosse dependência, o efeito re-executaria a cada render. */
  useEffect(() => {
    let cancelled = false;
    const isCancelled = () => cancelled;
    void (async () => {
      await runner(isCancelled);
    })();
    return () => {
      cancelled = true;
    };
  }, deps);
  /* eslint-enable react-hooks/exhaustive-deps */
}
