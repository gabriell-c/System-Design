import type { EventTopic, ProjectNfr } from "./types";

/**
 * P4 — CRUD puro de `nfr.event_topics` (extrato da duplicação entre
 * EventCatalogPanel e ContextPanel). Imutável: sempre devolve um novo
 * ProjectNfr, pronto para `setNfr(nfr => ...)` ou `setNfr({...})`.
 */

export function withEventTopicAdded(nfr: ProjectNfr, topic: EventTopic): ProjectNfr {
  return { ...nfr, event_topics: [...(nfr.event_topics ?? []), topic] };
}

export function withEventTopicRemoved(nfr: ProjectNfr, index: number): ProjectNfr {
  const list = [...(nfr.event_topics ?? [])];
  list.splice(index, 1);
  return { ...nfr, event_topics: list };
}

export function withEventTopicFieldUpdated(
  nfr: ProjectNfr,
  index: number,
  field: keyof EventTopic,
  value: string | number | undefined,
): ProjectNfr {
  const list = [...(nfr.event_topics ?? [])];
  list[index] = { ...list[index], [field]: value as never } as EventTopic;
  return { ...nfr, event_topics: list };
}
