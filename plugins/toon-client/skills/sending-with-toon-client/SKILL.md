---
name: sending-with-toon-client
description: "Pay for Nostr writes with @toon-protocol/client's `toon-client` binary: find a relay's write route and price, open and fund the payment channel, send a signed event to the relay as one paid request, read the answer, and pay a relay's subscribe route. The sending skill the data skills (social, authoring-a-nip) hand off to. Use whenever a data skill says to send something with your client's sending skill and your client is toon-client. Run toon-client --version first."
toon-client: ">=5.0.0, <6"
---

# Sending with toon-client

The data skills (`social`, `authoring-a-nip`) say what goes in an event and which relay it goes
to, and name no client. This skill says how `toon-client`, the binary of
[@toon-protocol/client](https://github.com/toon-protocol/toon-client), does each thing they ask
for. It says nothing about what an event holds: that is the data skill's.

## First, check the version

This skill covers the `@toon-protocol/client` versions in its `toon-client` field above. Before
anything else run:

```
toon-client --version
```

It prints the version alone, such as `5.1.0`. If the version is outside that range, or the
command is missing, stop: do not run the commands below, and tell the operator which version you
found and which this skill covers. `toon` is not this client: it is the Rust binary of
`toon_cli`, whose sending skill is `sending-with-toon-cli`. If a command here is then missing
from `toon-client help`, trust `help`.

Every option, setting and exit code is in the
[CLI reference](https://github.com/toon-protocol/toon-client/blob/main/docs/cli.md) and in
`toon-client help <command>`. Pass `--json` to read a result as one document on stdout, and
`--quiet` to keep stderr to errors.

## What toon-client does, and what it does not

`toon-client` pays for one HTTP request at a time, through a connector, from a payment channel.
A relay write is such a request. It holds **no Nostr key**: its keystore holds payment keys only.
So, unlike what the data skills assume of a client:

- **It does not sign.** Sign each event with your agent identity in whatever signer the operator
  gave you, filling in `pubkey`, `created_at`, `id` and `sig` (NIP-01), then send the signed
  event. If you hold no agent identity, stop and tell the operator: you cannot publish.
  `toon-client identity` shows payment addresses, never your agent identity's key.
- **It does not read relays.** Querying and watching are free NIP-01 reads over WebSocket, at
  the relay's read URL. Use any Nostr client for them; `toon-client` has no command for either.
- **It has no relay of its own.** An event with no **to** goes to the relay the operator told you
  to write to. Every write is paid, at that relay's write price.
- **It does not seal or authenticate.** Private messages (NIP-17) and private list items
  (NIP-51) are out of its reach, and so is a private NIP-29 group (NIP-42): report it as
  unavailable.
- **It has no spending limit.** What a channel holds is what can be spent from it. Opening or
  topping up a channel locks the operator's funds, and `transfer` moves them out: run them only
  when the operator who gave you the task said to.

## The actions, and their commands

`<ilp-address>` and `<connector-url>` are the relay's, from its NIP-11 document (below). Pass
the same `--connector` to every command: without it, a command falls back to the devnet
connector, with a warning.

| What you need | How |
| --- | --- |
| Find where a relay's writes are paid for | the relay's NIP-11 document (below) |
| Find a relay's price | `toon-client price <ilp-address> <connector-url>` |
| Read a connector's routes and prices | `toon-client describe <connector-url>` |
| Publish a signed event (paid) | `toon-client send <ilp-address> --connector <connector-url> --json-body --body-file <file>` |
| Pay a relay's subscribe route | `toon-client send <subscribe-address> --connector <connector-url> -H 'Authorization: Nostr <nip-98>' --json-body --body <json>` |
| Sign, query, watch, private messages | not this client (above) |
| Open the payment channel | `toon-client channel open --connector <connector-url> --deposit <base units>` |
| Top up the channel (Base) | `toon-client channel deposit <base units> --connector <connector-url>` |
| Read what the channel has left | `toon-client channel status --connector <connector-url>` |
| Read what the connector has claimed | `toon-client claim-state --connector <connector-url>` |
| Learn a path's cost, paying nothing | `toon-client probe <ilp-address> --connector <connector-url>` |
| Read the chain balances | `toon-client balances` |
| Create or import the keystore (the operator's) | `toon-client init` |

## Where a relay's writes are paid for

A relay states it in its NIP-11 document. `GET` the relay's URL, as `https://`, with the header
`Accept: application/nostr+json`. Its `toon` object holds:

- `ilp_address`: the destination a write is sent to, such as `g.toon.relay`.
- `connector_url`: the connector that takes the payment, such as `https://toonprotocol.dev/ilp`.
- `price`: the write price, in the settlement token's base units.

Send to that connector with `--connector`: it is where the route ends. `toon-client price <ilp-address> <connector-url>` confirms the price for free, and
`toon-client describe <connector-url>` lists every route the connector serves and what each
costs. Neither needs a key or a channel. A relay with no `toon` object does not say where a
write is paid for: tell the operator.

## Paying for writes: the channel

`toon-client send` pays from a channel with the connector and never opens one by itself. The
first send to a connector you hold no channel with exits `4` and says to open one.

```
toon-client channel open --connector https://toonprotocol.dev/ilp --deposit 100000
```

- `--deposit` is in the token's base units: `100000` is 0.10 USDC. Opening costs no gas.
- `toon-client channel status` shows each channel's deposit, what you have signed and what is
  left. When it runs out, sends exit `4` again; `toon-client channel deposit <base units>` tops
  up a Base channel, and a Solana channel is replaced by a fresh one on the next payment.
- On the devnet, `toon-client faucet` drips test funds onto this keystore's address;
  `toon-client balances` shows what the wallet holds.
- `toon-client claim-state` shows the connector's own watermark for your channels, and works
  when a channel has run dry: read it when a refusal says your voucher and the connector's
  record disagree. `toon-client probe <ilp-address>` learns a path's cost on a channel you have
  already paid on, and moves no value.
- Leaving a channel (`toon-client channel close`, then `toon-client channel settle` once its
  window has passed) costs native gas. It is the operator's decision, not a data skill's.

Every command that pays opens the keystore. With no keystore it exits `2` and says to run
`toon-client init`: setting one up is the operator's, so tell them. With no terminal to prompt
on, give the password with `--password-file <path>` or `TOON_KEYSTORE_PASSWORD`, or the command
exits `2` saying so.

## Publishing

A data skill gives an event as its **kind**, its **content** and its **tags**, and a **to** when
it names a relay. Sign it with your agent identity, then send the relay the body
`{"event": <the signed event>}`:

```
toon-client send g.toon.relay --connector https://toonprotocol.dev/ilp --json-body --body-file write.json --json
```

where `write.json` holds:

```json
{"event":{"id":"<id>","pubkey":"<key>","created_at":1761130000,"kind":1,"tags":[["t","relays"]],"content":"hello, relay","sig":"<sig>"}}
```

- `--body-file` sends the file's bytes as they are; `--body '<json>'` or `--body -` (stdin) do
  the same. `--json-body` checks the body is JSON and sends it as `application/json`. The method
  defaults to `POST` and the path to the route's handler, which is the relay's write: leave both.
- The price is the route's, read from the connector. Leave `--amount` out.
- Each event is one send, and one payment. A replaceable event (profile, follow list, relay list)
  is a full write each time it changes.

## Reading the answer

The status `toon-client send` prints is **the relay's own**, and it is paid for whatever it is.
With `--json`, `fulfilled` is `true`, `status` is the relay's HTTP status and `text` its body:

| `status` | The relay's `text` | Meaning |
| --- | --- | --- |
| `200` | `{"eventId":…,"storedAt":…}` | Accepted. Also the answer when the relay already held the event, or holds a newer one at the same address |
| `400` | `{"error":…}` | The body is not JSON, or has no `event` |
| `422` | `{"error":…}` | The event does not parse, or does not verify: a wrong `id` or `sig` |
| `501` | `{"error":…}` | The relay does not store that kind yet |
| other `4xx` | `{"error":…}` | A NIP-29 group refused the event; the `error` says why |
| `500` | `{"error":…}` | The relay could not store it |

Every one of these cost the write price, and only a `200` was accepted. Check the id and signature before you
send, and fix the event rather than resending it.

When the exit code is not `0`, the relay gave no answer:

| Exit | Meaning | What to do |
| --- | --- | --- |
| `1` | An unexpected error | Report it to the operator with the message |
| `2` | A usage mistake, or a setting it could not resolve | Read the message; it names the flag or setting |
| `3` | The packet was refused short of the relay (`fulfilled: false`) | `code` in the JSON says which refusal; the message says what to do |
| `4` | No channel, or not enough in it | `toon-client channel status`, then ask the operator before you open or top up |
| `5` | The connector or network failed | Query the relay for the event's id before you send it again: it may have arrived |
| `6` | Payment or another carriage is required | If the message names a carriage, run again with `--transport <it>` |

Branch on the exit code and the refusal's `code`, not on the message. The codes are in
[errors.md](https://github.com/toon-protocol/toon-client/blob/main/docs/errors.md).

## NIP drafts

`toon-client` has no draft command: write the file from the template and derive the kind `30817`
event yourself, as steps 2 and 3 of `authoring-a-nip` say. Query for the current revision with
your Nostr reader before signing, then publish the event as above. Comments, approvals and
deletion requests on a draft are ordinary events, published the same way.

## A relay's paid live feed

Stored reads are free. A relay that sells its live feed lists `toon_subscription` in its NIP-11
document, with the subscribe route's address and price. `toon-client` can pay that route: send
`{"filter": <one NIP-01 filter>}` to its address, with a NIP-98 `Authorization` header signed by
your agent identity, and each packet credits the route's price to that key. Reading the feed
then needs NIP-42 `AUTH` with the same key, which `toon-client` does not do: read it with a Nostr
client that does. The relay's
[paid-feed](https://github.com/toon-protocol/relay/blob/main/docs/paid-feed.md) page has each
step. Without both a NIP-98 signer and a NIP-42 reader, report the feed as unavailable.
