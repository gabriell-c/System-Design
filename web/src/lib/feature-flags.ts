/**
 * Feature flag for canvas UX improvements (T1–T15).
 * Defaults to on (no flag needed) — set NEXT_PUBLIC_NEW_UI=0 to disable.
 * Kept lightweight: no library overhead.
 */
export const USE_NEW_CANVAS_UX =
  typeof process.env.NEXT_PUBLIC_NEW_UI === "undefined"
    ? true
    : process.env.NEXT_PUBLIC_NEW_UI !== "0";
