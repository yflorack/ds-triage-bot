"use strict";
/**
 * github.ts — GitHub helpers for labeling and commenting.
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
// ── Build labels from payload ──────────────────────────────────────
function buildLabels(payload) {
    const labels = new Set();
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
function buildComment(payload) {
    const lines = [];
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
    if (payload.questions.length) {
        lines.push("");
        lines.push("**Questions**");
        for (const q of payload.questions) {
            lines.push(`- ${q}`);
        }
    }
    lines.push("");
    lines.push(`<sub>Triaged automatically by ds-triage-bot (confidence ${payload.confidence.toFixed(2)})</sub>`);
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