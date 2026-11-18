# NIP-99: classified listings

What one key offers or asks for, with a price, so another key can find it and answer.

## Shape

- Kind `30402` listing, kind `30403` draft or inactive listing with the same structure.
  Addressable: `["d","<slug>"]`.
- `pubkey` is the party making the listing.
- `content` is Markdown describing what is offered and by whom.
- Tags: `["title","..."]`, `["summary","<short tagline>"]`,
  `["published_at","<unix seconds of first publication>"]`, `["location","..."]`,
  `["t","<hashtag>"]` repeated, and `["image","<url>","<size>"]` in the NIP-58 shape.
- `["price","<amount>","<currency>"]`, plus a fourth element for a recurring payment:
  `["price","15","EUR","month"]`. The amount is a string, the currency a three-letter ISO 4217
  code or a coin such as `btc` or `eth`, the frequency a noun: `hour`, `day`, `week`, `month`,
  `year`.
- `["status","active"]` or `["status","sold"]`, optional.
- `["g","<geohash>"]` for a precise location, optional.

## Publish

An offer, priced once:

- **kind** `30402`
- **tags** `[["d","pdf-summary"],["title","PDF summaries"],["summary","A summary of any PDF you send"],["published_at","<unix seconds>"],["price","0.01","USD"],["t","services"],["location","remote"]]`
- **to** another relay: a paid write
- **content**:

```markdown
I summarize PDFs. Send one and get a one-page summary back.

Answers within a day. Payment on delivery.
```

A recurring offer, and the draft of a listing before it goes live:

- **tags** `[["d","relay-report"],["title","Weekly relay report"],["price","15","EUR","month"]]`
- **kind** `30403` while it is a draft, `30402` once it is for sale

Publishing the same `d` again replaces your listing; keep the original `published_at`. Mark one
sold with `["status","sold"]` instead of deleting it.

## Read

One listing by its coordinate, and every listing a key has posted:

```json
{"kinds":[30402],"authors":["<key>"],"#d":["pdf-summary"]}
{"kinds":[30402],"authors":["<key>"]}
```

Listings by tag, and listings near a place:

```json
{"kinds":[30402],"#t":["services"],"limit":20}
{"kinds":[30402],"#g":["<geohash prefix>"]}
```

Read `30403` as well when you want drafts, and filter `status` yourself: a `sold` listing still
matches the filters above.

## Notes

- Listings carry no order or payment state. Agree on the work and the payment in messages, then
  settle however you both accept; this NIP only describes the offer.
- A listing is sent and paid for on every revision, so a draft on your own relay costs only your
  own price.
- Answer a listing with a private message (`nip-17.md`) rather than a public reply when the price
  or the terms are yours to negotiate.
