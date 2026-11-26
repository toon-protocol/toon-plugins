// Fails when a skill names a command, or a flag of one, that its client's lowest supported
// version does not have.
//
// A named command is an inline code span, or a line of a code block, that starts with the
// binary. That rule began as toon_cli's `named_commands` (tests/skill.rs), but this check
// reads more than it does: it blanks fenced code blocks before reading inline spans, joins a
// line that ends in `\` with the next, reads each command between shell operators on its own
// (a `toon-client send` after a pipe is checked too), and checks the
// long flags a command passes as well as its words.
//
// Run from the repository root: `node checks/skill-commands.mjs`. It fetches each client
// at the low end of the range its sending skill's frontmatter states (toon from the
// toon_cli release, toon-client from npm) and runs `--help` on every command the skills
// name. It needs network access, curl, tar and npm.
//
// WHAT IT IS ALLOWED TO RUN
// -------------------------
// This check executes code it downloads, and the AFK factory runs it inside a sandbox
// that holds a GitHub write token and a Claude credential. So:
//
//   - It runs only bytes this repository pins. A toon_cli archive must match the SHA-256
//     in checks/client-pins.json. toon-client installs with `npm ci` from the lockfile in
//     checks/clients/toon-client-<version>/, which pins every package by integrity hash.
//     A version with no pin fails the check; it is never fetched on trust.
//   - It runs them with an environment of PATH and an empty HOME, nothing else, so a
//     token in the caller's environment is not handed to them.
//
// WHEN A SKILL'S LOWER BOUND MOVES, add the pin in the same change:
//
//   toon         gh api repos/toon-protocol/toon_cli/releases/tags/v<version> \
//                  --jq '.assets[] | [.name, .digest] | @tsv'
//                and copy both linux archive digests into checks/client-pins.json.
//   toon-client  copy checks/clients/toon-client-<old>/package.json to
//                checks/clients/toon-client-<version>/, set the version, and run
//                `npm install --package-lock-only --ignore-scripts` there.

import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { arch, platform, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The directory this file is in: where the pins and lockfiles live. */
const CHECKS = dirname(fileURLToPath(import.meta.url));

/**
 * The plugins that are a client's: the binary its skills may name, and the sending skill
 * whose frontmatter key holds the supported range. Any other plugin may name no binary.
 */
export const CLIENTS = {
  'toon-cli': { binary: 'toon', sendingSkill: 'sending-with-toon-cli', rangeKey: 'toon_cli' },
  'toon-client': { binary: 'toon-client', sendingSkill: 'sending-with-toon-client', rangeKey: 'toon-client' },
};

/**
 * Every command a skill file names, as its command path: an inline code span that
 * starts with `<binary> `, and a line of a code block that does. The path is the
 * leading plain words; a value (`<placeholder>`, `g.toon.relay`) or a flag ends it.
 *
 * @param {string} text
 * @param {string} binary
 * @returns {string[][]}
 */
export function namedCommands(text, binary) {
  return namedInvocations(text, binary).map(commandPath);
}

/**
 * Every long flag each named command passes, with its command path: `--flag` words after
 * the binary in the same span or line. A flag's value, a placeholder or a short flag is not
 * one.
 *
 * @param {string} text
 * @param {string} binary
 * @returns {{ command: string[], flag: string }[]}
 */
export function namedFlags(text, binary) {
  return namedInvocations(text, binary).flatMap((rest) => {
    const command = commandPath(rest);
    const flags = rest
      .split(/\s+/)
      .map((word) => word.match(/^(--[a-z][a-z0-9-]*)(?:=.*|[.,:]+)?$/)?.[1])
      .filter((flag) => flag !== undefined && flag !== '--help');
    return [...new Set(flags)].map((flag) => ({ command, flag }));
  });
}

/**
 * The text after `<binary> ` of every command the skill names: an inline code span, or a line
 * of a code block, that starts with it, and every later command in that span or code-block
 * line that does, after a pipe, `&&`, `||`, `;`, `&`, `(`, `$(` or `)`. Each runs up to the next
 * shell operator: what follows a pipe or `&&` belongs to the next program, which is read on
 * its own. A line ending in `\` is read together with the line after it.
 *
 * A line outside a fenced code block counts only when it starts with the binary, as before:
 * prose is not split at shell operators.
 *
 * @param {string} text
 * @param {string} binary
 * @returns {string[]}
 */
function namedInvocations(text, binary) {
  const prefix = `${binary} `;
  const inCode = [...inlineSpans(outsideCodeBlocks(text)), ...joinContinuations(insideCodeBlocks(text))];
  const prose = joinContinuations(outsideCodeBlocks(text)).map((line) => line.trimStart());
  return [...inCode.map(withoutComment).flatMap(shellCommands), ...prose]
    .filter((command) => command.startsWith(prefix))
    .map((command) => ownWords(command.slice(prefix.length)));
}

/**
 * A shell span or line without its comment: from a `#` that starts a word outside quotes to
 * the end, which the shell does not run, so no command or flag in it is the skill's.
 *
 * @param {string} line
 */
function withoutComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quote === null && char === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
    if (quote !== "'" && char === '\\') i += 1;
    else if (quote === null && (char === "'" || char === '"')) quote = char;
    else if (char === quote) quote = null;
  }
  return line;
}

