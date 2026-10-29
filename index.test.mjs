import { test } from "node:test"
import assert from "node:assert/strict"
import {
  normalizeBaseURL,
  claudeCodeHeaders,
  applyClaudeCodeHeaders,
  _internal,
} from "./index.mjs"

test("normalizeBaseURL adds /v1 and strips trailing slash", () => {
  assert.equal(normalizeBaseURL("https://api.example.com"), "https://api.example.com/v1")
  assert.equal(normalizeBaseURL("https://api.example.com/"), "https://api.example.com/v1")
  assert.equal(normalizeBaseURL("https://api.example.com/v1"), "https://api.example.com/v1")
  assert.equal(normalizeBaseURL("https://api.example.com/v1/"), "https://api.example.com/v1")
  assert.equal(normalizeBaseURL("  "), "")
})

test("claudeCodeHeaders looks like Claude Code", () => {
  const h = claudeCodeHeaders()
  assert.equal(h["User-Agent"], _internal.DEFAULT_UA)
  assert.equal(h["x-app"], "cli")
  assert.match(h["anthropic-beta"], /claude-code-20250219/)
  assert.equal(h["x-stainless-lang"], "js")
  assert.ok(!("authorization" in h))
  assert.ok(!("x-api-key" in h))
})

test("applyClaudeCodeHeaders merges betas and keeps credentials", () => {
  const headers = new Headers({
    "x-api-key": "sk-test",
    "anthropic-beta": "context-1m-2025-08-07,oauth-2025-04-20",
  })
  applyClaudeCodeHeaders(headers)
  assert.equal(headers.get("x-api-key"), "sk-test")
  assert.equal(headers.get("User-Agent"), _internal.DEFAULT_UA)
  assert.equal(headers.get("x-app"), "cli")
  const beta = headers.get("anthropic-beta")
  assert.match(beta, /claude-code-20250219/)
  assert.match(beta, /context-1m-2025-08-07/)
  assert.doesNotMatch(beta, /oauth-2025-04-20/)
})
