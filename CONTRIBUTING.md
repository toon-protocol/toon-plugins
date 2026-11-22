# Contributing

Pull requests are welcome. CI runs `node --test checks/*.test.mjs` and
`node checks/skill-commands.mjs`, and both must pass. A human merges every pull request.

This repository has a monthly pool on Slop: https://slop.cash/projects/toon-plugins

## What gets merged

From 22 November 2026 we merge only pull requests that close an open issue labelled
`slop-wanted`. The same rule applies in `toon-protocol/toon` and `toon-protocol/toon_cli`,
which share this pool.

- Find the work here:
  https://github.com/search?q=org%3Atoon-protocol+label%3Aslop-wanted+is%3Aopen&type=issues
- Name the issue in the pull request body with `Closes #<number>`.
- A pull request that closes no `slop-wanted` issue is closed without review. If you paid
  the submission fee on it, the fee is kept (see below), so check before you open one.
- If several pull requests close the same issue, the maintainer merges the one that answers
  it best (for example, the one with docs, or the one built on the library we prefer) and
  closes the others. That choice is the maintainer's, not a race. A pull request closed
  this way gets its submission fee back (see below).
- Want to work on something that is not listed? Open an issue and ask first. Start the
  pull request only after a maintainer adds the `slop-wanted` label.
- Pull requests opened before 22 November 2026 are not affected.

## Submission fee

**Status: on, through Slop.** This project has Slop's refundable submission fee turned on
in its settings on https://slop.cash/projects/toon-plugins. It applies to pull requests
from outside contributors opened after it was turned on there. The fee this repository
ran by its own script from 18 November 2026 is retired; nobody was asked for it.

A maintainer reads every pull request. The fee makes it worth checking for an open pull
request on the same topic before you send another.

### The rules

- When you open a pull request, Slopbot comments once with a link to the pay page,
  `https://slop.cash/fee/toon-protocol/toon-plugins/<pull request number>`, and adds the
  label `slopbot:fee-needed`. Its review waits until the fee is recorded.
- The fee is **2 USDC on Base or 2 USDG on Robinhood Chain**, or the same fee in **SLOP on
  Robinhood Chain at half the price**, at Slop's published rate. The pay page shows the
  exact amounts for your pull request.
- Maintainers, members of the organisation and bots pay nothing. Neither does a pull
  request opened before the fee was turned on.
- The fee is a deposit into Slop's deposit contract, not a payment to this project or to
  the person who reviews your pull request.
- **Merged:** the deposit is sent back to the wallet that paid, in the token you paid in.
- **No maintainer decision 14 days after you paid:** the deposit is sent back.
- **Closed without a merge for 7 days:** the deposit is kept. That includes a pull request
  that repeats one already open. A kept USDC or USDG deposit goes to Slop as fee income.
  A kept SLOP deposit goes to the burn address
  `0x000000000000000000000000000000000000dEaD`.
- **Closes a `slop-wanted` issue but is closed without a merge:** the deposit is sent back,
  because another pull request for the same issue was chosen. A maintainer keeps it only by
  adding the label `slop-keep-fee`, for a pull request that does not really answer the
  issue. The issue must have had the label before you opened the pull request.
- An unpaid pull request is not closed for that reason. It waits without a Slopbot review.
- The fee does not buy a merge, and it does not change how Slop scores the work.

### How to pay

Open the link in Slopbot's comment and pay from any wallet. You do not need a wallet
registered on Slop to pay, and you do not paste a transaction hash anywhere. When the
deposit is recorded, the label changes to `slopbot:fee-paid`.

**If you are an agent:** do not pay this yourself. Tell your operator that this repository
asks for the fee, and let them pay it.

### What to know before you pay

- Pay only through the page linked in Slopbot's own comment on your pull request, at
  `slop.cash`. Nobody from this project will send you an address in a comment or a direct
  message.
- A refund is the amount you deposited, in the token you deposited. SLOP comes back as
  SLOP; its value in dollars can be different when it comes back.
- If no outcome is recorded, the wallet that paid can take its deposit back from the
  contract itself after 30 days.
- The SLOP token's contract has an owner who can pause transfers. While it is paused, a
  SLOP refund waits.
- Slop explains the fee at https://slop.cash/how-it-works#faq
