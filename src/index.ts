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
 */

import * as core from "@actions/core";
import * as github from "@actions/github";
import { computeHeuristics, triageWithClaude } from "./anthropic";
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

    const maxTokens = parseInt(core.getInput("max_tokens") || "700", 10);
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
    const comment = buildComment(triageResult);

    if (dryRun) {
      core.info("[DRY RUN] Would apply labels: " + labels.join(", "));
      core.info("[DRY RUN] Would post comment:\n" + comment);
    } else {
      await applyLabels(octokit, owner, repo, number, labels);
      await postComment(octokit, owner, repo, number, comment);
    }

    // ── Set outputs ────────────────────────────────────────────────
    core.setOutput("category", triageResult.category);
    core.setOutput("risk", triageResult.risk);
    core.setOutput("confidence", triageResult.confidence.toString());
    core.setOutput("summary", triageResult.summary);

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