/**
 * The commands of a shell span or line, split at `|`, `||`, `&&`, `&`, `;`, `(`, `$(` and `)`,
 * each without its leading space or a leading `do`, `then`, `else`, `!` or `time`.
 *
 * @param {string} line
 * @returns {string[]}
 */
function shellCommands(line) {
  return line
    .split(/\|\||&&|\$\(|[|&;()]/)
    .map((command) => command.trimStart().replace(/^(?:(?:do|then|else|time|!)\s+)+/, ''));
}

/**
 * The contents of the inline code spans of `text`, as CommonMark reads them: a run of n
 * backticks opens a span that only a run of exactly n closes, so ``` ``toon x`` ``` is one
 * span, and one leading and trailing space is stripped from a span that has both.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function inlineSpans(text) {
  const spans = [];
  const runs = /`+/g;
  let open = null;
  for (let run = runs.exec(text); run !== null; run = runs.exec(text)) {
    if (open === null) {
      open = run;
    } else if (run[0].length === open[0].length) {
      const body = text.slice(open.index + open[0].length, run.index).replace(/\n/g, ' ');
      spans.push(/^ .* $/.test(body) && body.trim() !== '' ? body.slice(1, -1) : body);
      open = null;
    }
  }
  return spans;
}

/**
 * The lines of `text`, with each line that ends in `\` joined to the line after it.
 *
 * @param {string} text
 * @returns {string[]}
 */
function joinContinuations(text) {
  const lines = [];
  let pending = null;
  for (const line of text.split('\n')) {
    const joined = pending === null ? line : `${pending} ${line.trimStart()}`;
    if (/\\\s*$/.test(joined)) {
      pending = joined.replace(/\s*\\\s*$/, '');
    } else {
      lines.push(joined);
      pending = null;
    }
  }
  if (pending !== null) lines.push(pending);
  return lines;
}

/**
 * The words of `rest` that are the command's own: those before a pipe, `&`, `;`, `)`, a
 * bare `--` or a shell comment. After `--` a word is an argument even when it looks like a
 * flag, and from a word that starts with an unquoted `#` to the end of the line the shell
 * reads a comment, so `toon send x # use --bogus` names no flag.
 *
 * @param {string} rest
 */
function ownWords(rest) {
  const words = [];
  let quote = null;
  for (const word of rest.split(/\s+/).filter(Boolean)) {
    if (quote === null && word.startsWith('#')) break;
    quote = quoteAfter(word, quote);
    if (word === '--') break;
    const operator = word.search(/[|&;)]/);
    if (operator === -1) {
      words.push(word);
      continue;
    }
    if (operator > 0) words.push(word.slice(0, operator));
    break;
  }
  return words.join(' ');
}

/**
 * The quote still open after `word`, given the one open before it: `'` or `"`, or null.
 *
 * @param {string} word
 * @param {string | null} open
 */
