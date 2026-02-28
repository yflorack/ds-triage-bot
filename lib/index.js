"use strict";
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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const anthropic_1 = require("./anthropic");
const github_1 = require("./github");
async function run() {
    try {
        // ── Read inputs ────────────────────────────────────────────────
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            core.setFailed("GITHUB_TOKEN is required");
            return;
        }
        const model = core.getInput("anthropic_model") ||
            process.env.INPUT_ANTHROPIC_MODEL ||
            "claude-sonnet-4-20250514";
        const maxTokens = parseInt(core.getInput("max_tokens") || "700", 10);
        const dryRun = core.getInput("dry_run") === "true";
        const octokit = github.getOctokit(token);
        const { context } = github;
        // ── Determine event type ───────────────────────────────────────
        const eventName = context.eventName;
        const isPR = eventName === "pull_request_target" || eventName === "pull_request";
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
        const title = payload.title ?? "";
        const body = payload.body ?? "";
        const number = payload.number;
        const { owner, repo } = context.repo;
        core.info(`Triaging ${isPR ? "PR" : "issue"} #${number}: ${title}`);
        // ── Get changed files (PRs only) ───────────────────────────────
        let changedFiles = [];
        if (isPR) {
            changedFiles = await (0, github_1.getChangedFiles)(octokit, owner, repo, number);
            core.info(`PR has ${changedFiles.length} changed files`);
        }
        // ── Heuristics ─────────────────────────────────────────────────
        const hints = (0, anthropic_1.computeHeuristics)(changedFiles, body);
        core.info(`Heuristics: category=${hints.likelyCategory ?? "none"}, riskBump=${hints.riskBump}`);
        // ── Call Claude ────────────────────────────────────────────────
        let triageResult;
        try {
            triageResult = await (0, anthropic_1.triageWithClaude)(title, body, changedFiles, hints, model, maxTokens);
        }
        catch (err) {
            core.warning(`Claude triage failed: ${err}`);
            if (!dryRun) {
                await (0, github_1.postErrorComment)(octokit, owner, repo, number);
            }
            core.setFailed("Triage failed — see comment on issue/PR");
            return;
        }
        core.info(`Triage result: ${JSON.stringify(triageResult, null, 2)}`);
        // ── Apply results ──────────────────────────────────────────────
        const labels = (0, github_1.buildLabels)(triageResult);
        const comment = (0, github_1.buildComment)(triageResult);
        if (dryRun) {
            core.info("[DRY RUN] Would apply labels: " + labels.join(", "));
            core.info("[DRY RUN] Would post comment:\n" + comment);
        }
        else {
            await (0, github_1.applyLabels)(octokit, owner, repo, number, labels);
            await (0, github_1.postComment)(octokit, owner, repo, number, comment);
        }
        // ── Set outputs ────────────────────────────────────────────────
        core.setOutput("category", triageResult.category);
        core.setOutput("risk", triageResult.risk);
        core.setOutput("confidence", triageResult.confidence.toString());
        core.setOutput("summary", triageResult.summary);
        core.info("Triage complete!");
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            core.setFailed("An unexpected error occurred");
        }
    }
}
run();
//# sourceMappingURL=index.js.map