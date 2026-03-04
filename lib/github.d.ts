/**
 * github.ts — GitHub helpers for labeling, commenting, and ticket scripting.
 */
import * as github from "@actions/github";
import { TriagePayload } from "./schema";
type Octokit = ReturnType<typeof github.getOctokit>;
export declare function buildLabels(payload: TriagePayload): string[];
export declare function buildComment(payload: TriagePayload, issueTitle: string): string;
export declare function applyLabels(octokit: Octokit, owner: string, repo: string, issueNumber: number, labels: string[]): Promise<void>;
export declare function postComment(octokit: Octokit, owner: string, repo: string, issueNumber: number, body: string): Promise<void>;
export declare function postErrorComment(octokit: Octokit, owner: string, repo: string, issueNumber: number): Promise<void>;
export declare function getChangedFiles(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<string[]>;
export {};
//# sourceMappingURL=github.d.ts.map