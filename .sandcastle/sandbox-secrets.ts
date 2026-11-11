// Forward host secrets INTO the sandcastle Docker sandbox.
//
// WHY THIS EXISTS — root cause of the first-run failure seen in toon-protocol/relay#68
// -------------------------------------------------------------
// The `agent:implement` runner reached the sandbox, but claude-code inside it
// died with `Not logged in · Please run /login`, even though the workflow step
// exported CLAUDE_CODE_OAUTH_TOKEN (and GH_TOKEN) into the runner's env.
//
// The reason: @ai-hero/sandcastle@0.12.0's env resolver does NOT blanket-pass
// `process.env` into the container. It only forwards a variable whose KEY also
// appears in `.sandcastle/.env` (see `resolveEnv` in the engine's dist/index.js):
//
//     const sandcastleEnv = parseEnvFile(".sandcastle/.env");   // missing -> {}
//     for (const key of Object.keys(sandcastleEnv))             // keys from the FILE
//       result[key] = sandcastleEnv[key] || process.env[key];
//
// `.sandcastle/.env` is gitignored (only `.env.example` is committed), so in CI
// the file does not exist -> `parseEnvFile` returns {} -> the loop never runs ->
// the resolved env is {} -> NEITHER token is passed to `docker run`. The
// container therefore starts with no credentials and claude-code is unauthed.
//
// THE FIX
// -------
// Pass the secrets through the sandbox PROVIDER's first-class `env` option
// (`docker({ env })`), which the README documents as "Environment variables to
// inject into the sandbox" and merges via `mergeProviderEnv`. `createSandbox`
// bakes `sandboxProviderEnv` into the `docker run -e KEY=VALUE` flags at
// container start (`startContainer` in dist/sandboxes -> chunk-CP3TYXZA.js:
// `Object.entries(env).flatMap(([k, v]) => ["-e", `${k}=${v}`])`). Every
// in-container exec then inherits them: claude-code (CLAUDE_CODE_OAUTH_TOKEN)
// AND the agent's in-sandbox `gh issue view` / `gh issue comment` (GH_TOKEN).
//
// NOTE: a key is included ONLY when it is actually set on the host. This keeps
// local dev working — there the tokens come from `.sandcastle/.env` (resolved
// separately) and we must not clobber those with an `undefined` override, since
// `mergeProviderEnv` layers sandbox-provider env OVER the resolved `.env` values.

// WHICH GITHUB TOKEN THE SANDBOX GETS
// -----------------------------------
// The agents work from an issue and its comments, and anyone can write those. So
// the container's GH_TOKEN is NOT the host's. The host's token can push and open
// PRs; the container gets a separate one that can only read and write issues
// (SANDBOX_GH_TOKEN, minted by agent-implement.yml with `issues: write` alone).
// That is all an agent uses `gh` for: the prompts tell it to read the issue and
// to comment on it, and not to push or open a PR. The runner does every push
// itself, with a token it mints and stages for the length of one `git push`
// (pushBranch in agent-implement-issue.ts).
//
// DELIBERATELY ABSENT: any wallet mnemonic or funded key. The tests here need none, and
// this repository is public. Do not add one without re-reading the redaction step in
// agent-implement.yml first.
//
// APP_PRIVATE_KEY is absent for the same class of reason: it stays on the host
// so the runner can mint a fresh push credential without the container ever
// holding the key (toon-protocol/connector#462).

/**
 * The secrets to inject into the sandbox, as a `Record<string, string>` suitable
 * for `docker({ env })`:
 *
 *   CLAUDE_CODE_OAUTH_TOKEN  the host's, when set. Authenticates claude-code.
 *   GH_TOKEN                 the host's SANDBOX_GH_TOKEN, when set. Never the
 *                            host's own GH_TOKEN.
 *
 * An unset variable is omitted (never emitted as `KEY=undefined`) so the local
 * `.sandcastle/.env` path is not overridden with empties. On Actions there is
 * no `.sandcastle/.env`, so a missing SANDBOX_GH_TOKEN throws: the run must not
 * start with no token, and must never fall back to the one that can push.
 */
export function sandboxSecrets(
  host: Record<string, string | undefined> = process.env
): Record<string, string> {
  const env: Record<string, string> = {};
  if (host.CLAUDE_CODE_OAUTH_TOKEN) env.CLAUDE_CODE_OAUTH_TOKEN = host.CLAUDE_CODE_OAUTH_TOKEN;
  if (host.SANDBOX_GH_TOKEN) {
    env.GH_TOKEN = host.SANDBOX_GH_TOKEN;
  } else if (host.GITHUB_ACTIONS === 'true') {
    throw new Error(
      'SANDBOX_GH_TOKEN is not set. The sandbox needs its own issues-only token ' +
        '(see agent-implement.yml); the runner will not forward its own GH_TOKEN.'
    );
  }
  return env;
}
