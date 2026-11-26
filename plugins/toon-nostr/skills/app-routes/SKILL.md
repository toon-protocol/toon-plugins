---
name: app-routes
description: "Publish, find and verify paid HTTP app routes behind a TOON connector (kind 30850): announce a route with its connector URL, ILP prefix and pinned sealing key, update or withdraw it, and discover and verify another operator's route against GET /ilp before paying it. Says what each event holds and what to check, and names no client's commands: send and inspect with your client's sending skill (sending-with-toon-cli with operating-an-agent-node, or sending-with-toon-client). Use when asked to advertise a paid HTTP app or route on TOON, or to find, verify or call a paid HTTP service on a relay."
---

# App routes on TOON

This skill says how an operator announces a paid HTTP app route on a relay, and how a caller finds
one and checks it against its connector before paying anything. It names no client's commands.
Query, publish, inspect and pay with your client's sending skill: `sending-with-toon-cli` (with
`operating-an-agent-node` for connector inspection, probing and app sends) for toon_cli, or
`sending-with-toon-client` for @toon-protocol/client. Read that skill before you send anything.

The specification is the *App routes* NIP draft, published as kind `30817` at
`30817:dde27724a795bd2e2930b69085017cf31e7daf391141b9d7712e92f0bf43e7bf:app-routes` on
`wss://relay.toonprotocol.dev` (mirrored on `wss://relay.primal.net` and `wss://nos.lol`). Read its
current revision first:

```json
{"kinds":[30817],"authors":["dde27724a795bd2e2930b69085017cf31e7daf391141b9d7712e92f0bf43e7bf"],"#d":["app-routes"]}
```

This skill only summarises the workflow and tags; copy the exact rules and wire shapes from the
draft (`### Publishing an app route`, `### Updating and withdrawing`, and
`### Finding and verifying an app route`). Where this skill and the draft differ, the draft wins.

**Scope.** This skill covers per-request paid HTTP apps behind a connector (kind `30850`). Tipping
an agent identity is in `social` (`references/tips.md`), container leases and repository
Deployments are in `compute`, and human classified listings are in `social`
(`references/nip-99.md`).

## 1. Find a route

Stored reads cost nothing. Query relays you can reach by topic:

```json
{"kinds":[30850],"#t":["<topic>"]}
```

By request or response MIME type:

```json
{"kinds":[30850],"#m":["<media-type>"]}
```

By source repository or by one operator's route identifier:

```json
{"kinds":[30850],"#a":["30617:<owner key>:<repo d>"]}
```

```json
{"kinds":[30850],"authors":["<operator key>"],"#d":["<route id>"]}
```

Keep only the current revision for each `30850:<pubkey>:<d>` address, and drop incomplete, expired,
disallowed-scheme or deleted events as `### Finding and verifying an app route` in the draft
specifies.

## 2. Verify against the connector before paying

An app route event is the signer's claim. Never pay from the relay event alone:

1. **Read the connector's self-description** (`GET` at `connector_url`, free) and confirm that
   `edgeIdentity.publicKey` matches `connector_seal_key` (normalised hex) and that `routes` lists
   an entry with `prefix` equal to `ilp_address`. Refuse and send nothing if either check fails.
2. **Take the terms from `routes`**, never from prose in `content`: `price`, optional
   `pricePerKib`, optional `requiredTransport`, and optional `request`. If neither `request` nor
   `content` gives the HTTP method and path, stop rather than guess.
3. **Bound the cost before paying**, following your client's sending skill: a direct client
   computes `price` plus `pricePerKib` over the whole packet (HTTP headers, body and sealing
   overhead); a multi-hop agent node probes the path first (noting that `"complete": false` on an
   amount-0 probe is only a floor, and a 0-price route is already delivered by an amount-0 probe).
   Check the total against the spending limit or operator allowance before sending.

## 3. Publish, update or withdraw an app route

Read the target relay's write price and check your spending limit or operator allowance before any
paid write. Sign kind `30850` with your agent identity, copying the tag rules from
`### Publishing an app route` in the draft:

| Tag | Required | Holds |
| --- | --- | --- |
| `d` | yes | Unique route slug under your key |
| `name` | yes | Non-empty display name |
| `connector_url` | yes | Your connector's `/ilp` URL (`https://…/ilp` or `http://<host>.anyone:<port>/ilp`) |
| `ilp_address` | yes | The route's `prefix` in `routes` |
| `connector_seal_key` | yes | Your connector's `edgeIdentity.publicKey` in hex |
| `m` | no | Request (`in`) or response (`out`) MIME type, repeatable |
| `t` | no | Lower-case topic word, repeatable |
| `a` | no | Optional NIP-34 repository coordinate (`30617:<owner key>:<repo d>`, at most one) |
| `expiration` | no | Optional NIP-40 expiry timestamp |

- Never put price, settlement or carriage in relay tags; callers always take them from `GET` at
  `connector_url`, so repricing a route on your connector requires no new event.
- Describe the app, its request inputs, its response shape and its status codes in Markdown
  `content` (or leave `content` empty when the connector's `request` metadata already covers them).
- **Re-sign** the full event at the same `d` (with a newer `created_at`) whenever an endpoint,
  sealing key, expiry, tag or description changes.
- **Take down** early with a NIP-09 deletion (kind `5`) carrying `["a","30850:<your key>:<d>"]` and
  `["k","30850"]` on every relay you wrote the route to (paid on relays that are not yours), or
  wait for `expiration`.

## Warning: public identity link and paid errors

- Announcing a route ties your signing key in public to `connector_url` (`.anyone` addresses
  included) and `ilp_address`, and relays may still hold older revisions after a deletion. Do not
  publish a `30850` for a connector you need kept separate from that key.
- Checking `GET` at `connector_url` confirms the connector serves that prefix under that sealing
  key, not that the app's output is honest or right; where a client fetches `GET` at
  `connector_url` again when sending, transport security (`https://` or `.anyone`) bridges the read
  and the send. Once the app answers, even `4xx` or `5xx` fulfils the packet with no refund.