function quoteAfter(word, open) {
  let quote = open;
  for (let i = 0; i < word.length; i += 1) {
    const char = word[i];
    if (quote !== "'" && char === '\\') i += 1;
    else if (quote === null && (char === "'" || char === '"')) quote = char;
    else if (char === quote) quote = null;
  }
  return quote;
}

/**
 * `text` with the lines of its fenced code blocks, fences included, left empty, so it keeps
 * its line count: a backtick inside a code block (an `awk` or shell script) is not an inline
 * code span's, and counting it would pair every later span's backticks wrongly, so no later
 * span would be checked. A fence is indented at most three spaces, as in CommonMark; four or
 * more make an indented code block, which holds no fence.
 *
 * @param {string} text
 */
export function outsideCodeBlocks(text) {
  return splitCodeBlocks(text).outside;
}

/**
 * `text` with every line outside its fenced code blocks, and the fences themselves, left
 * empty: the code-block lines, each in its place.
 *
 * @param {string} text
 */
export function insideCodeBlocks(text) {
  return splitCodeBlocks(text).inside;
}

/** @param {string} text */
function splitCodeBlocks(text) {
  let fence = null;
  const inside = [];
  const outside = [];
  for (const line of text.split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)?.[1];
    if (fence === null && marker !== undefined) {
      fence = marker;
    } else if (fence !== null) {
      if (marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker) {
        fence = null;
      } else {
        inside.push(line);
        outside.push('');
        continue;
      }
    } else {
      inside.push('');
      outside.push(line);
      continue;
    }
    inside.push('');
    outside.push('');
  }
  return { inside: inside.join('\n'), outside: outside.join('\n') };
}

/** @param {string} rest */
function commandPath(rest) {
  const path = [];
  for (const word of rest.split(/\s+/).filter(Boolean)) {
    if (!/^[a-z-]+$/.test(word) || word.startsWith('-')) break;
    path.push(word);
  }
  return path;
}

/**
 * The lowest version a skill supports: the `>=` bound of the range under `rangeKey` in
 * its frontmatter, as `major.minor.patch`.
 *
 * @param {string} skill the text of a SKILL.md
 * @param {string} rangeKey
 * @returns {string}
 */
export function lowestVersion(skill, rangeKey) {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
  const line = frontmatter.split('\n').find((l) => l.startsWith(`${rangeKey}:`));
  if (line === undefined) throw new Error(`The skill's frontmatter has no \`${rangeKey}\` key.`);
  const range = line.slice(rangeKey.length + 1).trim().replace(/^["']|["']$/g, '');
  const bound = range.match(/>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (bound === null) throw new Error(`The range \`${range}\` under \`${rangeKey}\` has no lower bound.`);
  return [bound[1], bound[2] ?? '0', bound[3] ?? '0'].join('.');
}

/**
 * @typedef {(binary: string, version: string, path: string[]) =>
 *   Promise<{ exitCode: number, stdout: string, stderr: string }>} RunHelp
 *   Runs `<binary> <path...> --help` at that version.
 */

/**
 * The lowest client version a client plugin's sending skill says it supports.
 *
 * @param {string} root the repository root
 * @param {keyof typeof CLIENTS} plugin
 * @returns {string}
 */
export function lowestSupportedVersion(root, plugin) {
  const { sendingSkill, rangeKey } = CLIENTS[plugin];
  const skillFile = join(root, 'plugins', plugin, 'skills', sendingSkill, 'SKILL.md');
  return lowestVersion(readFileSync(skillFile, 'utf8'), rangeKey);
}

/**
 * True when the backticks outside code fences do not pair up, i.e. a stray one is
 * present. `namedCommands` pairs backticks by position, so a stray one would hide
 * every command after it; the check refuses the file instead of guessing.
 *
 * @param {string} text
 */
export function hasUnbalancedBacktick(text) {
  let inFence = false;
  let count = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trimStart();
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) count += (line.match(/`/g) ?? []).length;
  }
  return count % 2 === 1;
}

/**
 * Every problem with the commands the skills under `root/plugins` name, one line each.
 * No problems means the check passes.
 *
 * @param {string} root
 * @param {RunHelp} runHelp
 * @returns {Promise<string[]>}
 */
export async function checkRepo(root, runHelp) {
  const problems = [];
  for (const plugin of readdirSync(join(root, 'plugins')).sort()) {
    const files = skillFiles(root, plugin).map((path) => ({
      path,
      text: readFileSync(join(root, path), 'utf8'),
    }));
    for (const { path, text } of files) {
      if (hasUnbalancedBacktick(text)) {
        problems.push(`${path}: unbalanced backtick, so the commands it names cannot be read reliably`);
      }
    }
    for (const [owner, client] of Object.entries(CLIENTS)) {
      const named = files.flatMap(({ path, text }) =>
        namedCommands(text, client.binary).map((command) => ({ path, command })),
      );
      const flags = files.flatMap(({ path, text }) =>
        namedFlags(text, client.binary).map((named) => ({ path, ...named })),
      );
      if (owner === plugin) {
        if (named.length === 0) continue;
        const version = lowestSupportedVersion(root, plugin);
        problems.push(...(await checkCommands(client.binary, version, named, flags, runHelp)));
      } else {
        for (const { path, command } of named) {
          problems.push(
            `${path}: names \`${[client.binary, ...command].join(' ')}\`, but only ${owner} skills` +
              ` may name \`${client.binary}\` commands`,
          );
        }
      }
    }
  }
  return problems;
}

