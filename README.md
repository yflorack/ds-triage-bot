# ds-triage-bot

AI-powered design system triage bot for GitHub Issues and Pull Requests.

Uses **Anthropic Claude** to automatically categorize, label, and summarize incoming issues and PRs with actionable next steps.

---

## Features

- Runs on `issues: opened, edited` and `pull_request_target: opened, edited, synchronize`
- Computes lightweight heuristics from file paths and body text before calling the model
- Validates Claude's JSON response with safe fallback defaults
- Applies structured labels using the `ds:` taxonomy
- Posts a triage comment with summary, next steps, success signals, and follow-up questions
- Supports dry-run mode for testing
- Uses `pull_request_target` safely — never checks out or executes fork code

## Setup

### 1. Add secrets

In your repo settings, add:

| Secret              | Description                  |
| ------------------- | ---------------------------- |
| `ANTHROPIC_API_KEY` | Your Anthropic API key       |

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

### 2. Create the workflow

Copy `.github/workflows/triage.yml` to your repository (or reference this action from the marketplace).

### 3. Build the action

```bash
npm install
npm run build
git add dist/
git commit -m "build: compile action"
```

## Inputs

| Input             | Required | Default                   | Description                            |
| ----------------- | -------- | ------------------------- | -------------------------------------- |
| `anthropic_model` | No       | `claude-sonnet-4-20250514`       | Anthropic model identifier             |
| `max_tokens`      | No       | `700`                     | Max tokens for the model response      |
| `dry_run`         | No       | `false`                   | Log actions without applying them      |

## Label Taxonomy

Labels follow this convention:

- `ds:category:<value>` — bug, enhancement, docs, token-change, component-change, migration, question
- `ds:area:<value>` — Admin, Integrations, Reporting, Design System, Unknown
- `ds:risk:<value>` — low, medium, high
- `ds:owner:<value>` — design, engineering, both, analytics, unknown

Additional suggested labels: `needs-metrics`, `breaking-change`, `deprecation`, `needs-design`, `needs-eng`

## Example Comment

When the bot triages an issue, it posts:

```
### DS Triage
**Category:** component-change
**Area:** Design System
**Risk:** medium
**Owner:** engineering
**Confidence:** 0.87

**Summary**
This PR updates the Button component to use the new token system,
replacing hardcoded color values with design tokens.

**Next steps**
- [ ] Review token mapping in Button.tsx
- [ ] Verify Storybook stories still render correctly
- [ ] Run visual regression tests
- [ ] Update migration guide

**Success signals**
Metrics: Token adoption rate, Component render time
Events: Button token migration complete

**Questions**
- Are there any other components that depend on Button's color values?
```

## Architecture

```
src/
  index.ts       — Entry point, orchestrates the action
  anthropic.ts   — Heuristics + Claude API call
  schema.ts      — JSON schema validation with safe defaults
  github.ts      — Octokit helpers (labels, comments, file listing)
```

## Security

- Uses `pull_request_target` but does NOT checkout fork code
- Only reads metadata via GitHub API (title, body, file paths)
- Never logs API keys or secrets
- Fails gracefully with a comment if AI response is invalid

## License

MIT
