/**
 * schema.ts — Triage payload schema definition & validation.
 *
 * Defines the JSON shape Claude must return and provides a
 * validate-and-coerce function with safe defaults for every field.
 */

// ── Allowed enum values ────────────────────────────────────────────

export const CATEGORIES = [
  "bug",
  "enhancement",
  "docs",
  "token-change",
  "component-change",
  "migration",
  "question",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRODUCT_AREAS = [
  "Admin",
  "Integrations",
  "Reporting",
  "Design System",
  "Unknown",
] as const;
export type ProductArea = (typeof PRODUCT_AREAS)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const OWNERS = [
  "design",
  "engineering",
  "both",
  "analytics",
  "unknown",
] as const;
export type Owner = (typeof OWNERS)[number];

// ── Triage payload interface ───────────────────────────────────────

export interface TriagePayload {
  category: Category;
  product_area: ProductArea;
  risk: RiskLevel;
  owner: Owner;
  suggested_labels: string[];
  confidence: number;
  summary: string;
  next_steps: string[];
  success_signals: {
    metrics: string[];
    events: string[];
  };
  questions: string[];
}

// ── Helpers ────────────────────────────────────────────────────────

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return fallback;
}

function strArray(value: unknown, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, maxLen);
}

function clamp01(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

// ── Validate & coerce ──────────────────────────────────────────────

/**
 * Parse raw JSON (possibly from Claude) into a safe TriagePayload.
 * Missing / invalid fields fall back to safe defaults rather than throwing.
 */
export function validatePayload(raw: unknown): TriagePayload {
  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<
    string,
    unknown
  >;

  return {
    category: oneOf(obj.category, CATEGORIES, "question"),
    product_area: oneOf(obj.product_area, PRODUCT_AREAS, "Unknown"),
    risk: oneOf(obj.risk, RISK_LEVELS, "low"),
    owner: oneOf(obj.owner, OWNERS, "unknown"),
    suggested_labels: strArray(obj.suggested_labels, 10),
    confidence: clamp01(obj.confidence),
    summary:
      typeof obj.summary === "string" && obj.summary.trim().length > 0
        ? obj.summary.trim()
        : "No summary provided.",
    next_steps: strArray(obj.next_steps, 7).length
      ? strArray(obj.next_steps, 7)
      : ["Review the issue/PR description"],
    success_signals: {
      metrics: strArray(
        (obj.success_signals as Record<string, unknown>)?.metrics,
        5
      ),
      events: strArray(
        (obj.success_signals as Record<string, unknown>)?.events,
        8
      ),
    },
    questions: strArray(obj.questions, 3),
  };
}