/**
 * The named commands that `binary` at `version` lacks, and the flags those commands lack.
 *
 * A command exists when `--help` on it exits 0 and each of its words is named by its own help
 * wherever the command before it lists subcommands. A client that answers `--help` on an
 * unknown subcommand with its parent's help, exiting 0 (toon-client 5.0 does for
 * `channel <anything>`), has not shown that subcommand. Under a command that lists none, the
 * next word is an argument (`toon add echo`), and so is every word after it.
 *
 * A flag exists when the command's help, or the binary's own help for global options, names it.
 *
 * @param {string} binary
 * @param {string} version
 * @param {{ path: string, command: string[] }[]} named
 * @param {{ path: string, command: string[], flag: string }[]} flags
 * @param {RunHelp} runHelp
 */
async function checkCommands(binary, version, named, flags, runHelp) {
  /** @param {string[]} command */
  const commandLine = (command) => [binary, ...command].join(' ');
  const help = new Map();
  /** @param {string[]} command */
  const helpFor = async (command) => {
    const line = commandLine(command);
    if (!help.has(line)) help.set(line, await runHelp(binary, version, command));
    return help.get(line);
  };
  const problems = [];
  const reported = new Set();
  for (const { path, command } of named) {
    const line = commandLine(command);
    const { exitCode, stderr } = await helpFor(command);
    if (exitCode !== 0) {
      reported.add(line);
      problems.push(
        `${path}: \`${line}\` is not a command of ${binary} ${version}` +
          ` (\`${line} --help\` exited ${exitCode}): ${stderr.trim().split('\n')[0]}`,
      );
      continue;
    }
    for (let i = 0; i < command.length; i++) {
      const parent = command.slice(0, i);
      if (!listsSubcommands((await helpFor(parent)).stdout, commandLine(parent))) break;
      const own = command.slice(0, i + 1);
      if (namesWord((await helpFor(own)).stdout, command[i])) continue;
      reported.add(line);
      problems.push(
        `${path}: \`${line}\` is not a command of ${binary} ${version}` +
          ` (\`${commandLine(own)} --help\` does not name \`${command[i]}\`)`,
      );
      break;
    }
  }
  for (const { path, command, flag } of flags) {
    const line = commandLine(command);
    if (reported.has(line)) continue;
    if (namesWord((await helpFor(command)).stdout, flag)) continue;
    if (command.length > 0 && namesWord((await helpFor([])).stdout, flag)) continue;
    const consulted =
      command.length > 0 ? `neither \`${line} --help\` nor \`${binary} --help\` names it` : `\`${binary} --help\` does not name it`;
    problems.push(`${path}: \`${line} ${flag}\` is not a flag of ${binary} ${version} (${consulted})`);
  }
  return problems;
}

