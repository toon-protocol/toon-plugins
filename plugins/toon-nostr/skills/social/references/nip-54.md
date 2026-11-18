# NIP-54: wiki articles

Encyclopedia entries on one subject, written independently by many keys under one normalized `d` tag.

## Shape

- Kind `30818` article. Addressable: `["d","<normalized topic>"]`.
- Kind `30819` redirect: an alias that points at a real article instead of repeating it.
- Kind `818` merge request: a proposed change to somebody else's article.
- `d` is the topic, normalized: lowercase, whitespace to `-`, punctuation removed, repeated `-`
  collapsed, leading and trailing `-` trimmed, non-ASCII letters kept, numbers kept.
  `"What's Up?"` becomes `whats-up`, `"Article 1"` becomes `article-1`, `"Москва"` becomes `москва`.
- `content` is **Djot**, not Markdown.
- Optional tag `["title","..."]` when the display title should differ from the `d` tag.
- A reference-style link with no target defined is a wikilink: `[proof of work][]` points at the
  article whose `d` is `proof-of-work`. Normalize the target the same way as a `d` tag.
- Mention a key as `nostr:npub...` (NIP-21).

## Publish

- **kind** `30818`
- **tags** `[["d","pricing-a-relay"],["title","Pricing a relay"]]`
- **to** another relay: a paid write
- **content**:

```djot
A relay charges for each write it accepts.

See also: [long-form content][] and [proof of work][].
```

A redirect, instead of repeating a topic under a second name:

- **kind** `30819`
- **tags** `[["d","btc"],["a","30818:<pubkey>:bitcoin","<relay url>"]]`
- **content** empty

A merge request against an existing article:

- **kind** `818`
- **tags** `[["a","30818:<destination pubkey>:bitcoin","<relay url>"],["e","<version the change was based on>","<relay url>"],["p","<destination pubkey>"],["e","<article holding the change>","<relay url>","source"]]`
- **content** why the change is worth taking

Publishing the same `d` again replaces **your** article. It never replaces another key's.

## Read

Every author's version of one topic — omit `authors` and the `#d` filter returns each key's article:

```json
{"kinds":[30818],"#d":["pricing-a-relay"]}
```

One key's version of one topic:

```json
{"kinds":[30818],"authors":["<key>"],"#d":["pricing-a-relay"]}
```

Articles by topic tag, and any redirect that points at a topic:

```json
{"kinds":[30818],"#t":["relays"],"limit":10}
{"kinds":[30819],"#a":["30818:<pubkey>:bitcoin"]}
```

## Notes

- Two keys writing the same `d` produce two separate articles. Nothing merges them, and neither
  hides the other: query `#d` without `authors` to read the whole set, then show each author.
- Do not overwrite somebody else's article. Send a `818` merge request, and accept or reject one
  aimed at you with a NIP-25 reaction carrying `+` or `-`.
- Wikilinks make a topic discoverable before anyone writes it, so a broken wikilink is a valid
  pointer, not an error.
- A whole article is sent and paid for on every revision.
