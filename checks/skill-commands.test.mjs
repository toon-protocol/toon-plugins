import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkRepo, clientEnv, CLIENTS, lockedClient, lowestVersion, namedCommands, pinnedSha256 } from './skill-commands.mjs';

/** A repository holding `files` (path → text), as a directory. */
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'skill-commands-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

/** A SKILL.md whose frontmatter states `range` under `rangeKey`. */
const skill = (rangeKey, range, body = '# Sending') =>
  `---\nname: sending\n${rangeKey}: "${range}"\n---\n\n${body}\n`;
const sendingWithToonCli = (body) => skill('toon_cli', '>=0.3, <0.4', body);
const sendingWithToonClient = (body) => skill('toon-client', '>=5.0.0, <6', body);

/** A fake binary that has only `commands` (each `binary@version path`), recording each call. */
function binaries(...commands) {
  const calls = [];
  const runHelp = async (binary, version, path) => {
    const command = `${binary}@${version} ${path.join(' ')}`.trim();
    calls.push(command);
    return commands.includes(command)
      ? { exitCode: 0, stderr: '' }
      : { exitCode: 2, stderr: `error: unrecognized subcommand` };
  };
  return { runHelp, calls };
}

test('collects inline code spans and code-block lines that start with the binary', () => {
  const text = [
    'Run `toon event publish --kind 1` to post, or `toon --version` first.',
    'This is `toon` alone, and `toon-client send g.toon.relay` is another binary.',
    '',
    '```',
    '  toon channel open <peer> --deposit 10',
    'toonish line',
    '```',
  ].join('\n');

  assert.deepEqual(namedCommands(text, 'toon'), [['event', 'publish'], [], ['channel', 'open']]);
  assert.deepEqual(namedCommands(text, 'toon-client'), [['send']]);
});

test('reads the lowest version of a range from a skill\'s frontmatter', () => {
  assert.equal(lowestVersion(skill('toon_cli', '>=0.3, <0.4'), 'toon_cli'), '0.3.0');
  assert.equal(lowestVersion(skill('toon-client', '>=5.0.2, <6'), 'toon-client'), '5.0.2');
  assert.throws(() => lowestVersion(skill('toon_cli', '<0.4'), 'toon_cli'), /no lower bound/);
  assert.throws(() => lowestVersion(skill('toon_cli', '>=0.3'), 'toon-client'), /no `toon-client` key/);
});

test('a toon-cli skill naming a command the lowest toon_cli lacks fails', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli(
      'Run `toon --version`, then `toon event publish --kind 1`.',
    ),
    'plugins/toon-cli/skills/operating-an-agent-node/references/peering.md':
      '```\ntoon frobnicate <peer>\n```',
  });
  const { runHelp, calls } = binaries('toon@0.3.0', 'toon@0.3.0 event publish');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(calls.sort(), ['toon@0.3.0', 'toon@0.3.0 event publish', 'toon@0.3.0 frobnicate']);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /operating-an-agent-node\/references\/peering\.md/);
  assert.match(problems[0], /`toon frobnicate` is not a command of toon 0\.3\.0/);
  assert.match(problems[0], /unrecognized subcommand/);
});

test('a toon-nostr skill naming any client command fails, whether or not the command exists', async () => {
  const root = repo({
    'plugins/toon-cli/skills/sending-with-toon-cli/SKILL.md': sendingWithToonCli('`toon --version`'),
    'plugins/toon-nostr/skills/social/SKILL.md': 'Post with `toon event publish`.',
    'plugins/toon-nostr/skills/social/references/nip-25.md': '```\ntoon-client send g.toon.relay\n```',
  });
  const { runHelp } = binaries('toon@0.3.0', 'toon@0.3.0 event publish', 'toon-client@5.0.0 send');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(problems, [
    'plugins/toon-nostr/skills/social/SKILL.md: names `toon event publish`, but only toon-cli skills may name `toon` commands',
    'plugins/toon-nostr/skills/social/references/nip-25.md: names `toon-client send`, but only toon-client skills may name `toon-client` commands',
  ]);
});

