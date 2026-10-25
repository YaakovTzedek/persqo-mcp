# Persqo MCP Server

AI personas test your web app like real users, then hand your coding agent ready-to-paste fix prompts.

[Persqo](https://persqo.com) runs AI personas (first-time visitor, impatient mobile user, accessibility-dependent user and more) through your live or preview site in a real browser. Every run gives you step-by-step recordings, screenshots and prioritized findings. This MCP server lets Claude Code, Cursor, Codex and any MCP client start a test, wait for it, read findings and pull a fix prompt straight into the session.

## Get an API key
Sign up at https://persqo.com and create an API key (`pq_live_...`) in the dashboard.

## Option A: remote server (no install)
```json
{
  "mcpServers": {
    "persqo": {
      "url": "https://persqo.com/api/mcp",
      "headers": { "Authorization": "Bearer pq_live_YOUR_KEY" }
    }
  }
}
```
Claude Code:
```bash
claude mcp add --transport http persqo https://persqo.com/api/mcp --header "Authorization: Bearer pq_live_YOUR_KEY"
```

## Option B: local stdio from GitHub
`persqo-mcp` is not on npm. Install and run the stdio server from this repository. `package.json` maps the `persqo-mcp` command to `bin.js`, which is what `npx` executes:

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
Optional `PERSQO_API_BASE` (default `https://persqo.com`).

## Tools
| Tool | What it does |
|---|---|
| `run_test` | Start persona testers against a public https URL. wait true polls until the test finishes and returns a summary plus the fix prompt. Persqo's browser runs in the cloud and cannot open localhost. Deploy a preview (Vercel or Netlify) or tunnel your machine with ngrok or cloudflared, then pass that https URL. `timeout_ms` default 120000, max 600000. Requires `url`. |
| `get_test_status` | Read status, personas, findings, cost, and the report URL. Requires `test_id`. |
| `get_findings` | Findings with severity, screenshots, and fix_prompt. Requires `test_id`. |
| `get_fix_prompt` | One combined fix prompt for a finished test. Requires `test_id`. |
| `generate_personas` | Suggest personas for a URL. Does not spend a session. Requires `url`. |
| `list_tests` | List recent tests. Optional `limit`. |

## Notes
The Persqo browser cannot open `localhost`. Use a Vercel/Netlify preview URL or an ngrok / cloudflared tunnel.

## License
MIT
