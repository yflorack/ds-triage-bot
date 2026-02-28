/**
 * schema.ts — Triage payload schema definition & validation.
 *
 * Defines the JSON shape Claude must return and provides a
 * validate-and-coerce function with safe defaults for every field.
 */
export declare const CATEGORIES: readonly ["bug", "enhancement", "docs", "token-change", "component-change", "migration", "question"];
export type Category = (typeof CATEGORIES)[number];
export declare const PRODUCT_AREAS: readonly ["Admin", "Integrations", "Reporting", "Design System", "Unknown"];
export type ProductArea = (typeof PRODUCT_AREAS)[number];
export declare const RISK_LEVELS: readonly ["low", "medium", "high"];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export declare const OWNERS: readonly ["design", "engineering", "both", "analytics", "unknown"];
export type Owner = (typeof OWNERS)[number];
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
/**
 * Parse raw JSON (possibly from Claude) into a safe TriagePayload.
 * Missing / invalid fields fall back to safe defaults rather than throwing.
 */
export declare function validatePayload(raw: unknown): TriagePayload;
//# sourceMappingURL=schema.d.ts.map