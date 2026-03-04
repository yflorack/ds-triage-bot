/**
 * src/index.ts — Entry point for the ds-triage-bot GitHub Action.
 *
 * Runs on:
 *   - issues: opened, edited
 *   - pull_request_target: opened, edited, synchronize
 *
 * Flow:
 *   1. Read issue/PR metadata (title, body, changed files for PRs)
 *   2. Compute lightweight heuristics
 *   3. Call Anthropic Claude for AI triage
 *   4. Validate + coerce the JSON response
 *   5. Apply labels and post a triage comment
 *   6. Set comprehensive Action outputs for downstream steps
 */
export {};
//# sourceMappingURL=index.d.ts.map