/**
 * Whether `help`, the help of `commandLine`, lists subcommands: a clap `Commands:` section, or
 * a usage line offering a choice of words after the command (`channel open|close|status`).
 *
 * @param {string} help
 * @param {string} commandLine
 */
function listsSubcommands(help, commandLine) {
  if (/^Commands:/m.test(help)) return true;
  return new RegExp(`${escapeRegExp(commandLine)} [a-z-]+(?: <[^>]+>)?\\|[a-z-]+`).test(help);
}

/**
 * Whether `help` names `word` as a whole word: not as part of a longer command or flag.
 *
 * @param {string} help
 * @param {string} word
 */
function namesWord(help, word) {
  return new RegExp(`(^|[^\\w-])${escapeRegExp(word)}(?![\\w-])`).test(help);
}

/** @param {string} text `text` as a regular expression that matches it literally. */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every Markdown file of every skill in a plugin, relative to the repository root: each
 * `SKILL.md` and the references beside it.
 *
 * @param {string} root
 * @param {string} plugin
 * @returns {string[]}
 */
function skillFiles(root, plugin) {
  const skills = join('plugins', plugin, 'skills');
  if (!existsSync(join(root, skills))) return [];
  return readdirSync(join(root, skills), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const dir = join(skills, entry.name);
      const references = existsSync(join(root, dir, 'references'))
        ? readdirSync(join(root, dir, 'references')).map((name) => join(dir, 'references', name))
        : [];
      return [join(dir, 'SKILL.md'), ...references].filter((path) => existsSync(join(root, path)));
    })
    .sort();
}

/**
 * The release asset that carries `toon` for the host this check runs on, as the
 * `<os>-<arch>` part of the asset name. `toon_cli` publishes one archive per
 * platform, so a host that downloads the Linux archive on macOS gets a binary
 * the host cannot run.
 *
 * @param {string} os the `os.platform()` value
 * @param {string} cpu the `os.arch()` value
 * @returns {string} the `<os>-<arch>` part, for example `linux-x86_64`
 */
export function releasePlatform(os = platform(), cpu = arch()) {
  const arm = cpu === 'arm64';
  if (os === 'linux') return arm ? 'linux-aarch64' : 'linux-x86_64';
  if (os === 'darwin') {
    if (!arm) {
      throw new Error(
        'toon publishes no release asset for macOS on x86_64. ' +
          'Run this check on Apple Silicon, or on Linux, where toon is published.',
      );
    }
    return 'macos-aarch64';
  }
  throw new Error(
    `toon publishes no release asset for ${os}. ` +
      'Run this check on Linux or on Apple Silicon macOS, where toon is published.',
  );
}

/**
 * The SHA-256 this repository pins for a toon_cli release archive. Throws when there is
 * none, so an unpinned archive is never downloaded and run.
 *
 * @param {{ toon?: Record<string, Record<string, string>> }} pins the parsed client-pins.json
 * @param {string} version
 * @param {string} asset the archive's file name
 * @returns {string}
 */
export function pinnedSha256(pins, version, asset) {
  const sha256 = pins.toon?.[version]?.[asset];
  if (sha256 === undefined) {
    throw new Error(
      `checks/client-pins.json has no SHA-256 for ${asset}. Add the digest GitHub reports for` +
        ` that asset of toon_cli v${version} (see the top of checks/skill-commands.mjs).`,
    );
  }
  if (!/^[0-9a-f]{64}$/.test(sha256)) {
    throw new Error(`checks/client-pins.json: the entry for ${asset} is not a SHA-256.`);
  }
  return sha256;
}

/**
 * The directory holding the committed package.json and package-lock.json for a
 * toon-client version. Throws when there is none, or when its lockfile pins another
 * version, so toon-client is never installed from an unpinned tree.
 *
 * @param {string} checks the `checks` directory
 * @param {string} version
 * @returns {string}
 */
