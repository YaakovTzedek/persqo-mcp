#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const VERSION = "0.2.0";

const LOCALHOST = "Persqo's browser runs in the cloud and cannot open localhost. Deploy a preview (Vercel or Netlify) or tunnel your machine with ngrok or cloudflared, then pass that https URL.";

const PLACE_NOTE = "Spoken language is language. Browser locale is locale (BCP 47, such as he-IL or en-US) and sets Accept-Language. country and city set the visitor timezone and geolocation. Omit a field to keep the project default.";

const placeProps = {
  language: { type: "string", description: "Spoken language, such as Hebrew or English." },
  locale: { type: "string", description: "Browser locale (BCP 47), such as he-IL or en-US." },
  country: { type: "string", description: "Country the visitor is browsing from." },
  city: { type: "string", description: "City the visitor is browsing from." },
};

const projectProps = {
  project_id: { type: "string", description: "Project id. Required when the account has more than one project, unless url is set." },
  url: { type: "string", description: "Site URL. Selects the project, and creates one when start_run has not seen it before." },
};

function objectSchema(properties, required = []) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  };
}

const TOOLS = [
  {
    name: "create_persona",
    description: `Create a saved persona for a project. ${PLACE_NOTE} project_id or a site URL is required when the account has more than one project.`,
    inputSchema: objectSchema({
      ...projectProps,
      name: { type: "string", description: "Persona name." },
      role: { type: "string", description: "Who this visitor is, such as first-time visitor." },
      device: { type: "string", description: "Device, such as iPhone or laptop." },
      goal: { type: "string", description: "What this visitor is trying to do." },
      tech: { type: "string", description: "Comfort with software, such as low, medium, or high." },
      ...placeProps,
    }),
  },
  {
    name: "create_project",
    description: `Create a project from a public https URL. Optional language, locale, country, and city are the project defaults that new personas, runs, schedules, and retests inherit. ${LOCALHOST}`,
    inputSchema: objectSchema({
      url: { type: "string", description: "Public https URL of the site." },
      ...placeProps,
    }, ["url"]),
  },
  {
    name: "create_share",
    description: "Create a public share URL for a finished run.",
    inputSchema: objectSchema({
      run_id: { type: "string", description: "Run id to share." },
    }, ["run_id"]),
  },
  {
    name: "create_webhook",
    description: "Register an https endpoint for test.completed. The whsec_ signing secret is returned once.",
    inputSchema: objectSchema({
      url: { type: "string", description: "https endpoint that receives the webhook." },
    }, ["url"]),
  },
  {
    name: "delete_schedule",
    description: "Delete a daily or weekly schedule.",
    inputSchema: objectSchema({
      schedule_id: { type: "string", description: "Schedule id." },
      id: { type: "string", description: "Schedule id, if schedule_id is not set." },
    }, ["schedule_id"]),
  },
  {
    name: "generate_personas",
    description: "Suggest personas for a URL. Does not spend a session.",
    inputSchema: objectSchema({
      url: { type: "string", description: "Public https URL." },
    }, ["url"]),
  },
  {
    name: "get_finding",
    description: "One finding, including Claude Code, Cursor, and Lovable fix prompts.",
    inputSchema: objectSchema({
      finding_id: { type: "string", description: "Finding id." },
      findingId: { type: "string", description: "Finding id. Same as finding_id." },
      id: { type: "string", description: "Finding id, if finding_id is not set." },
    }, ["finding_id"]),
  },
  {
    name: "get_findings",
    description: "Findings for one test, with severity, screenshots, and fix_prompt.",
    inputSchema: objectSchema({
      test_id: { type: "string", description: "Test id." },
    }, ["test_id"]),
  },
  {
    name: "get_fix_prompt",
    description: "One combined fix prompt. Pass test_id for a finished test, or finding_id for one finding.",
    inputSchema: objectSchema({
      test_id: { type: "string", description: "Test id." },
      finding_id: { type: "string", description: "Finding id." },
      findingId: { type: "string", description: "Finding id. Same as finding_id." },
    }),
  },
  {
    name: "get_notifications",
    description: "Email notification settings for the key owner: score_drop_email and schedule_email.",
    inputSchema: objectSchema({}),
  },
  {
    name: "get_report",
    description: "Score, counts, findings, and the PDF URL for a run.",
    inputSchema: objectSchema({
      run_id: { type: "string", description: "Run id." },
      id: { type: "string", description: "Run id, if run_id is not set." },
    }, ["run_id"]),
  },
  {
    name: "get_report_pdf",
    description: "Report for a run. format json returns JSON. Omit format for the same JSON view; the PDF URL is on get_report.",
    inputSchema: objectSchema({
      run_id: { type: "string", description: "Run id." },
      id: { type: "string", description: "Run id, if run_id is not set." },
      format: { type: "string", description: "json, or pdf for the binary report." },
    }, ["run_id"]),
  },
  {
    name: "get_run",
    description: "Run status.",
    inputSchema: objectSchema({
      run_id: { type: "string", description: "Run id." },
      id: { type: "string", description: "Run id, if run_id is not set." },
    }, ["run_id"]),
  },
  {
    name: "get_run_replay",
    description: "Step timeline, thoughts, actions, and the stuck marker for a run.",
    inputSchema: objectSchema({
      run_id: { type: "string", description: "Run id." },
      id: { type: "string", description: "Run id, if run_id is not set." },
    }, ["run_id"]),
  },
  {
    name: "get_test_status",
    description: "Read status, personas, findings, cost, and the report URL for a test.",
    inputSchema: objectSchema({
      test_id: { type: "string", description: "Test id." },
    }, ["test_id"]),
  },
  {
    name: "get_ticket_reproduction",
    description: "Latest reproduction of a synced ticket: result, replay, screenshots, console, network, root cause, and fix prompts.",
    inputSchema: objectSchema({
      ticket_id: { type: "string", description: "Synced ticket id." },
      id: { type: "string", description: "Ticket id, if ticket_id is not set." },
    }, ["ticket_id"]),
  },
  {
    name: "get_trends",
    description: "Score over time, opened versus closed, and a two-run comparison. project_id or a site URL is required when the account has more than one project. left and right are run ids to compare.",
    inputSchema: objectSchema({
      ...projectProps,
      left: { type: "string", description: "Earlier run id." },
      right: { type: "string", description: "Later run id." },
    }),
  },
  {
    name: "list_findings",
    description: `Filter findings by project, run, severity, status, page, persona, and visitor place. ${PLACE_NOTE} project_id or a site URL is required when the account has more than one project.`,
    inputSchema: objectSchema({
      ...projectProps,
      run_id: { type: "string", description: "Only findings from this run." },
      severity: { type: "string", description: "Severity filter." },
      status: { type: "string", description: "open, fixed, or ignored." },
      page: { type: "string", description: "Page path or URL." },
      persona: { type: "string", description: "Persona id or name." },
      ...placeProps,
    }),
  },
  {
    name: "list_pages",
    description: "Per-page score and issue counts. project_id or a site URL is required when the account has more than one project.",
    inputSchema: objectSchema({ ...projectProps }),
  },
  {
    name: "list_personas",
    description: `List saved personas for a project, including spoken language, browser locale, country, and city. Those four fields are also filters. ${PLACE_NOTE} project_id or a site URL is required when the account has more than one project.`,
    inputSchema: objectSchema({
      ...projectProps,
      ...placeProps,
    }),
  },
  {
    name: "list_projects",
    description: "List projects in the workspace. Each project includes its default spoken language, browser locale, country, and city. A key sees every project on the account. Pass project_id or a site URL on later calls when more than one project exists. Several matches come back as project_choice.",
    inputSchema: objectSchema({}),
  },
  {
    name: "list_schedules",
    description: `List daily and weekly schedules. Each schedule includes the visitor place it runs with. language, locale, country, and city filter the list. ${PLACE_NOTE}`,
    inputSchema: objectSchema({
      ...projectProps,
      ...placeProps,
    }),
  },
  {
    name: "list_shares",
    description: "List public share URLs.",
    inputSchema: objectSchema({}),
  },
  {
    name: "list_sites",
    description: "List sites. A key sees every site in the account. Use this or list_projects to pick a site before a run.",
    inputSchema: objectSchema({}),
  },
  {
    name: "list_tests",
    description: "List recent tests.",
    inputSchema: objectSchema({
      limit: { type: "integer", description: "How many tests to return. Default 20." },
    }),
  },
  {
    name: "list_tickets",
    description: "List synced Jira and Monday tickets. Filter by source, status, reproduced, country, language, or device.",
    inputSchema: objectSchema({
      source: { type: "string", description: "Ticket source id." },
      status: { type: "string", description: "Ticket status." },
      reproduced: { type: "string", description: "Whether a reproduction exists." },
      country: { type: "string", description: "Country extracted from the ticket." },
      language: { type: "string", description: "Spoken language extracted from the ticket." },
      device: { type: "string", description: "Device extracted from the ticket." },
    }),
  },
  {
    name: "list_webhooks",
    description: "List webhook endpoints. Signing secrets are not returned again.",
    inputSchema: objectSchema({}),
  },
  {
    name: "reproduce_ticket",
    description: "Reproduce a synced ticket with a matching persona and browser. confirm true starts the run. Until then the call is a dry run. environment overrides the country, language, device, browser, locale, and city extracted from the ticket. Posting a comment back stays off until the workspace turns it on.",
    inputSchema: objectSchema({
      ticket_id: { type: "string", description: "Synced ticket id." },
      confirm: { type: "boolean", description: "true spends a session and starts the reproduction." },
      environment: {
        type: "object",
        description: "Overrides for fields extracted from the ticket.",
        properties: {
          ...placeProps,
          device: { type: "string" },
          browser: { type: "string", description: "Browser name to reproduce with." },
        },
      },
    }, ["ticket_id"]),
  },
  {
    name: "retest_finding",
    description: `Queue a retest of one finding. ${PLACE_NOTE}`,
    inputSchema: objectSchema({
      finding_id: { type: "string", description: "Finding id." },
      findingId: { type: "string", description: "Finding id. Same as finding_id." },
      id: { type: "string", description: "Finding id, if finding_id is not set." },
      ...placeProps,
    }, ["finding_id"]),
  },
  {
    name: "revoke_share",
    description: "Revoke a public share link.",
    inputSchema: objectSchema({
      share_id: { type: "string", description: "Share id." },
      id: { type: "string", description: "Share id, if share_id is not set." },
    }, ["share_id"]),
  },
  {
    name: "revoke_webhook",
    description: "Revoke a webhook endpoint.",
    inputSchema: objectSchema({
      webhook_id: { type: "string", description: "Webhook id." },
      id: { type: "string", description: "Webhook id, if webhook_id is not set." },
    }, ["webhook_id"]),
  },
  {
    name: "run_test",
    description: `Start persona testers against a public https URL. wait true polls until the test finishes and returns a summary plus the fix prompt. ${LOCALHOST}`,
    inputSchema: objectSchema({
      url: { type: "string", description: "Public https URL." },
      personas: {
        description: "Up to three persona objects (name, role, device, goal), or a count from 1 to 3.",
      },
      auth: {
        type: "object",
        description: "Optional login for the tester.",
        properties: {
          email: { type: "string" },
          password: { type: "string" },
          login_url: { type: "string" },
        },
      },
      wait: { type: "boolean", description: "Poll until the test finishes." },
      timeout_ms: { type: "integer", description: "Poll budget in milliseconds. Default 120000, max 600000." },
      idempotency_key: { type: "string", description: "Retrying with the same key returns the same test." },
      webhook_url: { type: "string", description: "https URL notified when the test finishes." },
    }, ["url"]),
  },
  {
    name: "save_schedule",
    description: `Create or update a daily or weekly test. ${PLACE_NOTE} frequency is daily or weekly. Pass id to update an existing schedule.`,
    inputSchema: objectSchema({
      id: { type: "string", description: "Schedule id to update. Omit to create." },
      ...projectProps,
      frequency: { type: "string", enum: ["daily", "weekly"], description: "How often the test runs." },
      personas: { description: "auto, or saved persona ids." },
      ...placeProps,
    }),
  },
  {
    name: "start_run",
    description: `Start a run. This is a dry run until confirm is true. Pass url or project_id. personas is auto or a list of persona ids. A new URL creates the project. ${PLACE_NOTE} ${LOCALHOST}`,
    inputSchema: objectSchema({
      confirm: { type: "boolean", description: "true spends a session and queues the run." },
      ...projectProps,
      personas: { description: "auto, or an array of saved persona ids." },
      ...placeProps,
    }),
  },
  {
    name: "update_finding",
    description: "Set a finding's status to open, fixed, or ignored.",
    inputSchema: objectSchema({
      finding_id: { type: "string", description: "Finding id." },
      findingId: { type: "string", description: "Finding id. Same as finding_id." },
      id: { type: "string", description: "Finding id, if finding_id is not set." },
      status: { type: "string", enum: ["open", "fixed", "ignored"], description: "New status." },
    }, ["finding_id", "status"]),
  },
  {
    name: "update_notifications",
    description: "Set score_drop_email and schedule_email for the key owner.",
    inputSchema: objectSchema({
      score_drop_email: { type: "boolean", description: "Email when the score drops." },
      schedule_email: { type: "boolean", description: "Email when a scheduled test finishes." },
    }),
  },
  {
    name: "weekly_insights",
    description: "Weekly score and findings summary for one project. project_id or a site URL is required when the account has more than one project.",
    inputSchema: objectSchema({ ...projectProps }),
  },
];

