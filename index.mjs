// Anthropic Messages relay for magpie.
// When the provider option "as-claude-code" is on, outbound requests carry
// Claude Code's client headers (the same set magpie forwards for Claude Code
// to a key+URL Anthropic relay — see yetone/magpie internal/gateway/claude_code_headers_test.go).
// This does NOT route through magpie's Claude.ai subscription bridge; it only
// makes the custom vendor see a Claude Code client.

const PROVIDER = "anthropic-cc"
const DEFAULT_UA = "claude-cli/2.1.310 (external, cli)"
const DEFAULT_BETAS = "claude-code-20250219,interleaved-thinking-2025-05-14"

const DEFAULT_MODELS = {
  "claude-opus-4-5": {
    name: "Claude Opus 4.5",
    limit: { context: 200000, output: 64000 },
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"] },
    variants: { low: {}, medium: {}, high: {}, max: {} },
  },
  "claude-sonnet-4-5": {
    name: "Claude Sonnet 4.5",
    limit: { context: 200000, output: 64000 },
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"] },
    variants: { low: {}, medium: {}, high: {}, max: {} },
  },
  "claude-haiku-4-5": {
    name: "Claude Haiku 4.5",
    limit: { context: 200000, output: 64000 },
    reasoning: true,
    tool_call: true,
    modalities: { input: ["text", "image"] },
    variants: { low: {}, medium: {}, high: {} },
  },
}

/** Strip trailing slash; ensure a /v1 suffix (magpie joins base + /messages). */
function normalizeBaseURL(raw) {
  let u = String(raw ?? "").trim()
  if (!u) return ""
  u = u.replace(/\/+$/, "")
  if (!/\/v1$/i.test(u)) u += "/v1"
  return u
}

/** Headers Claude Code sends that relays fingerprint on. Never includes credentials. */
function claudeCodeHeaders({
  userAgent = DEFAULT_UA,
  betas = DEFAULT_BETAS,
  sessionId,
} = {}) {
  const h = {
    "User-Agent": userAgent,
    "x-app": "cli",
    "anthropic-version": "2023-06-01",
    "anthropic-beta": betas,
    "anthropic-dangerous-direct-browser-access": "true",
    "x-stainless-lang": "js",
    "x-stainless-package-version": "0.60.0",
    "x-stainless-retry-count": "0",
    "x-stainless-runtime": "node",
    "x-stainless-runtime-version": "v22.0.0",
    "x-stainless-timeout": "600",
  }
  if (sessionId) h["x-claude-code-session-id"] = String(sessionId)
  return h
}

/**
 * Apply Claude Code client headers onto an existing Headers object.
 * Leaves Authorization / x-api-key alone (set by apiKey / earlier steps).
 * Merges anthropic-beta: Claude Code betas first, then any agent betas not already listed.
 */
function headerGet(headers, name) {
  if (!headers) return ""
  if (typeof headers.get === "function") return headers.get(name) || headers.get(name.toLowerCase()) || ""
  const lower = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (String(k).toLowerCase() === lower) return v == null ? "" : String(v)
  }
  return ""
}

function headerSet(headers, name, value) {
  if (typeof headers.set === "function") {
    headers.set(name, value)
    return
  }
  headers[name] = value
}

function toHeaders(init) {
  const h = new Headers()
  if (!init) return h
  if (typeof init.forEach === "function") {
    init.forEach((v, k) => h.set(k, v))
    return h
  }
  if (Array.isArray(init)) {
    for (const pair of init) {
      if (pair && pair.length >= 2) h.set(pair[0], pair[1])
    }
    return h
  }
  if (typeof init === "object") {
    for (const [k, v] of Object.entries(init)) {
      if (v != null) h.set(k, String(v))
    }
  }
  return h
}

/** Apply Claude Code client headers. Accepts Headers or a plain object. */
function applyClaudeCodeHeaders(headers, opts = {}) {
  const shaped = claudeCodeHeaders(opts)
  const existingBeta = headerGet(headers, "anthropic-beta")
  for (const [k, v] of Object.entries(shaped)) {
    if (k === "anthropic-beta") continue
    headerSet(headers, k, v)
  }
  const parts = new Set()
  for (const p of String(shaped["anthropic-beta"]).split(",")) {
    const t = p.trim()
    if (t) parts.add(t)
  }
  for (const p of existingBeta.split(",")) {
    const t = p.trim()
    // Never forward the oauth beta; Claude Code's own sign-in never does on a key relay.
    if (t && t !== "oauth-2025-04-20") parts.add(t)
  }
  headerSet(headers, "anthropic-beta", [...parts].join(","))
  return headers
}

function modelsFromList(list, base) {
  const out = {}
  for (const id of list) {
    const key = String(id).trim()
    if (!key) continue
    out[key] = { ...(base[key] ?? { name: key, limit: { context: 200000, output: 64000 }, tool_call: true }) }
  }
  return out
}

