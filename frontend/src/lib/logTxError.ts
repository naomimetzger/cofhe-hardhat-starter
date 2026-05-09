/**
 * Logs transaction / RPC errors in depth so revert data and nested causes are visible in the console.
 * For CoFHE custom errors, decode with: npx cofhe-errors <0x-selector>
 */

function isRevertHex(s: unknown): s is `0x${string}` {
  return typeof s === "string" && s.startsWith("0x") && s.length >= 10;
}

export function extractRevertSelector(data: unknown): string | undefined {
  if (!isRevertHex(data)) return undefined;
  return data.slice(0, 10);
}

function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  let cur: unknown = error;
  const seen = new Set<unknown>();
  let depth = 0;
  while (cur && depth < 12 && !seen.has(cur)) {
    seen.add(cur);
    if (typeof cur === "object" && cur !== null) {
      const o = cur as Record<string, unknown>;
      for (const key of ["shortMessage", "message", "details"]) {
        const v = o[key];
        if (typeof v === "string") parts.push(v);
      }
    }
    cur = (cur as { cause?: unknown })?.cause;
    depth++;
  }
  return parts.join(" ");
}

/** Lowercase blob of all nested messages — useful for matching "rate limit" etc. */
export function errorTextBlob(error: unknown): string {
  return collectErrorText(error).toLowerCase();
}

function findRevertDataHex(error: unknown): `0x${string}` | undefined {
  let cur: unknown = error;
  const seen = new Set<unknown>();
  let depth = 0;
  while (cur && typeof cur === "object" && depth < 12 && !seen.has(cur)) {
    seen.add(cur);
    const d = (cur as { data?: unknown }).data;
    if (isRevertHex(d)) return d;
    cur = (cur as { cause?: unknown }).cause;
    depth++;
  }
  return undefined;
}

const LAYER_KEYS = ["data", "cause", "details", "shortMessage", "message", "metaMessages", "code", "status"] as const;

function logOneLayer(label: string, layer: unknown, index: number) {
  console.error(`${label} [layer ${index}]`, layer);
  if (layer !== null && typeof layer === "object") {
    const o = layer as Record<string, unknown>;
    for (const key of LAYER_KEYS) {
      if (key in o && o[key] !== undefined) {
        console.error(`${label} [layer ${index}].${key}`, o[key]);
      }
    }
  }
}

/**
 * Logs the full error chain and any revert `data` on each layer. Prints a `npx cofhe-errors` hint when hex data is found.
 */
export function logTransactionError(label: string, error: unknown): void {
  console.group(`[capsule] Transaction error — ${label}`);

  let cur: unknown = error;
  const seen = new Set<unknown>();
  let i = 0;
  while (cur !== undefined && cur !== null && !seen.has(cur) && i < 12) {
    seen.add(cur);
    logOneLayer(label, cur, i);
    cur = (cur as { cause?: unknown })?.cause;
    i++;
  }

  const revertData = findRevertDataHex(error);
  const selector = revertData ? extractRevertSelector(revertData) : undefined;
  if (selector) {
    console.info(`Decode this revert: npx cofhe-errors ${selector}`);
    if (revertData && revertData.length > 10) {
      console.info("Full revert data:", revertData);
    }
  } else {
    console.info("No 0x revert data found on error.cause chain — check RPC / wallet messages above.");
  }

  const replacer = (_key: string, value: unknown) => {
    if (typeof value === "bigint") return value.toString();
    return value;
  };

  function shallowLayer(e: unknown): Record<string, unknown> {
    if (e === null || typeof e !== "object") return { value: e as unknown };
    const o = e as Record<string, unknown>;
    const pick: Record<string, unknown> = {};
    for (const key of [...Object.keys(o), ...Object.getOwnPropertyNames(o)]) {
      if (key === "stack") continue;
      if (key === "cause") continue;
      try {
        const v = o[key];
        if (typeof v === "function") continue;
        pick[key] = v;
      } catch {
        /* ignore */
      }
    }
    return pick;
  }

  const chainSnap: Record<string, unknown>[] = [];
  let snapCur: unknown = error;
  const snapSeen = new Set<unknown>();
  let si = 0;
  while (snapCur != null && !snapSeen.has(snapCur) && si < 12) {
    snapSeen.add(snapCur);
    chainSnap.push(shallowLayer(snapCur));
    snapCur = (snapCur as { cause?: unknown }).cause;
    si++;
  }
  try {
    console.error(`${label} cause chain (JSON):`, JSON.stringify(chainSnap, replacer, 2));
  } catch {
    console.error(`${label} (could not stringify cause chain)`);
  }

  console.groupEnd();
}