export const TOOL_NAMES = TOOLS.map((tool) => tool.name).sort();

function baseUrl() {
  return (process.env.PERSQO_API_BASE || "https://persqo.com").replace(/\/$/, "");
}

function headers(extra = {}) {
  const key = process.env.PERSQO_API_KEY || "";
  return { authorization: `Bearer ${key}`, "content-type": "application/json", ...extra };
}

async function api(path, options = {}) {
  const res = await fetch(`${baseUrl()}${path}`, { ...options, headers: headers(options.headers || {}) });
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: { message: text.slice(0, 200) } };
  }
  return { status: res.status, body };
}

function fail(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

function ok(body) {
  const text = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  const structured = body && typeof body === "object" ? body : { text };
  return { content: [{ type: "text", text }], structuredContent: structured, isError: false };
}

function summary(view, prompt) {
  const people = (view.personas || []).map((person) => `${person.name} (${person.device})`).join(", ") || "none";
  const head = `Test ${view.id} is ${view.status} on ${view.url}.\nPersonas: ${people}.\nFindings: ${(view.findings || []).length}.\nCost: ${view.cost?.usd || "$0.0000"}.`;
  if (view.status !== "completed" && view.status !== "failed") return `${head}\nThe test is still running.`;
  return prompt ? `${head}\n\nFix prompt:\n${prompt}` : head;
}

async function poll(id, timeoutMs) {
  const cap = Math.min(Math.max(Number(timeoutMs) || 120000, 1000), 600000);
  const started = Date.now();
  let last = null;
  while (Date.now() - started < cap) {
    const res = await api(`/api/v1/tests/${id}`);
    if (res.status >= 400) return res;
    last = res;
    if (res.body.status === "completed" || res.body.status === "failed" || res.body.status === "canceled") return res;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return last;
}

function idOf(args, keys) {
  for (const key of keys) {
    if (args[key] !== undefined && args[key] !== null && String(args[key]) !== "") return encodeURIComponent(String(args[key]));
  }
  return "";
}

function pick(args, keys) {
  const out = {};
  for (const key of keys) {
    if (args[key] !== undefined) out[key] = args[key];
  }
  return out;
}

const PLACE_KEYS = ["language", "locale", "country", "city"];

function query(args, keys) {
  const params = new URLSearchParams();
  for (const key of keys) {
    if (args[key] !== undefined && args[key] !== null && args[key] !== "") params.set(key, String(args[key]));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function readJson(path) {
  const res = await api(path);
  if (res.status >= 400) return fail(res.body?.error?.message || `Request failed (${res.status}).`);
  return ok(res.body);
}

async function sendJson(path, method, body, extraHeaders) {
  const options = { method, headers: extraHeaders };
  if (method !== "DELETE") options.body = JSON.stringify(body ?? {});
  const res = await api(path, options);
  if (res.status >= 400) return fail(res.body?.error?.message || `Request failed (${res.status}).`);
  return ok(res.body);
}

function parseMcpPayload(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const data = trimmed
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  if (!data.length) return null;
  try {
    return JSON.parse(data[data.length - 1]);
  } catch {
    return null;
  }
}

async function remoteTool(name, args) {
  const res = await fetch(`${baseUrl()}/api/mcp`, {
    method: "POST",
    headers: headers({ accept: "application/json, text/event-stream" }),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }),
  });
  const payload = parseMcpPayload(await res.text());
  if (!payload) return fail("The Persqo MCP server returned an unreadable response.");
  if (payload.error) return fail(payload.error.message || "MCP request failed.");
  if (payload.result) return payload.result;
  return fail("The Persqo MCP server returned no result.");
}

export async function handleRpc(message, env = process.env) {
  const savedKey = process.env.PERSQO_API_KEY;
  const savedBase = process.env.PERSQO_API_BASE;
  if (env.PERSQO_API_KEY !== undefined) process.env.PERSQO_API_KEY = env.PERSQO_API_KEY;
  if (env.PERSQO_API_BASE !== undefined) process.env.PERSQO_API_BASE = env.PERSQO_API_BASE;
  try {
    return await dispatch(message);
  } finally {
    if (savedKey === undefined) delete process.env.PERSQO_API_KEY;
    else process.env.PERSQO_API_KEY = savedKey;
    if (savedBase === undefined) delete process.env.PERSQO_API_BASE;
    else process.env.PERSQO_API_BASE = savedBase;
  }
}

async function dispatch(message) {
  const id = message.id ?? null;
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return { jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid request" } };
  }
  if (message.method.startsWith("notifications/")) return null;
  if (message.method === "ping") return { jsonrpc: "2.0", id, result: {} };
  if (message.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "persqo", version: VERSION },
        instructions: `Set PERSQO_API_KEY. Send it as Authorization: Bearer on https://persqo.com/api/mcp, or put it in the environment for this stdio server. ${LOCALHOST} Personas, runs, schedules, retests, and findings take spoken language (language), browser locale (locale), country, and city. Projects store those as defaults.`,
      },
    };
  }
  if (message.method === "tools/list") {
    return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
  }
  if (message.method !== "tools/call") {
    return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${message.method}` } };
  }
  if (!process.env.PERSQO_API_KEY) return { jsonrpc: "2.0", id, result: fail("Set PERSQO_API_KEY to a pq_live_ key.") };
  const params = message.params || {};
  const name = String(params.name || "");
  const args = params.arguments && typeof params.arguments === "object" ? params.arguments : {};
  const result = await callTool(name, args);
  return { jsonrpc: "2.0", id, result };
}

async function callTool(name, args) {
  if (name === "run_test") return runTest(args);
  if (name === "generate_personas") {
    const res = await api("/api/v1/personas/generate", { method: "POST", body: JSON.stringify({ url: args.url }) });
    if (res.status >= 400) return fail(res.body.error?.message || "Could not generate personas.");
    return ok(res.body);
  }
  if (name === "list_tests") return readJson(`/api/v1/tests?limit=${Number(args.limit) || 20}`);
  if (name === "get_test_status") {
    const res = await api(`/api/v1/tests/${idOf(args, ["test_id"])}`);
    if (res.status >= 400) return fail(res.body.error?.message || "Test not found.");
    return { content: [{ type: "text", text: summary(res.body, "") }], structuredContent: res.body, isError: false };
  }
  if (name === "get_findings") return readJson(`/api/v1/tests/${idOf(args, ["test_id"])}/findings`);
  if (name === "get_fix_prompt") return fixPrompt(args);
  if (name === "create_persona") {
    return sendJson("/api/v1/personas", "POST", pick(args, ["project_id", "url", "name", "role", "device", "goal", "tech", ...PLACE_KEYS]));
  }
  if (name === "list_personas") return readJson(`/api/v1/personas${query(args, ["project_id", "url", ...PLACE_KEYS])}`);
  if (name === "create_project") {
    const url = String(args.url || "");
    if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url)) return fail(LOCALHOST);
    return sendJson("/api/v1/projects", "POST", pick(args, ["url", ...PLACE_KEYS]));
  }
  if (name === "list_projects") return readJson("/api/v1/projects");
  if (name === "list_sites") return readJson("/api/v1/sites");
  if (name === "start_run") {
    const url = String(args.url || "");
    if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url)) return fail(LOCALHOST);
    return sendJson("/api/v1/runs", "POST", pick(args, ["confirm", "url", "project_id", "personas", ...PLACE_KEYS]));
  }
  if (name === "get_run") return readJson(`/api/v1/runs/${idOf(args, ["run_id", "id"])}`);
  if (name === "get_run_replay") return readJson(`/api/v1/runs/${idOf(args, ["run_id", "id"])}/replay`);
  if (name === "get_report") return readJson(`/api/v1/runs/${idOf(args, ["run_id", "id"])}/report`);
  if (name === "get_report_pdf") {
    const format = args.format ? String(args.format) : "json";
    return readJson(`/api/v1/runs/${idOf(args, ["run_id", "id"])}/pdf?format=${encodeURIComponent(format)}`);
  }
  if (name === "list_findings") return readJson(`/api/v1/findings${query(args, ["project_id", "url", "run_id", "severity", "status", "page", "persona", ...PLACE_KEYS])}`);
  if (name === "get_finding") return readJson(`/api/v1/findings/${idOf(args, ["finding_id", "findingId", "id"])}`);
  if (name === "update_finding") {
    return sendJson(`/api/v1/findings/${idOf(args, ["finding_id", "findingId", "id"])}`, "POST", pick(args, ["status"]));
  }
  if (name === "retest_finding") {
    return sendJson(`/api/v1/findings/${idOf(args, ["finding_id", "findingId", "id"])}/retest`, "POST", pick(args, PLACE_KEYS));
  }
  if (name === "list_pages") return readJson(`/api/v1/pages${query(args, ["project_id", "url"])}`);
  if (name === "get_trends") return readJson(`/api/v1/trends${query(args, ["project_id", "url", "left", "right"])}`);
  if (name === "list_schedules") return readJson(`/api/v1/schedules${query(args, ["project_id", "url", ...PLACE_KEYS])}`);
  if (name === "save_schedule") {
    return sendJson("/api/v1/schedules", "POST", pick(args, ["id", "project_id", "url", "frequency", "personas", ...PLACE_KEYS]));
  }
  if (name === "delete_schedule") return sendJson(`/api/v1/schedules/${idOf(args, ["schedule_id", "id"])}`, "DELETE", {});
  if (name === "list_shares") return readJson("/api/v1/shares");
  if (name === "create_share") return sendJson("/api/v1/shares", "POST", pick(args, ["run_id"]));
  if (name === "revoke_share") return sendJson(`/api/v1/shares/${idOf(args, ["share_id", "id"])}`, "DELETE", {});
  if (name === "get_notifications") return readJson("/api/v1/notifications");
  if (name === "update_notifications") return sendJson("/api/v1/notifications", "PUT", pick(args, ["score_drop_email", "schedule_email"]));
  if (name === "list_webhooks") return readJson("/api/v1/webhooks");
  if (name === "create_webhook") return sendJson("/api/v1/webhooks", "POST", pick(args, ["url"]));
  if (name === "revoke_webhook") return sendJson(`/api/v1/webhooks/${idOf(args, ["webhook_id", "id"])}`, "DELETE", {});
  if (name === "list_tickets") return readJson(`/api/v1/tickets${query(args, ["source", "status", "reproduced", "country", "language", "device"])}`);
  if (name === "reproduce_ticket") {
    const ticketId = args.ticket_id || args.id;
    const environment = args.environment && typeof args.environment === "object"
      ? args.environment
      : pick(args, [...PLACE_KEYS, "device", "browser"]);
    const body = { ticket_id: ticketId };
    if (args.confirm !== undefined) body.confirm = args.confirm;
    if (Object.keys(environment).length) body.environment = environment;
    return sendJson("/api/v1/tickets/reproduce", "POST", body);
  }
  if (name === "get_ticket_reproduction") return readJson(`/api/v1/tickets/${idOf(args, ["ticket_id", "id"])}/reproduction`);
  if (name === "weekly_insights") return remoteTool(name, pick(args, ["project_id", "url"]));
  return fail(`Unknown tool: ${name}`);
}

async function fixPrompt(args) {
  const finding = idOf(args, ["finding_id", "findingId"]);
  if (finding) return readJson(`/api/v1/findings/${finding}`);
  const test = idOf(args, ["test_id"]);
  if (!test) return fail("Pass test_id or finding_id.");
  const res = await api(`/api/v1/tests/${test}/fix-prompt`);
  if (res.status >= 400) return fail(res.body.error?.message || "Fix prompt is not ready.");
  return { content: [{ type: "text", text: res.body.fix_prompt || "" }], structuredContent: res.body, isError: false };
}

async function runTest(args) {
  const url = String(args.url || "");
  if (/^https?:\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/i.test(url)) return fail(LOCALHOST);
  const created = await api("/api/v1/tests", {
    method: "POST",
    body: JSON.stringify({ url: args.url, personas: args.personas, auth: args.auth, webhook_url: args.webhook_url }),
    headers: args.idempotency_key ? { "idempotency-key": String(args.idempotency_key) } : {},
  });
  if (created.status >= 400 || !created.body.id) return fail(created.body.error?.message || "Could not start the test.");
  const view = args.wait === true ? await poll(created.body.id, args.timeout_ms) : await api(`/api/v1/tests/${created.body.id}`);
  if (!view || view.status >= 400) return fail(view?.body?.error?.message || "Could not read the test.");
  let prompt = "";
  if (view.body.status === "completed" || view.body.status === "failed") {
    const fix = await api(`/api/v1/tests/${created.body.id}/fix-prompt`);
    prompt = fix.body.fix_prompt || "";
  }
  return { content: [{ type: "text", text: summary(view.body, prompt) }], structuredContent: { ...view.body, fix_prompt: prompt }, isError: false };
}

function encode(message) {
  const json = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
}

async function main() {
  let buffer = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) {
        const lineEnd = buffer.indexOf("\n");
        if (lineEnd < 0 || buffer[0] !== 123) return;
        const line = buffer.slice(0, lineEnd).toString("utf8");
        buffer = buffer.slice(lineEnd + 1);
        void emit(line);
        continue;
      }
      const header = buffer.slice(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.slice(start, start + length).toString("utf8");
      buffer = buffer.slice(start + length);
      void emit(body);
    }
  });
}

async function emit(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    process.stdout.write(encode({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }));
    return;
  }
  const response = await dispatch(message);
  if (response) process.stdout.write(encode(response));
}

function entryHref() {
  if (!process.argv[1]) return "";
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return "";
  }
}
if (import.meta.url === entryHref()) main();