function parseModelList(raw) {
  if (!raw || typeof raw !== "string") return null
  const ids = raw.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
  return ids.length ? ids : null
}

const AnthropicClaudeCodePlugin = async (input) => {
  const optionOn = (key) => {
    try {
      return input?.magpie?.option?.(PROVIDER, key) === true
    } catch {
      return false
    }
  }

  return {
    config: async (cfg) => {
      cfg.provider ??= {}
      cfg.provider[PROVIDER] ??= {
        name: "Anthropic (Claude Code)",
        npm: "@ai-sdk/anthropic",
        api: "https://api.anthropic.com/v1",
        models: { ...DEFAULT_MODELS },
      }
    },

    provider: {
      id: PROVIDER,
      async models(provider, { auth } = {}) {
        const listed = parseModelList(auth?.metadata?.models)
        if (listed) return modelsFromList(listed, { ...DEFAULT_MODELS, ...provider.models })

        const base = normalizeBaseURL(auth?.metadata?.baseURL || provider.api)
        const key = auth?.key
        if (!base || !key) return provider.models

        try {
          const res = await fetch(`${base}/models`, {
            headers: {
              "x-api-key": key,
              authorization: `Bearer ${key}`,
              "anthropic-version": "2023-06-01",
              accept: "application/json",
            },
          })
          if (!res.ok) return provider.models
          const data = await res.json()
          const rows = Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
          if (!rows.length) return provider.models
          const out = {}
          for (const m of rows) {
            const id = m.id || m.name
            if (!id) continue
            const prev = provider.models[id] || DEFAULT_MODELS[id] || {}
            out[id] = {
              ...prev,
              id,
              name: m.display_name || m.name || id,
              limit: prev.limit || { context: 200000, output: 64000 },
              tool_call: prev.tool_call !== false,
            }
          }
          return Object.keys(out).length ? out : provider.models
        } catch {
          return provider.models
        }
      },
    },

    auth: {
      provider: PROVIDER,
      options: [
        {
          key: "as-claude-code",
          label: "以 Claude Code 身份发送",
          description:
            "打开后，发往上游的 Anthropic 请求带上 Claude Code 的客户端头（User-Agent / x-app / anthropic-* / x-stainless-*）。供应商只接受官方 Claude CLI 时请打开。不会走 magpie 的 Claude.ai 订阅桥。",
          default: true,
        },
      ],
      methods: [
        {
          type: "api",
          label: "API key",
          placeholder: "sk-… 或供应商给你的 key",
          prompts: [
            {
              type: "text",
              key: "baseURL",
              message: "Base URL（Anthropic 兼容，含或不含 /v1 都行）",
              placeholder: "https://api.example.com/v1",
              validate: (v) => {
                const u = String(v ?? "").trim()
                if (!u) return "需要 Base URL"
                try {
                  const parsed = new URL(u.includes("://") ? u : `https://${u}`)
                  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "只支持 http(s)"
                } catch {
                  return "URL 格式不对"
                }
                return undefined
              },
            },
            {
              type: "text",
              key: "models",
              message: "模型 id 列表（可选，逗号分隔；留空则尝试拉取 /v1/models，再不行用内置 Claude 列表）",
              placeholder: "claude-sonnet-4-5,claude-opus-4-5",
            },
          ],
        },
      ],
      async loader(getAuth) {
        const auth = await getAuth()
        if (auth?.type !== "api" || !auth.key) return {}
        const baseURL = normalizeBaseURL(auth.metadata?.baseURL)
        if (!baseURL) return {}

        return {
          baseURL,
          apiKey: auth.key,
          async fetch(inputURL, init) {
            const headers = toHeaders(init?.headers)
            // Prefer x-api-key for Anthropic; keep Bearer if already set by host.
            if (!headers.has("x-api-key") && !headers.has("X-Api-Key")) {
              headers.set("x-api-key", auth.key)
            }
            if (optionOn("as-claude-code")) {
              applyClaudeCodeHeaders(headers)
              // Ensure beta query matches Claude Code when the path is messages.
              let url = typeof inputURL === "string" ? inputURL : String(inputURL)
              try {
                const u = new URL(url)
                if (u.pathname.endsWith("/messages") && !u.searchParams.has("beta")) {
                  u.searchParams.set("beta", "true")
                  url = u.toString()
                }
                return fetch(url, { ...init, headers })
              } catch {
                return fetch(inputURL, { ...init, headers })
              }
            }
            return fetch(inputURL, { ...init, headers })
          },
        }
      },
    },
  }
}

export const _internal = {
  PROVIDER,
  DEFAULT_UA,
  DEFAULT_BETAS,
  DEFAULT_MODELS,
  normalizeBaseURL,
  claudeCodeHeaders,
  applyClaudeCodeHeaders,
}

export default AnthropicClaudeCodePlugin
