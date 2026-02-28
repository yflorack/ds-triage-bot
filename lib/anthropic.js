"use strict";
/**
 * anthropic.ts — Calls the Anthropic Messages API and returns
 * a validated TriagePayload.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeHeuristics = computeHeuristics;
exports.triageWithClaude = triageWithClaude;
const core = __importStar(require("@actions/core"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const schema_1 = require("./schema");
/**
 * Compute lightweight heuristics from changed file paths and body text.
 */
function computeHeuristics(changedFiles, body) {
    const paths = changedFiles.map((f) => f.toLowerCase());
    const bodyLower = body.toLowerCase();
    let likelyCategory = null;
    // Token / theme related files
    if (paths.some((p) => ["tokens", "theme", "styles", "css", "tailwind"].some((kw) => p.includes(kw)))) {
        likelyCategory = "token-change";
    }
    // Component / storybook related files
    if (paths.some((p) => ["components", "storybook", "stories"].some((kw) => p.includes(kw)))) {
        likelyCategory = "component-change";
    }
    // Risk bump keywords
    const riskBump = ["deprecate", "remove", "breaking", "rename"].some((kw) => bodyLower.includes(kw));
    return { likelyCategory, riskBump };
}
// ── System prompt ──────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a design-system triage assistant.
Given an issue or PR (title, body, changed file paths, and heuristic hints), return STRICT JSON matching this schema — no markdown, no explanation, just JSON:

{
  "category": "bug"|"enhancement"|"docs"|"token-change"|"component-change"|"migration"|"question",
  "product_area": "Admin"|"Integrations"|"Reporting"|"Design System"|"Unknown",
  "risk": "low"|"medium"|"high",
  "owner": "design"|"engineering"|"both"|"analytics"|"unknown",
  "suggested_labels": ["label1","label2"],
  "confidence": 0.0-1.0,
  "summary": "1-3 sentence summary",
  "next_steps": ["step1","step2","step3"],
  "success_signals": {
    "metrics": ["metric1"],
    "events": ["event1"]
  },
  "questions": ["question1"]
}

Rules:
- Return ONLY valid JSON. No prose, no code fences.
- suggested_labels should use the ds: prefix taxonomy (ds:category:X, ds:area:X, ds:risk:X, ds:owner:X) plus any extra like "needs-metrics", "breaking-change", "deprecation", "needs-design", "needs-eng".
- If heuristic hints are provided, weigh them but override if the content clearly indicates otherwise.
- Keep summary concise. 3-7 next_steps. 0-3 questions only if info is genuinely missing.`;
// ── Call Claude ─────────────────────────────────────────────────────
async function triageWithClaude(title, body, changedFiles, hints, model, maxTokens) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        throw new Error("ANTHROPIC_API_KEY is not set");
    }
    const client = new sdk_1.default({ apiKey });
    const userMessage = [
        `## Title\n${title}`,
        `## Body\n${body || "(empty)"}`,
        changedFiles.length
            ? `## Changed files\n${changedFiles.join("\n")}`
            : "",
        `## Heuristic hints\nLikely category: ${hints.likelyCategory ?? "none"}\nRisk bump: ${hints.riskBump}`,
    ]
        .filter(Boolean)
        .join("\n\n");
    core.info(`Calling Anthropic model=${model} maxTokens=${maxTokens}`);
    const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
    });
    // Extract text content
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
        throw new Error("No text content in Claude response");
    }
    const raw = textBlock.text.trim();
    core.info(`Raw model output length: ${raw.length} chars`);
    // Parse JSON — may throw
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        core.warning("Model returned invalid JSON");
        throw new Error("Invalid JSON from model");
    }
    return (0, schema_1.validatePayload)(parsed);
}
//# sourceMappingURL=anthropic.js.map