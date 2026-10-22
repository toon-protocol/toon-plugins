# toon-plugins

Agent skills for [TOON Protocol](https://github.com/toon-protocol), as a Claude Code plugin marketplace.

The TOON clients create and send packets. These skills tell an agent what goes in them.

```
/plugin marketplace add toon-protocol/toon-plugins
/plugin install toon-nostr@toon
/plugin install toon-cli@toon       # or: toon-client@toon
```

Install `toon-nostr`, plus the plugin for whichever client you run.

| Plugin | Who needs it | What it teaches |
| --- | --- | --- |
| `toon-nostr` | everyone | The data: the Nostr events and blob requests each TOON app takes, and in what order (git over NIP-34 and Blossom, social, authoring a NIP). It names no client. |
| `toon-cli` | [toon_cli](https://github.com/toon-protocol/toon_cli) users | How to stand up TOON apps and run an agent node, and how to send packets with the Rust `toon` binary. |
| `toon-client` | [@toon-protocol/client](https://github.com/toon-protocol/toon-client) users | How to send packets with that package's `toon` CLI. |

A data skill in `toon-nostr` hands off to the sending skill of your client. Each client plugin
states the client versions it supports, and checks the installed version first.

## Where the protocol lives

The skills don't define any protocol. NIP texts, per-app guides and Nostr decisions live in
[toon-protocol/relay](https://github.com/toon-protocol/relay) (`docs/nips/`, `docs/apps/`,
`docs/adr/`). The skills link to those files and don't copy them.

## Status

| Plugin | Skills |
| --- | --- |
| `toon-nostr` | `social`, `authoring-a-nip`. The `git` skill is [#3](https://github.com/toon-protocol/toon-plugins/issues/3). |
| `toon-cli` | `operating-an-agent-node`, and the sending skill `sending-with-toon-cli`, for `toon_cli` `>=0.3, <0.4`. |
| `toon-client` | None yet: its sending skill is [toon-client#752](https://github.com/toon-protocol/toon-client/issues/752). |

The skills moved here from `toon_cli`
([toon_cli#263](https://github.com/toon-protocol/toon_cli/issues/263)). The plan is
[relay#276](https://github.com/toon-protocol/relay/issues/276).

## License

MIT
