# Tips

A tip is a payment from one person to another, made through TOON's payment layer. Three events
make it readable: a tip route, a tip receipt and a tip acknowledgement. TOON has no Lightning, so
this replaces NIP-57 zaps (`9734`, `9735`), which you never publish or count.

The NIP is a draft with no number yet. If this reference disagrees with relay's
`docs/nips/nip-tips.md` or ADR 0007 (`0007-readers-count-a-tip-only-when-its-recipient-acknowledged-it.md`)
in `toon-protocol/relay` on `main`, they win.

## Shape

An amount is a tag of three values after the name: base units, the asset code, and the scale (the
decimal places of the code's major unit):

```json
["amount", "2500000", "USDC", "6"]
```

Two amounts are in the same unit only when code and scale both match.

### Tip route

- **kind** `10850`, replaceable, signed by the recipient
- **content** empty
- **tags** `[["connector_url","<url>"],["ilp_address","<address>"],["connector_seal_key","<hex key>"]]`

It is the person's claim about where they can be tipped. Their connector confirms or contradicts it.

### Tip receipt

- **kind** `9850`, signed by the payer
- **tags** one `p` (the recipient), optional `e` or `a` (what is tipped), `amount` (what was
  sent), optional `anon`

**Never published.** It travels only sealed inside the tip's payment, to the recipient. Never
publish one, and never count one you find on a relay: it proves nothing, and it should not be there.

### Tip acknowledgement

- **kind** `9851`, signed by the recipient once the tip arrived. It is the only public tip event.
- **content** empty
- **tags** `amount` (what arrived), `receipt` (the receipt's id), optional `p` (the payer, left out
  when the payer asked for `anon`), optional `e` or `a` (what was tipped)

## Sending a tip

A tip is a payment made with your client's sending skill. It is never a publish of a `9850`.
If the sending skill does not say how to tip, the client cannot tip yet: say so, and do not
improvise.

## Read

A person's tip route; take the newest event:

```json
{"kinds":[10850],"authors":["<key>"]}
```

Tips to a person (their acknowledgements):

```json
{"kinds":[9851],"authors":["<key>"]}
```

Tips to a goal (kind `9041`):

```json
{"kinds":[9851],"#e":["<goal id>"]}
```

Tips to a bounty (kind `30402`) or a repo (kind `30617`):

```json
{"kinds":[9851],"#a":["30402:<author>:<d tag>"]}
```

```json
{"kinds":[9851],"#a":["30617:<owner>:<repo id>"]}
```

Query the relay the recipient writes to. For a goal, a bounty or a repo, keep only the
acknowledgements signed by the recipient (the goal's, bounty's or repo's owner).

## The reader rule

1. Count only `9851`s signed by the recipient. Two with the same author and the same `receipt`
   are one tip.
2. Sum the arrived amounts per unit. Never convert between units, and never sum across them. A
   goal or bounty sums in its own unit.
3. Count distinct payers only from the payers the `p` tags name. An acknowledgement without `p`
   adds to the totals but not to the payer count.

## Notes

- An acknowledgement is the recipient's word, not proof of payment. A recipient can acknowledge a
  tip that never arrived.
- A tip with no acknowledgement is not shown or counted, even if the money moved.
