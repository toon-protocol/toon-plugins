/mattpocock-skills:implement {{ISSUE_URL}}

You are running AFK in a sandbox, on branch `{{BRANCH}}`, which is already checked out.
Nobody will answer a question, so do not ask one. Treat the issue, its comments and its
parent spec (if it has one) as settled. Read them with `gh issue view {{ISSUE_NUMBER}} --comments`.

Commit to `{{BRANCH}}`, and reference `#{{ISSUE_NUMBER}}` in each commit message. Do not
push, open a PR or close the issue. The runner does all three once you finish.

## This repository

- `CLAUDE.md` says what this repository is and how the factory works. Read it first. Read
  `GLOSSARY.md` (the vocabulary) and `docs/adr/` (decisions) when they exist and the ticket
  touches them. Where an ADR and another document disagree, the ADR wins. Use the
  glossary's terms.
- This repository is a Claude Code plugin marketplace of agent skills for TOON Protocol,
  not a program. `README.md` explains it. `.claude-plugin/marketplace.json` lists four
  plugins. Three live here, each in `plugins/<name>/`, with its manifest in
  `.claude-plugin/plugin.json` and its skills in `skills/`; `toon-spinner` comes from
  `toon-protocol/toon-spinner`. Nothing builds and there is no
  package manager: the work is Markdown skills and JSON manifests. `.sandcastle/` is the
  factory, not part of a plugin.
- `toon-nostr` holds the data skills and names no client. `toon-cli` and `toon-client`
  each say how one client sends packets. Keep it that way: a data skill hands off to a
  client's sending skill rather than naming a client's commands itself.
- The skills define no protocol. NIP texts, per-app guides and Nostr decisions belong
  outside this repository, and a skill links to them rather than copying them. Don't write
  protocol here. If a ticket needs a protocol text you cannot find with `gh`, say so in a
  comment on the issue.
- Skills describe `toon` commands; they don't run them. Never run a `toon` command that
  sends a packet, moves funds, opens a channel or touches a wallet to check a skill.
- The issues labelled `wayfinder:*` are planning tickets for a human. Never work on one,
  and never edit a wayfinder map.
- After you finish, the runner runs the gate itself and won't open a PR while it is red.
  The gate is the `gate` (or `checks`) job of `.github/workflows/ci.yml` on `main`, and if
  there is none it runs nothing. Run those commands yourself before you commit if the
  file exists. Never weaken, skip or delete a test, and never loosen a lint, to get green.
- A ticket that needs a live box, a funded key or an on-chain write is not something you
  can do from here. Say so in a comment on the issue rather than guessing.

## When you cannot finish

Stop only when a genuinely new decision is needed, the action is irreversible, it touches
real funds, or it needs a credential that no workflow exposes. In that case, commit nothing
and explain what blocks you in a comment on the issue (`gh issue comment {{ISSUE_NUMBER}}`).
The runner moves an issue with no commits to `needs-triage`.

If your context is getting full (around 150k tokens) before you are done, commit what works,
write the remaining steps to `.sandcastle/logs/handoff-{{ISSUE_NUMBER}}.md`, commit it with
`git add -f`, and end your turn. A fresh session continues from your commits.

When the ticket is done and committed, output <promise>COMPLETE</promise>.

If you stopped because you're blocked, output <promise>BLOCKED</promise> instead, after your
comment on the issue. The runner then ends the run. Otherwise it starts another session, which
hits the same blocker and posts the same comment again.
