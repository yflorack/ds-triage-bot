/**
 * github.ts — GitHub helpers for labeling, commenting, and ticket scripting.
 */

import * as github from "@actions/github";
import * as core from "@actions/core";
import { TriagePayload, TicketTemplate, buildTicketTemplate } from "./schema";

type Octokit = ReturnType<typeof github.getOctokit>;

// ── Effort size display ────────────────────────────────────────────

const EFFORT_LABELS: Record<string, string> = {
  xs: "XS (< 1 hour)",
  s: "S (1–4 hours)",
  m: "M (0.5–2 days)",
  l: "L (3–5 days)",
  xl: "XL (1+ week)",
};

// ── Build labels from payload ──────────────────────────────────────

export function buildLabels(payload: TriagePayload): string[] {
  const labels = new Set<string>();

  labels.add(`ds:category:${payload.category}`);
  labels.add(`ds:area:${payload.product_area}`);
  labels.add(`ds:risk:${payload.risk}`);
  labels.add(`ds:owner:${payload.owner}`);
  labels.add(`ds:effort:${payload.estimated_effort}`);

  if (payload.breaking_change) {
    labels.add("breaking-change");
  }

  for (const label of payload.suggested_labels) {
    labels.add(label);
  }

  return Array.from(labels);
}

// ── Build comment body ─────────────────────────────────────────────

export function buildComment(
  payload: TriagePayload,
  issueTitle: string
): string {
  const lines: string[] = [];

  // ── Main triage section ──────────────────────────────────────────
  lines.push("### DS Triage");
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **Category** | \`${payload.category}\` |`);
  lines.push(`| **Area** | ${payload.product_area} |`);
  lines.push(`| **Risk** | ${payload.risk} |`);
  lines.push(`| **Owner** | ${payload.owner} |`);
  lines.push(`| **Effort** | ${EFFORT_LABELS[payload.estimated_effort] || payload.estimated_effort} |`);
  lines.push(`| **Confidence** | ${(payload.confidence * 100).toFixed(0)}% |`);
  if (payload.breaking_change) {
    lines.push(`| **Breaking** | :warning: Yes |`);
  }
  if (payload.related_components.length) {
    lines.push(`| **Components** | ${payload.related_components.map(c => `\`${c}\``).join(", ")} |`);
  }
  if (payload.suggested_assignee_role !== "unspecified") {
    lines.push(`| **Suggested reviewer** | ${payload.suggested_assignee_role} |`);
  }

  lines.push("");
  lines.push("**Summary**");
  lines.push(payload.summary);

  // ── Migration notes (if any) ─────────────────────────────────────
  if (payload.migration_notes) {
    lines.push("");
    lines.push("**Migration notes**");
    lines.push(payload.migration_notes);
  }

  // ── Next steps ───────────────────────────────────────────────────
  lines.push("");
  lines.push("**Next steps**");
  for (const step of payload.next_steps) {
    lines.push(`- [ ] ${step}`);
  }

  // ── Success signals ──────────────────────────────────────────────
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

  // ── Questions ────────────────────────────────────────────────────
  if (payload.questions.length) {
    lines.push("");
    lines.push("**Questions**");
    for (const q of payload.questions) {
      lines.push(`- ${q}`);
    }
  }

  // ── Collapsible: Copy as Jira Story ──────────────────────────────
  const ticket = buildTicketTemplate(payload, issueTitle);
  lines.push("");
  lines.push(buildJiraCopyBlock(ticket));

  // ── Collapsible: Copy as JSON ────────────────────────────────────
  lines.push("");
  lines.push(buildJsonCopyBlock(payload, ticket));

  // ── Collapsible: Copy as Linear issue ────────────────────────────
  lines.push("");
  lines.push(buildLinearCopyBlock(ticket, payload));

  // ── Footer ───────────────────────────────────────────────────────
  lines.push("");
  lines.push(
    `<sub>Triaged automatically by ds-triage-bot (confidence ${(payload.confidence * 100).toFixed(0)}%) | effort: ${payload.estimated_effort}</sub>`
  );

  return lines.join("\n");
}

// ── Jira copy block ────────────────────────────────────────────────

function buildJiraCopyBlock(ticket: TicketTemplate): string {
  const lines: string[] = [];
  lines.push(`<details>`);
  lines.push(`<summary>📋 Copy as Jira ${ticket.type}</summary>`);
  lines.push("");
  lines.push(`**Type:** ${ticket.type}`);
  lines.push(`**Title:** ${ticket.title}`);
  lines.push(`**Priority:** ${ticket.priority}`);
  lines.push(`**Team:** ${ticket.team}`);
  lines.push(`**Effort:** ${EFFORT_LABELS[ticket.effort] || ticket.effort}`);
  if (ticket.components.length) {
    lines.push(`**Components:** ${ticket.components.join(", ")}`);
  }
  if (ticket.epic_suggestion) {
    lines.push(`**Suggested Epic:** ${ticket.epic_suggestion}`);
  }
  lines.push("");
  lines.push("**Description:**");
  lines.push(ticket.description);
  lines.push("");
  lines.push("**Acceptance Criteria:**");
  for (const ac of ticket.acceptance_criteria) {
    lines.push(`- [ ] ${ac}`);
  }
  if (ticket.labels.length) {
    lines.push("");
    lines.push(`**Labels:** ${ticket.labels.join(", ")}`);
  }
  lines.push("");
  lines.push(`</details>`);
  return lines.join("\n");
}

// ── JSON copy block ────────────────────────────────────────────────

function buildJsonCopyBlock(
  payload: TriagePayload,
  ticket: TicketTemplate
): string {
  const exportObj = {
    triage: {
      category: payload.category,
      product_area: payload.product_area,
      risk: payload.risk,
      owner: payload.owner,
      confidence: payload.confidence,
      estimated_effort: payload.estimated_effort,
      breaking_change: payload.breaking_change,
      related_components: payload.related_components,
      suggested_assignee_role: payload.suggested_assignee_role,
      summary: payload.summary,
      next_steps: payload.next_steps,
      success_signals: payload.success_signals,
      questions: payload.questions,
      migration_notes: payload.migration_notes,
    },
    ticket: {
      type: ticket.type,
      title: ticket.title,
      priority: ticket.priority,
      team: ticket.team,
      effort: ticket.effort,
      components: ticket.components,
      epic_suggestion: ticket.epic_suggestion,
      acceptance_criteria: ticket.acceptance_criteria,
      labels: ticket.labels,
    },
  };

  const lines: string[] = [];
  lines.push(`<details>`);
  lines.push(`<summary>📦 Copy as JSON (for API integration)</summary>`);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(exportObj, null, 2));
  lines.push("```");
  lines.push("");
  lines.push(`</details>`);
  return lines.join("\n");
}

// ── Linear copy block ──────────────────────────────────────────────

function buildLinearCopyBlock(
  ticket: TicketTemplate,
  payload: TriagePayload
): string {
  const priorityMap: Record<string, number> = {
    P1: 1,
    P2: 2,
    P3: 3,
    P4: 4,
  };
  const linearObj = {
    title: ticket.title,
    description: ticket.description,
    priority: priorityMap[ticket.priority] ?? 3,
    labels: ticket.labels,
    estimate: { xs: 1, s: 2, m: 3, l: 5, xl: 8 }[payload.estimated_effort] ?? 3,
  };

  const lines: string[] = [];
  lines.push(`<details>`);
  lines.push(`<summary>📐 Copy as Linear issue</summary>`);
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(linearObj, null, 2));
  lines.push("```");
  lines.push("");
  lines.push(`</details>`);
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
