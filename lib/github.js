"use strict";
/**
 * github.ts — GitHub helpers for labeling, commenting, and ticket scripting.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLabels = buildLabels;
exports.buildComment = buildComment;
exports.applyLabels = applyLabels;
exports.postComment = postComment;
exports.postErrorComment = postErrorComment;
exports.getChangedFiles = getChangedFiles;
const core = __importStar(require("@actions/core"));
const schema_1 = require("./schema");
// ── Effort size display ────────────────────────────────────────────
const EFFORT_LABELS = {
    xs: "XS (< 1 hour)",
    s: "S (1–4 hours)",
    m: "M (0.5–2 days)",
    l: "L (3–5 days)",
    xl: "XL (1+ week)",
};
// ── Build labels from payload ──────────────────────────────────────
function buildLabels(payload) {
    const labels = new Set();
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
function buildComment(payload, issueTitle) {
    const lines = [];
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
    if (payload.success_signals.metrics.length ||
        payload.success_signals.events.length) {
        lines.push("");
        lines.push("**Success signals**");
        if (payload.success_signals.metrics.length) {
            lines.push(`Metrics: ${payload.success_signals.metrics.join(", ")}`);
        }
        if (payload.success_signals.events.length) {
            lines.push(`Events: ${payload.success_signals.events.join(", ")}`);
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
    const ticket = (0, schema_1.buildTicketTemplate)(payload, issueTitle);
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
    lines.push(`<sub>Triaged automatically by ds-triage-bot (confidence ${(payload.confidence * 100).toFixed(0)}%) | effort: ${payload.estimated_effort}</sub>`);
    return lines.join("\n");
}
// ── Jira copy block ────────────────────────────────────────────────
// Each field gets its own fenced code block so GitHub renders a native
// copy button for every value — no need to manually select text.
function jiraField(label, value) {
    return `**${label}**\n\`\`\`\n${value}\n\`\`\``;
}
function buildJiraCopyBlock(ticket) {
    const lines = [];
    lines.push(`<details>`);
    lines.push(`<summary>📋 Copy as Jira ${ticket.type} (each field has a copy button)</summary>`);
    lines.push("");
    lines.push(jiraField("Type", ticket.type));
    lines.push("");
    lines.push(jiraField("Title", ticket.title));
    lines.push("");
    lines.push(jiraField("Priority", ticket.priority));
    lines.push("");
    lines.push(jiraField("Team", ticket.team));
    lines.push("");
    lines.push(jiraField("Effort", EFFORT_LABELS[ticket.effort] || ticket.effort));
    if (ticket.components.length) {
        lines.push("");
        lines.push(jiraField("Components", ticket.components.join(", ")));
    }
    if (ticket.epic_suggestion) {
        lines.push("");
        lines.push(jiraField("Suggested Epic", ticket.epic_suggestion));
    }
    lines.push("");
    lines.push(jiraField("Description", ticket.description));
    lines.push("");
    const acText = ticket.acceptance_criteria
        .map((ac, i) => `${i + 1}. ${ac}`)
        .join("\n");
    lines.push(jiraField("Acceptance Criteria", acText));
    if (ticket.labels.length) {
        lines.push("");
        lines.push(jiraField("Labels", ticket.labels.join(", ")));
    }
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>💡 Want to automate this instead?</summary>");
    lines.push("");
    lines.push("1. This action exposes a `ticket_json` output with all fields above in machine-readable format");
    lines.push("2. Add the [`atlassian/gajira-create`](https://github.com/atlassian/gajira-create) action as a downstream job in your workflow");
    lines.push("3. You'll need three secrets: `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, and `JIRA_API_TOKEN`");
    lines.push("4. Create an API token at [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)");
    lines.push("");
    lines.push("See `triage.yml` in this repo for a ready-to-uncomment Jira job example.");
    lines.push("");
    lines.push("</details>");
    lines.push("");
    lines.push(`</details>`);
    return lines.join("\n");
}
// ── JSON copy block ────────────────────────────────────────────────
function buildJsonCopyBlock(payload, ticket) {
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
    const lines = [];
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
function buildLinearCopyBlock(ticket, payload) {
    const priorityMap = {
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
    const lines = [];
    lines.push(`<details>`);
    lines.push(`<summary>📐 Copy as Linear issue</summary>`);
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(linearObj, null, 2));
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>💡 Want to automate this instead?</summary>");
    lines.push("");
    lines.push("1. This action exposes a `ticket_json` output with all fields above in machine-readable format");
    lines.push("2. Use the [Linear API](https://developers.linear.app/docs/graphql/working-with-the-graphql-api) or [`linear-app/linear-github-action`](https://github.com/linear-app/linear-github-action) as a downstream job");
    lines.push("3. You'll need a `LINEAR_API_KEY` secret — create one at **Settings → API → Personal API keys** in Linear");
    lines.push("");
    lines.push("See `triage.yml` in this repo for the pattern used in the Jira example — the same `needs.triage.outputs.ticket_json` approach works for Linear.");
    lines.push("");
    lines.push("</details>");
    lines.push("");
    lines.push(`</details>`);
    return lines.join("\n");
}
// ── Apply labels ───────────────────────────────────────────────────
async function applyLabels(octokit, owner, repo, issueNumber, labels) {
    core.info(`Applying ${labels.length} labels to #${issueNumber}`);
    await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
    });
}
// ── Post comment ───────────────────────────────────────────────────
async function postComment(octokit, owner, repo, issueNumber, body) {
    core.info(`Posting triage comment on #${issueNumber}`);
    await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
    });
}
// ── Post error comment ─────────────────────────────────────────────
async function postErrorComment(octokit, owner, repo, issueNumber) {
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
async function getChangedFiles(octokit, owner, repo, prNumber) {
    const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
        per_page: 100,
    });
    return files.map((f) => f.filename);
}
//# sourceMappingURL=github.js.map