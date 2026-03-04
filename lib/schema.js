"use strict";
/**
 * schema.ts — Triage payload schema definition & validation.
 *
 * Defines the JSON shape Claude must return and provides a
 * validate-and-coerce function with safe defaults for every field.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIORITIES = exports.JIRA_ISSUE_TYPES = exports.EFFORT_SIZES = exports.OWNERS = exports.RISK_LEVELS = exports.PRODUCT_AREAS = exports.CATEGORIES = void 0;
exports.validatePayload = validatePayload;
exports.buildTicketTemplate = buildTicketTemplate;
// ── Allowed enum values ────────────────────────────────────────────
exports.CATEGORIES = [
    "bug",
    "enhancement",
    "docs",
    "token-change",
    "component-change",
    "migration",
    "question",
];
exports.PRODUCT_AREAS = [
    "Admin",
    "Integrations",
    "Reporting",
    "Design System",
    "Unknown",
];
exports.RISK_LEVELS = ["low", "medium", "high"];
exports.OWNERS = [
    "design",
    "engineering",
    "both",
    "analytics",
    "unknown",
];
exports.EFFORT_SIZES = ["xs", "s", "m", "l", "xl"];
exports.JIRA_ISSUE_TYPES = ["Bug", "Story", "Task", "Epic"];
exports.PRIORITIES = ["P1", "P2", "P3", "P4"];
// ── Helpers ────────────────────────────────────────────────────────
function oneOf(value, allowed, fallback) {
    if (typeof value === "string" && allowed.includes(value)) {
        return value;
    }
    return fallback;
}
function strArray(value, maxLen) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((v) => typeof v === "string" && v.trim().length > 0)
        .slice(0, maxLen);
}
function clamp01(value) {
    const n = typeof value === "number" ? value : parseFloat(String(value));
    if (Number.isNaN(n))
        return 0;
    return Math.min(1, Math.max(0, n));
}
function safeString(value, fallback = "") {
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : fallback;
}
function safeBool(value, fallback = false) {
    if (typeof value === "boolean")
        return value;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    return fallback;
}
// ── Validate & coerce ──────────────────────────────────────────────
/**
 * Parse raw JSON (possibly from Claude) into a safe TriagePayload.
 * Missing / invalid fields fall back to safe defaults rather than throwing.
 */
function validatePayload(raw) {
    const obj = (typeof raw === "object" && raw !== null ? raw : {});
    return {
        category: oneOf(obj.category, exports.CATEGORIES, "question"),
        product_area: oneOf(obj.product_area, exports.PRODUCT_AREAS, "Unknown"),
        risk: oneOf(obj.risk, exports.RISK_LEVELS, "low"),
        owner: oneOf(obj.owner, exports.OWNERS, "unknown"),
        suggested_labels: strArray(obj.suggested_labels, 10),
        confidence: clamp01(obj.confidence),
        summary: typeof obj.summary === "string" && obj.summary.trim().length > 0
            ? obj.summary.trim()
            : "No summary provided.",
        next_steps: strArray(obj.next_steps, 7).length
            ? strArray(obj.next_steps, 7)
            : ["Review the issue/PR description"],
        success_signals: {
            metrics: strArray(obj.success_signals?.metrics, 5),
            events: strArray(obj.success_signals?.events, 8),
        },
        questions: strArray(obj.questions, 3),
        // New fields
        estimated_effort: oneOf(obj.estimated_effort, exports.EFFORT_SIZES, "m"),
        related_components: strArray(obj.related_components, 15),
        breaking_change: safeBool(obj.breaking_change, false),
        migration_notes: safeString(obj.migration_notes),
        suggested_assignee_role: safeString(obj.suggested_assignee_role, "unspecified"),
    };
}
// ── Build ticket template from triage payload ──────────────────────
const CATEGORY_TO_JIRA_TYPE = {
    bug: "Bug",
    enhancement: "Story",
    docs: "Task",
    "token-change": "Story",
    "component-change": "Story",
    migration: "Epic",
    question: "Task",
};
const RISK_TO_PRIORITY = {
    high: "P1",
    medium: "P2",
    low: "P3",
};
const OWNER_TO_TEAM = {
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
function buildTicketTemplate(payload, issueTitle) {
    const type = CATEGORY_TO_JIRA_TYPE[payload.category];
    // Build acceptance criteria from next_steps + success_signals
    const acceptance = [...payload.next_steps];
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
        descParts.push(`\n*Open questions:*\n${payload.questions.map((q) => `- ${q}`).join("\n")}`);
    }
    // Epic suggestion heuristic
    let epicSuggestion = "";
    if (payload.category === "migration") {
        epicSuggestion = `[Migration] ${payload.product_area}`;
    }
    else if (payload.breaking_change) {
        epicSuggestion = `[Breaking Changes] ${payload.product_area}`;
    }
    else if (payload.related_components.length >= 3) {
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
//# sourceMappingURL=schema.js.map