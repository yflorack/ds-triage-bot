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
export declare const EFFORT_SIZES: readonly ["xs", "s", "m", "l", "xl"];
export type EffortSize = (typeof EFFORT_SIZES)[number];
export declare const JIRA_ISSUE_TYPES: readonly ["Bug", "Story", "Task", "Epic"];
export type JiraIssueType = (typeof JIRA_ISSUE_TYPES)[number];
export declare const PRIORITIES: readonly ["P1", "P2", "P3", "P4"];
export type Priority = (typeof PRIORITIES)[number];
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
    estimated_effort: EffortSize;
    related_components: string[];
    breaking_change: boolean;
    migration_notes: string;
    suggested_assignee_role: string;
}
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
/**
 * Parse raw JSON (possibly from Claude) into a safe TriagePayload.
 * Missing / invalid fields fall back to safe defaults rather than throwing.
 */
export declare function validatePayload(raw: unknown): TriagePayload;
/**
 * Derive a ready-to-use ticket template from a triage payload.
 * The `issueTitle` parameter is the original GitHub issue/PR title.
 */
export declare function buildTicketTemplate(payload: TriagePayload, issueTitle: string): TicketTemplate;
//# sourceMappingURL=schema.d.ts.map