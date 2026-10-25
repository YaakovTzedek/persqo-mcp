# Persqo MCP Server

AI personas test your web app like real users, then hand your coding agent ready-to-paste fix prompts.

[Persqo](https://persqo.com) runs AI personas (first-time visitor, impatient mobile user, accessibility-dependent user, and more) through your live or preview site in a real browser. Every run gives you step-by-step recordings, screenshots, and prioritized findings. This MCP server lets Claude, Claude Code, Cursor, Codex, and any MCP client start a test, wait for it, read findings, and pull a fix prompt straight into the session.

The live remote server is [https://persqo.com/api/mcp](https://persqo.com/api/mcp). This package is the stdio bridge for clients that launch a local command. It calls the Persqo API with `Authorization: Bearer` and the key from `PERSQO_API_KEY`. `persqo-mcp` is not published to npm.

## Get an API key

Sign up at https://persqo.com and create an API key (`pq_live_...`) in Settings, then API keys. The secret is shown once. Put it in `PERSQO_API_KEY`. Do not put the key in the URL.

A key belongs to the workspace, not one project. It can read and change every site on that account. Pass `project_id` or a site URL when the workspace has more than one project. One project is selected for you. Several matches come back as `project_choice`.

## Remote server

HTTP clients send `Authorization: Bearer` plus the key. The examples below read that key from `PERSQO_API_KEY` so the secret stays in the environment.

### Claude Code

```bash
claude mcp add --transport http persqo https://persqo.com/api/mcp --header "Authorization: Bearer $PERSQO_API_KEY"
```

```json
{
  "mcpServers": {
    "persqo": {
      "type": "http",
      "url": "https://persqo.com/api/mcp",
      "headers": {
        "Authorization": "Bearer ${PERSQO_API_KEY}"
      }
    }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "persqo": {
      "url": "https://persqo.com/api/mcp",
      "headers": {
        "Authorization": "Bearer ${env:PERSQO_API_KEY}"
      }
    }
  }
}
```

Or open the [Cursor install link](cursor://anysphere.cursor-deeplink/mcp/install?name=persqo&config=eyJ1cmwiOiJodHRwczovL3BlcnNxby5jb20vYXBpL21jcCIsImhlYWRlcnMiOnsiQXV0aG9yaXphdGlvbiI6IkJlYXJlciAke2VudjpQRVJTUU9fQVBJX0tFWX0ifX0=). Put the key in Cursor's secret store as `PERSQO_API_KEY`.

### Codex and other MCP clients

Use the same URL and header. Clients that speak stdio can use the local command in the next section instead.

```json
{
  "mcpServers": {
    "persqo": {
      "type": "http",
      "url": "https://persqo.com/api/mcp",
      "headers": {
        "Authorization": "Bearer ${PERSQO_API_KEY}"
      }
    }
  }
}
```

Claude and ChatGPT can also connect with OAuth at the same URL. That flow does not use an API key. API-key clients always send the Bearer header above.

## Local stdio server

`package.json` maps the `persqo-mcp` command to `bin.js`, which is what `npx` executes. The process reads `PERSQO_API_KEY` and sends `Authorization: Bearer <key>`.

```bash
npx -y github:YaakovTzedek/persqo-mcp
```

```json
{
  "mcpServers": {
    "persqo": {
      "command": "npx",
      "args": ["-y", "github:YaakovTzedek/persqo-mcp"],
      "env": { "PERSQO_API_KEY": "pq_live_YOUR_KEY" }
    }
  }
}
```

Claude Code:

```bash
claude mcp add persqo --env PERSQO_API_KEY=$PERSQO_API_KEY -- npx -y github:YaakovTzedek/persqo-mcp
```

Optional `PERSQO_API_BASE` (default `https://persqo.com`).

## Visitor place

Personas, runs, schedules, retests, and finding filters take four place fields. A project stores the same four as defaults. Omit a field to keep the project default.

| Field | Meaning |
|---|---|
| `language` | Spoken language, such as Hebrew or English. Auto visitors stay in one language and quote the site's own labels. |
| `locale` | Browser locale, BCP 47, such as `he-IL` or `en-US`. The run sets Accept-Language from this. |
| `country` | Country the visitor is in. Used for timezone and geolocation. |
| `city` | City the visitor is in. Used for timezone and geolocation. |

`create_project` accepts these as project defaults. `list_projects` returns them. `create_persona`, `list_personas`, `start_run`, `save_schedule`, `list_schedules`, `retest_finding`, and `list_findings` accept them as overrides or filters. Persona and schedule results include the place stored on each record.

## Tools

`start_run` and `reproduce_ticket` are dry runs until `confirm` is true. `run_test` with `wait: true` polls until the test finishes or `timeout_ms` (default 120000, max 600000) and then returns a summary plus the fix prompt.

The Persqo browser cannot open `localhost`. Use a Vercel or Netlify preview, or an ngrok or cloudflared tunnel.

### Projects, runs, and tests

| Tool | What it does | Parameters |
|---|---|---|
| `list_projects` | Projects in the workspace, including default `language`, `locale`, `country`, and `city`. | none |
| `list_sites` | Sites on the account. A key sees every site. | none |
| `create_project` | Create a project from a public https URL. Place fields become the project defaults. | `url` required. `language`, `locale`, `country`, `city` |
| `start_run` | Dry run until `confirm` is true. `personas` is `auto` or persona ids. A new URL creates the project. | `confirm`, `url` or `project_id`, `personas`, `language`, `locale`, `country`, `city` |
| `get_run` | Run status. | `run_id` |
| `get_run_replay` | Step timeline, thoughts, actions, and the stuck marker. | `run_id` |
| `get_report` | Score, counts, findings, and the PDF URL. | `run_id` |
| `get_report_pdf` | Report JSON, or PDF bytes when `format` is `pdf`. | `run_id`, optional `format` |
| `run_test` | Start testers against a public https URL. `wait` true returns a summary and the fix prompt. | `url` required. `personas`, `auth` (`email`, `password`, `login_url`), `wait`, `timeout_ms`, `idempotency_key`, `webhook_url` |
| `get_test_status` | Status, personas, findings, cost, and the report URL. | `test_id` |
| `list_tests` | Recent tests. | optional `limit` |
| `generate_personas` | Suggest personas for a URL. Does not spend a session. | `url` |

### Personas and findings

| Tool | What it does | Parameters |
|---|---|---|
| `list_personas` | Saved personas, including place. Place fields also filter. | `project_id` or `url`, `language`, `locale`, `country`, `city` |
| `create_persona` | Save a custom persona. | `project_id` or `url`, `name`, `role`, `device`, `goal`, `tech`, `language`, `locale`, `country`, `city` |
| `list_findings` | Filter findings. | `project_id` or `url`, `run_id`, `severity`, `status` (`open`, `fixed`, `ignored`), `page`, `persona`, `language`, `locale`, `country`, `city` |
| `get_finding` | One finding, with Claude Code, Cursor, and Lovable prompts. | `finding_id` |
| `get_findings` | Findings for one test, with severity, screenshots, and `fix_prompt`. | `test_id` |
| `get_fix_prompt` | One prompt to paste. | `test_id`, or `finding_id` |
| `update_finding` | Set status. | `finding_id`, `status` (`open`, `fixed`, or `ignored`) |
| `retest_finding` | Queue a retest. Place fields override the project defaults for that run. | `finding_id`, `language`, `locale`, `country`, `city` |
| `list_pages` | Per-page score and issue counts. | `project_id` or `url` |
| `get_trends` | Score over time, opened versus closed, and a two-run comparison. | `project_id` or `url`, `left`, `right` |
| `weekly_insights` | Weekly summary for one project. | `project_id` or `url` |

### Schedules, sharing, and notifications

| Tool | What it does | Parameters |
|---|---|---|
| `list_schedules` | Daily and weekly schedules, including the place each one runs with. | `project_id` or `url`, `language`, `locale`, `country`, `city` |
| `save_schedule` | Create or update a schedule. Pass `id` to update. | `id`, `project_id` or `url`, `frequency` (`daily` or `weekly`), `personas`, `language`, `locale`, `country`, `city` |
| `delete_schedule` | Delete a schedule. | `schedule_id` |
| `list_shares` | Public report links. | none |
| `create_share` | Share a run. | `run_id` |
| `revoke_share` | Revoke a share link. | `share_id` |
| `get_notifications` | `score_drop_email` and `schedule_email` for the key owner. | none |
| `update_notifications` | Set those two email switches. | `score_drop_email`, `schedule_email` |
| `list_webhooks` | Webhook endpoints. The signing secret is not shown again. | none |
| `create_webhook` | Register an https endpoint for `test.completed`. The `whsec_` secret is returned once. | `url` |
| `revoke_webhook` | Revoke a webhook. | `webhook_id` |

### Tickets

| Tool | What it does | Parameters |
|---|---|---|
| `list_tickets` | Synced Jira and Monday tickets. | `source`, `status`, `reproduced`, `country`, `language`, `device` |
| `reproduce_ticket` | Reproduce a ticket with a matching persona and browser. Dry run until `confirm` is true. `environment` overrides extracted place, device, and browser. Posting a comment back stays off until the workspace turns it on. | `ticket_id`, `confirm`, `environment` (`language`, `locale`, `country`, `city`, `device`, `browser`) |
| `get_ticket_reproduction` | Latest reproduction: result, replay, screenshots, console, network, root cause, and fix prompts. | `ticket_id` |

## Localhost

The Persqo browser cannot open `localhost`. Deploy a preview (Vercel or Netlify) or tunnel the machine:

```bash
ngrok http 3000
cloudflared tunnel --url http://localhost:3000
```

Then pass that https URL to `start_run` or `run_test`.

## License

MIT
