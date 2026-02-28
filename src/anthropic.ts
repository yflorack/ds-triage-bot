/**
 * anthropic.ts — Calls the Anthropic Messages API and returns
 * a validated TriagePayload.
 */

import * as core from "@actions/core";
import Anthropic from "@anthropic-ai/sdk";
import { validatePayload, TriagePayload } from "./schema";

// ── Heuristic hints ────────────────────────────────────────────────

export interface HeuristicHints {
  likelyCategory: string | null;
  riskBump: boolean;
}

/**
 * Compute lightweight heuristics from changed file paths and body text.
 */
export function computeHeuristics(
  changedFiles: string[],
  body: string
): HeuristicHints {
  const paths = changedFiles.map((f) => f.toLowerCase());
  const bodyLower = body.toLowerCase();

  let likelyCategory: string | null = null;

  // Token / theme related files
  if (
    paths.some((p) =>
      ["tokens", "theme", "styles", "css", "tailwind"].some((kw) =>
        p.includes(kw)
      )
    )
  ) {
    likelyCategory = "token-change";
  }

  // Component / storybook related files
  if (
    paths.some((p) =>
      ["components", "storybook", "stories"].some((kw) => p.includes(kw))
    )
  ) {
    likelyCategory = "component-change";
  }

  // Risk bump keywords
  const riskBump = ["deprecate", "remove", "breaking", "rename"].some((kw) =>
    bodyLower.includes(kw)
  );

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

export async function triageWithClaude(
  title: string,
  body: string,
  changedFiles: string[],
  hints: HeuristicHints,
  model: string,
  maxTokens: number
): Promise<TriagePayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

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
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    core.warning("Model returned invalid JSON");
    throw new Error("Invalid JSON from model");
  }

  return validatePayload(parsed);
}