test('a toon-client skill naming an unknown toon-client command, or a bare toon one, fails', async () => {
  const root = repo({
    'plugins/toon-client/skills/sending-with-toon-client/SKILL.md': sendingWithToonClient(
      'Run `toon-client --version`, then `toon-client frobnicate`, not `toon send` or `toon`.',
    ),
  });
  const { runHelp, calls } = binaries('toon-client@5.0.0');

  const problems = await checkRepo(root, runHelp);

  assert.deepEqual(calls.sort(), ['toon-client@5.0.0', 'toon-client@5.0.0 frobnicate']);
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /`toon-client frobnicate` is not a command of toon-client 5\.0\.0/);
  assert.match(problems.join('\n'), /names `toon send`, but only toon-cli skills may name `toon` commands/);
});

test('a toon_cli archive runs only when its SHA-256 is pinned in this repository', () => {
  const pins = { toon: { '0.6.0': { 'toon-v0.6.0-linux-x86_64.tar.gz': 'ab'.repeat(32) } } };

  assert.equal(pinnedSha256(pins, '0.6.0', 'toon-v0.6.0-linux-x86_64.tar.gz'), 'ab'.repeat(32));
  assert.throws(() => pinnedSha256(pins, '0.6.0', 'toon-v0.6.0-linux-aarch64.tar.gz'), /no SHA-256 for toon-v0\.6\.0-linux-aarch64\.tar\.gz/);
  assert.throws(() => pinnedSha256(pins, '0.7.0', 'toon-v0.7.0-linux-x86_64.tar.gz'), /checks\/client-pins\.json/);
  assert.throws(
    () => pinnedSha256({ toon: { '0.6.0': { 'toon-v0.6.0-linux-x86_64.tar.gz': 'not a hash' } } }, '0.6.0', 'toon-v0.6.0-linux-x86_64.tar.gz'),
    /not a SHA-256/,
  );
});

test('toon-client installs only from a committed lockfile that pins the requested version', () => {
  const lock = (version) =>
    JSON.stringify({ lockfileVersion: 3, packages: { 'node_modules/@toon-protocol/client': { version, integrity: 'sha512-x' } } });
  const root = repo({
    'checks/clients/toon-client-5.0.0/package.json': '{}',
    'checks/clients/toon-client-5.0.0/package-lock.json': lock('5.0.0'),
    'checks/clients/toon-client-5.1.0/package.json': '{}',
    'checks/clients/toon-client-5.1.0/package-lock.json': lock('5.0.0'),
  });

  assert.equal(lockedClient(join(root, 'checks'), '5.0.0'), join(root, 'checks', 'clients', 'toon-client-5.0.0'));
  assert.throws(() => lockedClient(join(root, 'checks'), '5.0.2'), /no lockfile for toon-client 5\.0\.2/);
  assert.throws(() => lockedClient(join(root, 'checks'), '5.1.0'), /pins @toon-protocol\/client 5\.0\.0, not 5\.1\.0/);
});

test('a downloaded client runs with none of the caller\'s environment but PATH', () => {
  const env = clientEnv('/tmp/empty-home', {
    PATH: '/usr/bin',
    HOME: '/home/agent',
    GH_TOKEN: 'ghs_secret',
    CLAUDE_CODE_OAUTH_TOKEN: 'secret',
    NODE_OPTIONS: '--require /tmp/x.js',
  });

  assert.deepEqual(env, { PATH: '/usr/bin', HOME: '/tmp/empty-home' });
});

test('this repository pins the client versions its own sending skills state', () => {
  const checks = dirname(fileURLToPath(import.meta.url));
  const lowest = (plugin) => {
    const { sendingSkill, rangeKey } = CLIENTS[plugin];
    const skillFile = join(checks, '..', 'plugins', plugin, 'skills', sendingSkill, 'SKILL.md');
    return lowestVersion(readFileSync(skillFile, 'utf8'), rangeKey);
  };
  const pins = JSON.parse(readFileSync(join(checks, 'client-pins.json'), 'utf8'));

  const toon = lowest('toon-cli');
  for (const cpu of ['x86_64', 'aarch64']) pinnedSha256(pins, toon, `toon-v${toon}-linux-${cpu}.tar.gz`);
  lockedClient(checks, lowest('toon-client'));
});
