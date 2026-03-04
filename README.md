# DS Triage Bot

AI-powered design system triage for GitHub Issues and Pull Requests, using **Anthropic Claude**.

Automatically categorizes, labels, and summarizes incoming issues and PRs with actionable next steps, effort estimates, ticket templates, and integration-ready outputs — so your team spends less time triaging and more time building.

---

## Quick Start (2 minutes)

### 1. Add your Anthropic API key as a secret

Go to your repo **Settings > Secrets and variables > Actions > New repository secret**:

| Secret              | Value                              |
| ------------------- | ---------------------------------- |
| `ANTHROPIC_API_KEY` | Your key from [console.anthropic.com](https://console.anthropic.com/) |

### 2. Create the workflow file

Create `.github/workflows/triage.yml` in your repository:

```yaml
name: DS Triage Bot

on:
  issues:
    types: [opened, edited]
  pull_request_target:
    types: [opened, edited, synchronize]

permissions:
  issues: write
  pull-requests: write
  contents: read

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - name: Run DS Triage Bot
        id: triage
        uses: yflorack/ds-triage-bot@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 3. That's it!

Open an issue or PR — the bot will automatically triage it within seconds.

---

## What It Does

When an issue or PR is opened, the bot:

1. Reads the title, body, and changed files (for PRs)
2. Runs lightweight heuristics to detect token/component changes
3. Sends context to Claude for AI-powered analysis
4. Applies structured labels using the `ds:` taxonomy (including effort sizing)
5. Posts a triage comment with summary, next steps, effort estimate, and follow-up questions
6. Appends collapsible **Copy as Jira**, **Copy as JSON**, and **Copy as Linear** blocks for instant ticket creation
7. Sets **17 Action outputs** so downstream workflow steps can create Jira tickets, send Slack notifications, or feed any integration

### Example Comment

```
### DS Triage

| Field | Value |
|-------|-------|
| **Category** | `component-change` |
| **Area** | Design System |
| **Risk** | medium |
| **Owner** | engineering |
| **Effort** | M (0.5–2 days) |
| **Confidence** | 87% |
| **Components** | `Button`, `TokenSystem` |
| **Suggested reviewer** | component-owner:Button |

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

<details>
<summary>📋 Copy as Jira Story</summary>

**Type:** Story
**Title:** [DS] Update Button to use token system
**Priority:** P2
**Team:** Design Systems — Engineering
**Effort:** M (0.5–2 days)
**Components:** Button, TokenSystem

**Acceptance Criteria:**
- [ ] Review token mapping in Button.tsx
- [ ] Verify Storybook stories still render correctly
- [ ] Run visual regression tests
- [ ] Update migration guide
- [ ] Verify metric: Token adoption rate

</details>

<details>
<summary>📦 Copy as JSON (for API integration)</summary>
{ "triage": { ... }, "ticket": { ... } }
</details>

<details>
<summary>📐 Copy as Linear issue</summary>
{ "title": "[DS] ...", "priority": 2, "estimate": 3, ... }
</details>
```

---

## Outputs

The action sets comprehensive outputs for downstream workflow steps:

### Core Fields

| Output                    | Type     | Description                              |
| ------------------------- | -------- | ---------------------------------------- |
| `category`                | string   | Triage category                          |
| `product_area`            | string   | Product area                             |
| `risk`                    | string   | Risk level (low/medium/high)             |
| `owner`                   | string   | Suggested owner team                     |
| `confidence`              | string   | Confidence score 0.0-1.0                 |
| `summary`                 | string   | 1-3 sentence summary                     |

### Enhanced Fields

| Output                    | Type     | Description                              |
| ------------------------- | -------- | ---------------------------------------- |
| `estimated_effort`        | string   | T-shirt size (xs/s/m/l/xl)               |
| `breaking_change`         | string   | "true" or "false"                        |
| `related_components`      | JSON     | Array of component names                 |
| `suggested_assignee_role` | string   | Ideal reviewer role description          |
| `migration_notes`         | string   | Migration guidance (if applicable)       |

### Structured Arrays (JSON)

| Output                    | Type     | Description                              |
| ------------------------- | -------- | ---------------------------------------- |
| `next_steps`              | JSON     | Recommended next steps                   |
| `questions`               | JSON     | Clarifying questions                     |
| `labels`                  | JSON     | All applied labels                       |
| `success_metrics`         | JSON     | Success metrics                          |
| `success_events`          | JSON     | Success events                           |

### Full Payloads (JSON)

| Output                    | Type     | Description                              |
| ------------------------- | -------- | ---------------------------------------- |
| `ticket_json`             | JSON     | Complete ticket template                 |
| `triage_json`             | JSON     | Full triage payload                      |

### Using Outputs in Downstream Steps

```yaml
jobs:
  triage:
    runs-on: ubuntu-latest
    outputs:
      ticket_json: ${{ steps.triage.outputs.ticket_json }}
      risk: ${{ steps.triage.outputs.risk }}
      owner: ${{ steps.triage.outputs.owner }}
    steps:
      - name: Run DS Triage Bot
        id: triage
        uses: yflorack/ds-triage-bot@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

  create-jira:
    needs: triage
    runs-on: ubuntu-latest
    steps:
      - name: Parse ticket
        run: |
          TICKET='${{ needs.triage.outputs.ticket_json }}'
          echo "type=$(echo $TICKET | jq -r '.type')" >> $GITHUB_OUTPUT
          echo "title=$(echo $TICKET | jq -r '.title')" >> $GITHUB_OUTPUT

  notify-slack:
    needs: triage
    if: needs.triage.outputs.risk == 'high'
    runs-on: ubuntu-latest
    steps:
      - uses: slackapi/slack-github-action@v1.27.0
        with:
          channel-id: C_DS_URGENT
          slack-message: ":rotating_light: High risk triage item — ${{ needs.triage.outputs.summary }}"
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
```

---

## Inputs

| Input             | Required | Default                    | Description                       |
| ----------------- | -------- | -------------------------- | --------------------------------- |
| `anthropic_model` | No       | `claude-sonnet-4-20250514` | Anthropic model to use            |
| `max_tokens`      | No       | `1024`                     | Max tokens for the model response |
| `dry_run`         | No       | `false`                    | Log actions without applying them |

### Dry Run Mode

Test without modifying your issues:

```yaml
- uses: yflorack/ds-triage-bot@v1
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  with:
    dry_run: "true"
```

Check the Actions log to see what the bot *would* have done.

---

## Label Taxonomy

The bot applies labels using a structured naming convention:

| Prefix             | Values                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `ds:category:`     | `bug`, `enhancement`, `docs`, `token-change`, `component-change`, `migration`, `question`  |
| `ds:area:`         | `Admin`, `Integrations`, `Reporting`, `Design System`, `Unknown`                           |
| `ds:risk:`         | `low`, `medium`, `high`                                                                    |
| `ds:owner:`        | `design`, `engineering`, `both`, `analytics`, `unknown`                                    |
| `ds:effort:`       | `xs`, `s`, `m`, `l`, `xl`                                                                  |

Additional labels: `breaking-change`, `needs-metrics`, `deprecation`, `needs-design`, `needs-eng`

---

## Ticket Templates

The bot generates ready-to-use ticket templates that map triage data to project management tools:

| Triage Field     | Jira Mapping             | Linear Mapping         |
| ---------------- | ------------------------ | ---------------------- |
| `category`       | Issue Type (Bug/Story/…) | Label                  |
| `risk`           | Priority (P1–P4)         | Priority (1–4)         |
| `estimated_effort` | Story Points           | Estimate (fibonacci)   |
| `owner`          | Team assignment          | Team                   |
| `next_steps`     | Acceptance Criteria      | Description            |
| `related_components` | Components field     | Labels                 |
| `summary`        | Description              | Description            |

### Epic Detection

The bot suggests epics when:
- Category is `migration` → `[Migration] {product_area}`
- `breaking_change` is true → `[Breaking Changes] {product_area}`
- 3+ `related_components` → `[Multi-component] {product_area} updates`

---

## Customization

### Use a different model

```yaml
with:
  anthropic_model: "claude-sonnet-4-20250514"
```

### Only triage issues (not PRs)

```yaml
on:
  issues:
    types: [opened]
```

### Only triage PRs that touch specific paths

```yaml
on:
  pull_request_target:
    types: [opened, synchronize]
    paths:
      - "packages/design-system/**"
      - "tokens/**"
```

---

## Cost

| Item                       | Cost                  |
| -------------------------- | --------------------- |
| GitHub Actions (public)    | Free                  |
| GitHub Actions (private)   | 2,000 min/month free  |
| Anthropic API per triage   | ~$0.003 - $0.01       |
| New Anthropic accounts     | $5 free credit        |

---

## Security

- Uses `pull_request_target` but does **not** checkout or execute fork code
- Only reads metadata via GitHub API (title, body, file paths)
- API keys are stored as encrypted GitHub Secrets
- Fails gracefully with a comment if AI response is invalid

---

## Architecture

```
src/
  index.ts       - Entry point, orchestrates the action, sets 17 outputs
  anthropic.ts   - Heuristics + Claude API call (enhanced prompt)
  schema.ts      - JSON schema validation, ticket template builder
  github.ts      - Octokit helpers (labels, comments, Jira/Linear/JSON blocks)
```

---

## Contributing

1. Clone the repo
2. `npm install`
3. Edit files in `src/`
4. Push to `main` — the build workflow auto-compiles `dist/`
5. Tag a release: `git tag v1.x.x && git push origin v1.x.x`

---

## License

MIT
