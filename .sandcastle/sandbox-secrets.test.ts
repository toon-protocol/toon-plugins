import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sandboxSecrets } from './sandbox-secrets.ts';

test("the sandbox gets the issues-only token as GH_TOKEN, never the host's own", () => {
  const env = sandboxSecrets({
    GITHUB_ACTIONS: 'true',
    CLAUDE_CODE_OAUTH_TOKEN: 'claude-credential',
    GH_TOKEN: 'ghs_host_token_that_can_push',
    SANDBOX_GH_TOKEN: 'ghs_issues_only',
    APP_ID: '1',
    APP_PRIVATE_KEY: 'key',
  });

  assert.deepEqual(env, {
    CLAUDE_CODE_OAUTH_TOKEN: 'claude-credential',
    GH_TOKEN: 'ghs_issues_only',
  });
});

test('on Actions, a run with no issues-only token does not start', () => {
  assert.throws(
    () =>
      sandboxSecrets({
        GITHUB_ACTIONS: 'true',
        CLAUDE_CODE_OAUTH_TOKEN: 'claude-credential',
        GH_TOKEN: 'ghs_host_token_that_can_push',
      }),
    /SANDBOX_GH_TOKEN is not set/
  );
});

test("off Actions, GH_TOKEN is left to .sandcastle/.env and the host's is still not forwarded", () => {
  const env = sandboxSecrets({
    CLAUDE_CODE_OAUTH_TOKEN: 'claude-credential',
    GH_TOKEN: 'ghp_developer_token',
  });

  assert.deepEqual(env, { CLAUDE_CODE_OAUTH_TOKEN: 'claude-credential' });
});
