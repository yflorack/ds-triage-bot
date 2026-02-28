/**
 * anthropic.ts — Calls the Anthropic Messages API and returns
 * a validated TriagePayload.
 */
import { TriagePayload } from "./schema";
export interface HeuristicHints {
    likelyCategory: string | null;
    riskBump: boolean;
}
/**
 * Compute lightweight heuristics from changed file paths and body text.
 */
export declare function computeHeuristics(changedFiles: string[], body: string): HeuristicHints;
export declare function triageWithClaude(title: string, body: string, changedFiles: string[], hints: HeuristicHints, model: string, maxTokens: number): Promise<TriagePayload>;
//# sourceMappingURL=anthropic.d.ts.map