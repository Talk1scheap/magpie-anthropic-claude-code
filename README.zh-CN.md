# Anthropic (Claude Code) · magpie 插件

给 **Anthropic Messages 兼容** 的自定义供应商用的 magpie / OpenCode 插件。

有些上游只认官方 Claude Code（Claude CLI）客户端，会拒绝 `User-Agent: magpie/…` 的请求。打开本插件供应商编辑页里的 **「以 Claude Code 身份发送」** 后，发往上游的请求会带上与 Claude Code 一致的客户端头（`User-Agent`、`x-app`、`anthropic-*`、`x-stainless-*` 等），行为对齐 magpie 对 Claude Code → key+URL 中继的透传逻辑。

> **不会**把流量送进 magpie 自带的 Claude.ai 订阅桥（不会起本机 `claude`、也不会用你的 Claude 订阅额度）。只是让**你配置的 Base URL** 看到 Claude Code 客户端指纹。

## 安装

```bash
magpie plugin add github:Talk1scheap/magpie-anthropic-claude-code
# 或本地文件夹
magpie plugin add /path/to/magpie-anthropic-claude-code
```

应用里：设置 → 插件 → 添加插件，填仓库或路径。

## 登录

```bash
magpie plugin login anthropic-cc
```

按提示填写：

1. **API key** — 供应商给你的密钥  
2. **Base URL** — Anthropic 兼容地址，带不带 `/v1` 都可以（插件会规范成 `…/v1`）  
3. **模型列表**（可选）— 逗号分隔；留空则尝试 `GET /v1/models`，失败则用内置 Claude 列表  

## 开关

供应商编辑页 → **插件选项** → **以 Claude Code 身份发送**（默认开）。

| 状态 | 行为 |
| --- | --- |
| 开 | 覆盖为 Claude Code 客户端头，`/messages` 请求带 `?beta=true` |
| 关 | 不伪装，按普通插件请求发出 |

改完后点保存即可，无需重装插件。

## 模型用法

Agent 里选用：`anthropic-cc/<模型 id>`，例如 `anthropic-cc/claude-sonnet-4-5`。

## 自测

```bash
node --test index.test.mjs
```

在沙箱里接 magpie（不会碰到你正在用的配置）：

```bash
sb=$(mktemp -d)
m() { env HOME=$sb XDG_CONFIG_HOME=$sb/.config XDG_CACHE_HOME=$sb/.cache MAGPIE_ADDR=127.0.0.1:3499 magpie "$@"; }
m plugin add ./magpie-anthropic-claude-code </dev/null
m plugin --json
m plugin login anthropic-cc
m provider test anthropic-cc
```

## 说明

- 供应商 id：`anthropic-cc`（避免和内置 `anthropic` / `claude` 冲突）  
- 协议：`@ai-sdk/anthropic`（Messages）  
- 伪装头参考 magpie `internal/gateway/claude_code_headers_test.go`  
- `anthropic-beta` 会合并 Claude Code 默认 beta 与 agent 带来的 beta；不会带上 `oauth-2025-04-20`

## License

MIT