export function lockedClient(checks, version) {
  const dir = join(checks, 'clients', `toon-client-${version}`);
  const lockfile = join(dir, 'package-lock.json');
  if (!existsSync(lockfile) || !existsSync(join(dir, 'package.json'))) {
    throw new Error(
      `checks/clients has no lockfile for toon-client ${version}. Add` +
        ` checks/clients/toon-client-${version}/ (see the top of checks/skill-commands.mjs).`,
    );
  }
  const lock = JSON.parse(readFileSync(lockfile, 'utf8'));
  const locked = lock.packages?.['node_modules/@toon-protocol/client']?.version;
  if (locked !== version) {
    throw new Error(
      `${lockfile} pins @toon-protocol/client ${locked}, not ${version}` +
        ' (see the top of checks/skill-commands.mjs).',
    );
  }
  return dir;
}

/**
 * The whole environment a downloaded client runs with: the caller's PATH (toon-client's
 * launcher finds `node` on it) and an empty HOME. Every other variable is withheld,
 * tokens included.
 *
 * @param {string} home an empty directory
 * @param {Record<string, string | undefined>} [hostEnv]
 * @returns {Record<string, string>}
 */
export function clientEnv(home, hostEnv = process.env) {
  return { PATH: hostEnv.PATH ?? '', HOME: home };
}

/** Installs each client version once, into a temporary directory, and runs it there. */
function realBinaries() {
  const pins = JSON.parse(readFileSync(join(CHECKS, 'client-pins.json'), 'utf8'));
  /** @type {Map<string, string>} */
  const installed = new Map();
  /** @type {(binary: string, version: string) => string} */
  const install = (binary, version) => {
    const dir = mkdtempSync(join(tmpdir(), `${binary}-${version}-`));
    if (binary === 'toon') {
      const target = `toon-v${version}-${releasePlatform()}`;
      const url = `https://github.com/toon-protocol/toon_cli/releases/download/v${version}/${target}.tar.gz`;
      const tarball = join(dir, `${target}.tar.gz`);
      // The expected hash comes from this repository, not from the release being checked.
      const expected = pinnedSha256(pins, version, `${target}.tar.gz`);
      execFileSync('curl', ['-fsSL', '-o', tarball, url]);
      const actual = createHash('sha256').update(readFileSync(tarball)).digest('hex');
      if (actual !== expected) throw new Error(`${url} has SHA-256 ${actual}, not the pinned ${expected}.`);
      execFileSync('tar', ['xzf', tarball, '-C', dir]);
      return join(dir, target, 'toon');
    }
    if (binary === 'toon-client') {
      // `npm ci` installs exactly the committed lockfile and fails on any integrity mismatch.
      // --ignore-scripts: the gate runs `--help`, so no package needs to run code at install time.
      const locked = lockedClient(CHECKS, version);
      for (const file of ['package.json', 'package-lock.json']) copyFileSync(join(locked, file), join(dir, file));
      // npm itself keeps the caller's environment (~/.npmrc, npm_config_*) on purpose: it only
      // downloads, and with --ignore-scripts no package code runs. Only the client runs bare.
      execFileSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: dir,
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      return join(dir, 'node_modules', '.bin', 'toon-client');
    }
    throw new Error(`No way to install ${binary}.`);
  };
  /** @type {RunHelp} */
  return async (binary, version, path) => {
    const key = `${binary}@${version}`;
    let command = installed.get(key);
    if (command === undefined) {
      console.error(`Installing ${key}...`);
      command = install(binary, version);
      installed.set(key, command);
    }
    // A fresh, empty HOME for every run, removed afterwards, so nothing one run writes reaches the next.
    const home = mkdtempSync(join(tmpdir(), 'skill-commands-home-'));
    try {
      const run = spawnSync(command, [...path, '--help'], { encoding: 'utf8', env: clientEnv(home) });
      if (run.error) throw run.error;
      return { exitCode: run.status ?? 1, stdout: run.stdout, stderr: run.stderr };
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = await checkRepo(process.cwd(), realBinaries());
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error(`\n${problems.length} command(s) or flag(s) in the skills fail the check.`);
    process.exit(1);
  }
  console.error('Every command and flag the skills name exists in its client\'s lowest supported version.');
}
