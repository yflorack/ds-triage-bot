"use strict";
/**
 * schema.ts — Triage payload schema definition & validation.
 *
 * Defines the JSON shape Claude must return and provides a
 * validate-and-coerce function with safe defaults for every field.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNERS = exports.RISK_LEVELS = exports.PRODUCT_AREAS = exports.CATEGORIES = void 0;
exports.validatePayload = validatePayload;
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
    };
}
//# sourceMappingURL=schema.js.map