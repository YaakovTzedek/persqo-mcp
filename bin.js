#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const TOOL_NAMES = ["generate_personas", "get_findings", "get_fix_prompt", "get_test_status", "list_tests", "run_test"];

const LOCALHOST = "Persqo's browser runs in the cloud and cannot open localhost. Deploy a preview (Vercel or Netlify) or tunnel your machine with ngrok or cloudflared, then pass that https URL.";

const TOOLS = [
  {
    name: "run_test",
    description: `Start persona testers against a public https URL. wait true polls until the test finishes and returns a summary plus the fix prompt. ${LOCALHOST}`,
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["url"],
      properties: {
        url: { type: "string" },
        personas: {},
        auth: { type: "object" },
        wait: { type: "boolean" },
        timeout_ms: { type: "integer" },
        idempotency_key: { type: "string" },
        webhook_url: { type: "string" },
      },
    },
  },
  { name: "get_test_status", description: "Read status, personas, findings, cost, and the report URL.", inputSchema: { type: "object", additionalProperties: false, required: ["test_id"], properties: { test_id: { type: "string" } } } },
  { name: "get_findings", description: "Findings with severity, screenshots, and fix_prompt.", inputSchema: { type: "object", additionalProperties: false, required: ["test_id"], properties: { test_id: { type: "string" } } } },
  { name: "get_fix_prompt", description: "One combined fix prompt for a finished test.", inputSchema: { type: "object", additionalProperties: false, required: ["test_id"], properties: { test_id: { type: "string" } } } },
  { name: "generate_personas", description: "Suggest personas for a URL. Does not spend a session.", inputSchema: { type: "object", additionalProperties: false, required: ["url"], properties: { url: { type: "string" } } } },
  { name: "list_tests", description: "List recent tests.", inputSchema: { type: "object", additionalProperties: false, properties: { limit: { type: "integer" } } } },
];

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
        serverInfo: { name: "persqo", version: "0.1.0" },
        instructions: `Set PERSQO_API_KEY. ${LOCALHOST} run_test with wait true returns a summary and a fix prompt.`,
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
  if (name === "run_test") {
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
  if (name === "generate_personas") {
    const res = await api("/api/v1/personas/generate", { method: "POST", body: JSON.stringify({ url: args.url }) });
    if (res.status >= 400) return fail(res.body.error?.message || "Could not generate personas.");
    return { content: [{ type: "text", text: JSON.stringify(res.body.personas, null, 2) }], structuredContent: res.body, isError: false };
  }
  if (name === "list_tests") {
    const res = await api(`/api/v1/tests?limit=${Number(args.limit) || 20}`);
    if (res.status >= 400) return fail(res.body.error?.message || "Could not list tests.");
    const text = (res.body.tests || []).map((test) => `${test.id} ${test.status} ${test.url}`).join("\n") || "No tests yet.";
    return { content: [{ type: "text", text }], structuredContent: res.body, isError: false };
  }
  const id = encodeURIComponent(String(args.test_id || ""));
  if (name === "get_test_status") {
    const res = await api(`/api/v1/tests/${id}`);
    if (res.status >= 400) return fail(res.body.error?.message || "Test not found.");
    return { content: [{ type: "text", text: summary(res.body, "") }], structuredContent: res.body, isError: false };
  }
  if (name === "get_findings") {
    const res = await api(`/api/v1/tests/${id}/findings`);
    if (res.status >= 400) return fail(res.body.error?.message || "Test not found.");
    return { content: [{ type: "text", text: JSON.stringify(res.body.findings, null, 2) }], structuredContent: res.body, isError: false };
  }
  if (name === "get_fix_prompt") {
    const res = await api(`/api/v1/tests/${id}/fix-prompt`);
    if (res.status >= 400) return fail(res.body.error?.message || "Fix prompt is not ready.");
    return { content: [{ type: "text", text: res.body.fix_prompt || "" }], structuredContent: res.body, isError: false };
  }
  return fail(`Unknown tool: ${name}`);
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

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === entry) main();


