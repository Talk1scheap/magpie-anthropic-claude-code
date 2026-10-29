# Anthropic (Claude Code) · magpie plugin

[中文说明](./README.zh-CN.md)

A magpie / OpenCode **provider plugin** for Anthropic Messages–compatible relays.

Some vendors only accept the official Claude Code (Claude CLI) client and reject `User-Agent: magpie/…`. Turn on **Send as Claude Code** under *Plugin options* on this provider’s editor; outbound requests then carry Claude Code’s client headers (`User-Agent`, `x-app`, `anthropic-*`, `x-stainless-*`, …), matching what magpie already forwards when Claude Code talks to a key+URL Anthropic relay.

> This does **not** send traffic through magpie’s Claude.ai subscription bridge (no local `claude` process, no Claude subscription quota). It only makes **your configured Base URL** see a Claude Code client fingerprint.

## Install

```bash
magpie plugin add github:Talk1scheap/magpie-anthropic-claude-code
# or a local folder
magpie plugin add /path/to/magpie-anthropic-claude-code
```

## Sign in

```bash
magpie plugin login anthropic-cc
```

You will be asked for:

1. **API key**
2. **Base URL** (with or without `/v1`; normalized to `…/v1`)
3. **Model ids** (optional; otherwise `GET /v1/models`, then built-in Claude defaults)

## Switch

Provider editor → **Plugin options** → **以 Claude Code 身份发送** / Send as Claude Code (default on).

## Models

Use `anthropic-cc/<model-id>` in agents, e.g. `anthropic-cc/claude-sonnet-4-5`.

## Tests

```bash
node --test index.test.mjs
```

## License

MIT
