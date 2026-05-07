---
description: Persist this session's context — project changelog, per-project memory, ai-mastery second brain
---

You are saving the durable context of this session for the **lifestarr-integration** project. Run the steps below in order; do as much in parallel as is safe.

## Step 1 — Capture session signal (read-only)

1. Run `git log --oneline -20` in `C:\dev\lifestarr-integration` to see recent commits.
2. Read the last 5 lines of any plan file at `C:\Users\georg\.claude\plans\*.md` so you know what task was being worked.
3. Briefly identify the **top 3-5 things** about this session worth remembering — code changes, gotchas, user-confirmed decisions, third-party quirks discovered, etc. These are your "what's worth saving" candidates.

## Step 2 — Project CHANGELOG

Path: `C:\dev\lifestarr-integration\CHANGELOG.md`

- If the file doesn't exist, create it with this header:
  ```md
  # LifeStarr Integration Hub — Changelog

  Session-level notes on what changed and why. Code-level detail is in
  `git log`; this file is the human narrative.
  ```
- Append a new section dated today (YYYY-MM-DD). If today's section already exists, append to it.
- Under today's date, write 2–6 bullets summarizing the session. Reference commit short SHAs where useful (`abc1234`).
- Tone: concise, focused on **what changed and why**, not blow-by-blow.

## Step 3 — Per-project memory

Path: `C:\Users\georg\.claude\projects\C--dev-lifestarr-integration\memory\`

For each item in your "worth saving" list from Step 1, decide:

- Is there an existing memory file (`{name}.md`) about this topic? If so, update it.
- Otherwise, create a new one with the appropriate type (`project`, `feedback`, `reference`, `user`).

Use the standard frontmatter:

```md
---
name: {short title}
description: {one-line hook for future-you}
type: {project|feedback|reference|user}
---

{content}
```

Then update `MEMORY.md` (the index) with a one-line bullet for each new file: `- [Title](file.md) — one-line hook`.

**Do not save** anything that's already obvious from the code, git log, or existing docs. The bar is "non-obvious context that would help a future Claude session."

## Step 4 — ai-mastery second brain

Path: `C:\dev\ai-mastery\`

- If `wiki/projects/lifestarr-integration.md` exists, update the "Status" / "Latest" section with one or two lines summarizing today's session and a link back to the project CHANGELOG.
- If it doesn't exist, drop a stub at `intake/lifestarr-integration-status-{YYYY-MM-DD}.md` with a paragraph summary — the wiki-builder can promote it later.
- Append today's journal entry at `journal/{YYYY-MM}/{DD-{day-of-week}}.md` if not already present, mentioning lifestarr-integration session highlights.

## Step 5 — Anything else worth preserving

- If the active plan file at `C:\Users\georg\.claude\plans\*.md` represents a finished, reusable recipe (e.g. "how to backfill from a Mighty CSV"), copy it to `C:\dev\lifestarr-integration\docs\playbooks\{slug}.md` so future Claude sessions can recall the approach.
- If today's session produced a notable doc in `docs/` (audit, report, runbook), add a one-line link to the project's `README.md` "Documentation" section if not already there.

## Step 6 — Report back

Summarize what got saved, in this exact format:

```
✅ CHANGELOG.md     → 1 new section dated YYYY-MM-DD, N bullets
✅ project memory   → N new files / N updated, MEMORY.md index refreshed
✅ ai-mastery       → wiki/journal touched (or intake stub created)
✅ playbook         → [slug] (or "none — session was ad-hoc")
```

Keep the report short and scannable — under 200 words including the checkmarks.

## Guardrails

- **Do not commit anything to git** — saving is local-only by default. The user can commit the CHANGELOG / docs separately if they want.
- **Do not create files for trivial sessions** (e.g. session was just "what's the deploy URL?"). If nothing was substantive, write a 1-line CHANGELOG entry and skip the rest.
- **Do not duplicate** — if the same fact already lives in another memory file or doc, update that file instead of creating a parallel one.
