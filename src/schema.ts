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

export const EFFORT_SIZES = ["xs", "s", "m", "l", "xl"] as const;
export type EffortSize = (typeof EFFORT_SIZES)[number];

export const JIRA_ISSUE_TYPES = ["Bug", "Story", "Task", "Epic"] as const;
export type JiraIssueType = (typeof JIRA_ISSUE_TYPES)[number];

export const PRIORITIES = ["P1", "P2", "P3", "P4"] as const;
export type Priority = (typeof PRIORITIES)[number];

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

  // ── New fields ─────────────────────────────────────────────────
  estimated_effort: EffortSize;
  related_components: string[];
  breaking_change: boolean;
  migration_notes: string;
  suggested_assignee_role: string;
}

// ── Ticket template (derived, not from Claude directly) ────────────

export interface TicketTemplate {
  type: JiraIssueType;
  title: string;
  description: string;
  acceptance_criteria: string[];
  labels: string[];
  priority: Priority;
  team: string;
  effort: EffortSize;
  epic_suggestion: string;
  components: string[];
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

function safeString(value: unknown, fallback: string = ""): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function safeBool(value: unknown, fallback: boolean = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
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

    // New fields
    estimated_effort: oneOf(obj.estimated_effort, EFFORT_SIZES, "m"),
    related_components: strArray(obj.related_components, 15),
    breaking_change: safeBool(obj.breaking_change, false),
    migration_notes: safeString(obj.migration_notes),
    suggested_assignee_role: safeString(obj.suggested_assignee_role, "unspecified"),
  };
}

// ── Build ticket template from triage payload ──────────────────────

const CATEGORY_TO_JIRA_TYPE: Record<Category, JiraIssueType> = {
  bug: "Bug",
  enhancement: "Story",
  docs: "Task",
  "token-change": "Story",
  "component-change": "Story",
  migration: "Epic",
  question: "Task",
};

const RISK_TO_PRIORITY: Record<RiskLevel, Priority> = {
  high: "P1",
  medium: "P2",
  low: "P3",
};

const OWNER_TO_TEAM: Record<Owner, string> = {
  design: "Design Systems — Design",
  engineering: "Design Systems — Engineering",
  both: "Design Systems — Cross-functional",
  analytics: "Design Systems — Analytics",
  unknown: "Design Systems",
};

/**
 * Derive a ready-to-use ticket template from a triage payload.
 * The `issueTitle` parameter is the original GitHub issue/PR title.
 */
export function buildTicketTemplate(
  payload: TriagePayload,
  issueTitle: string
): TicketTemplate {
  const type = CATEGORY_TO_JIRA_TYPE[payload.category];

  // Build acceptance criteria from next_steps + success_signals
  const acceptance: string[] = [...payload.next_steps];
  for (const m of payload.success_signals.metrics) {
    acceptance.push(`Verify metric: ${m}`);
  }

  // Construct description
  const descParts = [payload.summary];
  if (payload.migration_notes) {
    descParts.push(`\n*Migration notes:* ${payload.migration_notes}`);
  }
  if (payload.breaking_change) {
    descParts.push("\n*This is a breaking change* — coordinate release comms.");
  }
  if (payload.questions.length) {
    descParts.push(
      `\n*Open questions:*\n${payload.questions.map((q) => `- ${q}`).join("\n")}`
    );
  }

  // Epic suggestion heuristic
  let epicSuggestion = "";
  if (payload.category === "migration") {
    epicSuggestion = `[Migration] ${payload.product_area}`;
  } else if (payload.breaking_change) {
    epicSuggestion = `[Breaking Changes] ${payload.product_area}`;
  } else if (payload.related_components.length >= 3) {
    epicSuggestion = `[Multi-component] ${payload.product_area} updates`;
  }

  return {
    type,
    title: `[DS] ${issueTitle}`,
    description: descParts.join("\n"),
    acceptance_criteria: acceptance,
    labels: payload.suggested_labels,
    priority: RISK_TO_PRIORITY[payload.risk],
    team: OWNER_TO_TEAM[payload.owner],
    effort: payload.estimated_effort,
    epic_suggestion: epicSuggestion,
    components: payload.related_components,
  };
}
