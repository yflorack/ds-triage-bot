/**
 * github.ts — GitHub helpers for labeling and commenting.
 */

import * as github from "@actions/github";
import * as core from "@actions/core";
import { TriagePayload } from "./schema";

type Octokit = ReturnType<typeof github.getOctokit>;

// ── Build labels from payload ──────────────────────────────────────

export function buildLabels(payload: TriagePayload): string[] {
  const labels = new Set<string>();

  labels.add(`ds:category:${payload.category}`);
  labels.add(`ds:area:${payload.product_area}`);
  labels.add(`ds:risk:${payload.risk}`);
  labels.add(`ds:owner:${payload.owner}`);

  for (const label of payload.suggested_labels) {
    labels.add(label);
  }

  return Array.from(labels);
}

// ── Build comment body ─────────────────────────────────────────────

export function buildComment(payload: TriagePayload): string {
  const lines: string[] = [];

  lines.push("### DS Triage");
  lines.push("");
  lines.push(`**Category:** ${payload.category}`);
  lines.push(`**Area:** ${payload.product_area}`);
  lines.push(`**Risk:** ${payload.risk}`);
  lines.push(`**Owner:** ${payload.owner}`);
  lines.push(`**Confidence:** ${payload.confidence.toFixed(2)}`);
  lines.push("");
  lines.push("**Summary**");
  lines.push(payload.summary);
  lines.push("");
  lines.push("**Next steps**");
  for (const step of payload.next_steps) {
    lines.push(`- [ ] ${step}`);
  }

  if (
    payload.success_signals.metrics.length ||
    payload.success_signals.events.length
  ) {
    lines.push("");
    lines.push("**Success signals**");
    if (payload.success_signals.metrics.length) {
      lines.push(
        `Metrics: ${payload.success_signals.metrics.join(", ")}`
      );
    }
    if (payload.success_signals.events.length) {
      lines.push(
        `Events: ${payload.success_signals.events.join(", ")}`
      );
    }
  }

  if (payload.questions.length) {
    lines.push("");
    lines.push("**Questions**");
    for (const q of payload.questions) {
      lines.push(`- ${q}`);
    }
  }

  lines.push("");
  lines.push(
    `<sub>Triaged automatically by ds-triage-bot (confidence ${payload.confidence.toFixed(2)})</sub>`
  );

  return lines.join("\n");
}

// ── Apply labels ───────────────────────────────────────────────────

export async function applyLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[]
): Promise<void> {
  core.info(`Applying ${labels.length} labels to #${issueNumber}`);
  await octokit.rest.issues.addLabels({
    owner,
    repo,
    issue_number: issueNumber,
    labels,
  });
}

// ── Post comment ───────────────────────────────────────────────────

export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  core.info(`Posting triage comment on #${issueNumber}`);
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

// ── Post error comment ─────────────────────────────────────────────

export async function postErrorComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<void> {
  const body = [
    "### DS Triage",
    "",
    "I wasn't able to automatically triage this item — the AI response was not valid.",
    "Please ensure the title and description contain enough context for categorization.",
    "",
    "<sub>ds-triage-bot</sub>",
  ].join("\n");

  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

// ── Get changed files for a PR ─────────────────────────────────────

export async function getChangedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string[]> {
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return files.map((f) => f.filename);
}
