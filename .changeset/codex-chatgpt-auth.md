---
"@ai-hero/sandcastle": patch
---

Add ChatGPT subscription auth for Codex agent. Users can now authenticate via `codex login` instead of an API key by passing `{ provider: "chatgpt" }` to the `codex()` factory. `sandcastle init` prompts for the auth type when Codex is selected.
