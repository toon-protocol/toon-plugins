# NIP-54: wiki articles

Shared encyclopedia entries written in Djot, where many keys can publish their own version of the same topic.

## Shape

- Article: kind `30818`, addressable by `["d","<normalized-topic>"]`. Many authors may publish under
  the same `d`, each keeping one current entry at `30818:<author>:<d>`.
- Normalize every `d` tag and wikilink target the same way:
  - Lowercase every letter that has case (`"Relay Pricing"` -> `"relay-pricing"`, `"Ñodo"` -> `"ñodo"`).
  - Replace whitespace with `-`, collapse repeated `-` to a single `-`, and trim `-` from both ends
    (`"  Write   Price  "` -> `"write-price"`).
  - Strip punctuation and symbols (`"What's a Connector?"` -> `"whats-a-connector"`).
  - Keep digits and uncased UTF-8 letters unchanged (`"Channel 2"` -> `"channel-2"`,
    `"リレー Guide"` -> `"リレー-guide"`).
- `content` is [Djot](https://djot.net/), not Markdown, with two Nostr rules:
  - Link targets may be `nostr:` URIs (`[Alice](nostr:npub1...)` for a profile or event).
  - A reference-style link with no matching link definition in the body links to the wiki topic with
    that normalized `d` value: `[write price][]` points to `"write-price"`, and
    `[ILP connector][Connector]` shows `ILP connector` while pointing to `"connector"`. Prefer
    wikilinks over pinning one article event URI so the reader chooses whose version to read.
- Optional article tags: `["title","..."]` when the display heading differs from `d`, and
  `["summary","..."]` for list previews.
- Lineage markers put the same marker in element 3 of both `a` and `e`:
  - `fork` — derived from another revision:
    `["a","30818:<source key>:<d>","<ws-url>","fork"]` and
    `["e","<source id>","<ws-url>","fork"]`.
  - `defer` — stands down in favour of a better entry (stronger than a `+` reaction):
    `["a","30818:<preferred key>:<d>","<ws-url>","defer"]` and
    `["e","<preferred id>","<ws-url>","defer"]`.
- Merge request: kind `818`, asking an author to fold a forked `30818` revision into their entry.
  `content` optionally explains the edit. Tags: `["a","30818:<target key>:<d>","<ws-url>"]`,
  `["p","<target key>"]`, optional `["e","<base id>","<ws-url>"]` (the revision the edit started
  from), and `["e","<candidate 30818 id>","<ws-url>","source"]`. The target key accepts or declines
  with a `nip-25.md` `+` or `-` reaction tagging the `818` event.
- Redirect: kind `30819`, addressable, empty `content`, tags
  `[["d","<normalized-alias>"],["a","30818:<key>:<target-d>","<ws-url>"]]`. Maps an alternate
  slug to a target entry or gathers disambiguation targets.

## Publish

An article:

- **kind** `30818`
- **tags** `[["d","relay-pricing"],["title","Relay pricing"],["summary","How a TOON relay states and charges its write and feed prices"]]`
- **to** another relay: a paid write
- **content**:

```djot
A relay publishes its [write price][] in its [NIP-11][] document.

Stored reads over WebSocket are free; writes go through an [ILP connector][Connector].

[NIP-11]: https://github.com/nostr-protocol/nips/blob/master/11.md
```

Publishing the same `d` again replaces your entry whole.

A merge request:

- **kind** `818`
- **content** `Added the live-feed broadcast price section`
- **tags** `[["a","30818:<target key>:relay-pricing","<ws-url>"],["e","<base id>","<ws-url>"],["p","<target key>"],["e","<your 30818 id>","<ws-url>","source"]]`
- **to** the target author's relay: a paid write

A redirect:

- **kind** `30819`
- **content** empty
- **tags** `[["d","write-cost"],["a","30818:<key>:relay-pricing","<ws-url>"]]`
- **to** another relay: a paid write

## Read

Every author's version of one topic (normalize the topic first and leave `authors` out so the relay
returns each author's current `30818` for that `d`), and any redirect from an alias:

```json
{"kinds":[30818],"#d":["relay-pricing"]}
{"kinds":[30819],"#d":["write-cost"]}
```

One author's version, and merge requests targeting it:

```json
{"kinds":[30818],"authors":["<key>"],"#d":["relay-pricing"]}
{"kinds":[818],"#a":["30818:<key>:relay-pricing"]}
```

When several keys have written on the same `d`, follow `defer` tags first, then rank entries with
`+` reactions (`nip-25.md`), your follow list (`nip-02.md`), trusted curator lists (`nip-51.md`),
and wiki relay lists (kind `10102`, `relay` tags).

## Notes

- Specification: [NIP-54](https://github.com/nostr-protocol/nips/blob/master/54.md).
- Every article revision, merge request, reaction and redirect sent to another relay is a separate
  paid write.
- Comment on an article with `nip-22.md`.
