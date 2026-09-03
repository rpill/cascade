# Cascade Solitaire — context handoff

This static file is intentionally no longer the project context bundle.

Use the generated handoff workflow instead:

```bash
pnpm context
```

for the current working tree, or:

```bash
pnpm context:last
```

for the latest committed checkpoint.

Send the newest file from `_chatgpt_bundle/CHATGPT_CONTEXT(YYYYMMDD-HHMMSS).txt`
to a fresh ChatGPT conversation. Stable/current project truth lives in
`PROJECT.md`, `CURRENT_STATE.md`, `TECH.md`, and generated `TREE.txt`.
