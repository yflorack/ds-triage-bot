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

import * as core from "@actions/core";
import * as github from "@actions/github";
import { computeHeuristics, triageWithClaude } from "./anthropic";
import { buildTicketTemplate } from "./schema";
import {
  applyLabels,
  buildComment,
  buildLabels,
  getChangedFiles,
  postComment,
  postErrorComment,
} from "./github";

async function run(): Promise<void> {
  try {
    // ── Read inputs ────────────────────────────────────────────────
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      core.setFailed("GITHUB_TOKEN is required");
      return;
    }

    const model =
      core.getInput("anthropic_model") ||
      process.env.INPUT_ANTHROPIC_MODEL ||
      "claude-sonnet-4-20250514";

    const maxTokens = parseInt(core.getInput("max_tokens") || "1024", 10);
    const dryRun = core.getInput("dry_run") === "true";

    const octokit = github.getOctokit(token);
    const { context } = github;

    // ── Determine event type ───────────────────────────────────────
    const eventName = context.eventName;
    const isPR =
      eventName === "pull_request_target" || eventName === "pull_request";
    const isIssue = eventName === "issues";

    if (!isPR && !isIssue) {
      core.info(`Unsupported event: ${eventName}. Skipping.`);
      return;
    }

    // ── Extract metadata ───────────────────────────────────────────
    const payload = isPR
      ? context.payload.pull_request
      : context.payload.issue;

    if (!payload) {
      core.setFailed("No issue or PR payload found in context");
      return;
    }

    const title: string = payload.title ?? "";
    const body: string = payload.body ?? "";
    const number: number = payload.number;
    const { owner, repo } = context.repo;

    core.info(`Triaging ${isPR ? "PR" : "issue"} #${number}: ${title}`);

    // ── Get changed files (PRs only) ───────────────────────────────
    let changedFiles: string[] = [];
    if (isPR) {
      changedFiles = await getChangedFiles(octokit, owner, repo, number);
      core.info(`PR has ${changedFiles.length} changed files`);
    }

    // ── Heuristics ─────────────────────────────────────────────────
    const hints = computeHeuristics(changedFiles, body);
    core.info(
      `Heuristics: category=${hints.likelyCategory ?? "none"}, riskBump=${hints.riskBump}`
    );

    // ── Call Claude ────────────────────────────────────────────────
    let triageResult;
    try {
      triageResult = await triageWithClaude(
        title,
        body,
        changedFiles,
        hints,
        model,
        maxTokens
      );
    } catch (err) {
      core.warning(`Claude triage failed: ${err}`);
      if (!dryRun) {
        await postErrorComment(octokit, owner, repo, number);
      }
      core.setFailed("Triage failed — see comment on issue/PR");
      return;
    }

    core.info(`Triage result: ${JSON.stringify(triageResult, null, 2)}`);

    // ── Apply results ──────────────────────────────────────────────
    const labels = buildLabels(triageResult);
    const comment = buildComment(triageResult, title);

    if (dryRun) {
      core.info("[DRY RUN] Would apply labels: " + labels.join(", "));
      core.info("[DRY RUN] Would post comment:\n" + comment);
    } else {
      await applyLabels(octokit, owner, repo, number, labels);
      await postComment(octokit, owner, repo, number, comment);
    }

    // ── Set comprehensive outputs ──────────────────────────────────
    // Core triage fields
    core.setOutput("category", triageResult.category);
    core.setOutput("product_area", triageResult.product_area);
    core.setOutput("risk", triageResult.risk);
    core.setOutput("owner", triageResult.owner);
    core.setOutput("confidence", triageResult.confidence.toString());
    core.setOutput("summary", triageResult.summary);

    // New enhanced fields
    core.setOutput("estimated_effort", triageResult.estimated_effort);
    core.setOutput("breaking_change", triageResult.breaking_change.toString());
    core.setOutput(
      "related_components",
      JSON.stringify(triageResult.related_components)
    );
    core.setOutput("suggested_assignee_role", triageResult.suggested_assignee_role);
    core.setOutput("migration_notes", triageResult.migration_notes);

    // Structured arrays as JSON for downstream consumption
    core.setOutput("next_steps", JSON.stringify(triageResult.next_steps));
    core.setOutput("questions", JSON.stringify(triageResult.questions));
    core.setOutput("labels", JSON.stringify(labels));
    core.setOutput(
      "success_metrics",
      JSON.stringify(triageResult.success_signals.metrics)
    );
    core.setOutput(
      "success_events",
      JSON.stringify(triageResult.success_signals.events)
    );

    // Full ticket template as JSON
    const ticket = buildTicketTemplate(triageResult, title);
    core.setOutput("ticket_json", JSON.stringify(ticket));

    // Full triage payload as JSON (for any custom integration)
    core.setOutput("triage_json", JSON.stringify(triageResult));

    core.info("Triage complete!");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed("An unexpected error occurred");
    }
  }
}

run();
