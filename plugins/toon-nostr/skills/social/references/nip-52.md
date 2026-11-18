# NIP-52: calendar events

Events with a date or a time, the calendars that group them, and the RSVPs that answer an invitation.

## Shape

- Kind `31923` time-based event: `start` and `end` are Unix seconds, with optional `start_tzid` and
  `end_tzid` naming an IANA zone such as `America/Costa_Rica`.
- Kind `31922` date-based event: `start` and `end` are `YYYY-MM-DD`, for all-day or multi-day
  occasions where the clock and the zone do not matter.
- Kind `31924` calendar: an addressable list that references events with `a` tags.
- Kind `31925` RSVP: one key's answer to one event.
- All four are addressable: `["d","<unique id you generate>"]`.
- Common tags: `title` (required), `summary`, `image`, `location` (repeated), `g`
  (a geohash), `t` (repeated hashtag), `r` (repeated link), `p` (a participant, with an optional
  relay and role).
- `content` is a description in plain text.
- A `31923` event also carries `D`, the day-granularity marker `floor(start / 86400)`, repeated to
  cover every day of the event, so a client can find it by day.
- An event joins a calendar by referencing it: `["a","31924:<calendar author>:<calendar d>"]` on
  the event. The calendar's owner decides whether to list it back.

## Publish

A time-based event, one hour long:

- **kind** `31923`
- **tags** `[["d","weekly-relay-review"],["title","Weekly relay review"],["start","<unix seconds>"],["end","<unix seconds>"],["start_tzid","Europe/Berlin"],["D","<floor(start / 86400)>"],["t","relays"],["p","<invited key>"]]`
- **to** another relay: a paid write
- **content**: `We read the week's relay changes and pick what to ship.`

An RSVP to that event:

- **kind** `31925`
- **tags** `[["d","<unique id you generate>"],["a","31923:<event author>:weekly-relay-review","<relay url>"],["e","<event id>","<relay url>"],["status","accepted"],["fb","busy"],["p","<event author>"]]`
- **content** optional, a free-form note

`status` is `accepted`, `declined` or `tentative`. `fb` is `free` or `busy`, and it is left out when
the answer is `declined`.

For an all-day occasion use kind `31922` and swap the timestamps for dates:

- **tags** `[["d","release-week"],["title","Release week"],["start","<YYYY-MM-DD>"],["end","<YYYY-MM-DD>"]]`

`start` is inclusive and `end` is exclusive: an omitted `end` means the event ends the same day.

## Read

Everything on one day, and one event by its coordinate:

```json
{"kinds":[31923],"#D":["<floor(unix seconds / 86400)>"]}
{"kinds":[31923,31922],"authors":["<key>"],"#d":["weekly-relay-review"]}
```

The events in a calendar:

```json
{"kinds":[31924],"authors":["<calendar author>"],"#d":["work"]}
```

Every answer to one event, and one key's own answer:

```json
{"kinds":[31925],"#a":["31923:<event author>:weekly-relay-review"]}
{"kinds":[31925],"authors":["<key>"],"#a":["31923:<event author>:weekly-relay-review"]}
```

## Notes

- Publishing the same `d` again replaces your event, so a new `d` makes a new event and an edit
  keeps the old one addressable.
- Anybody may answer an event, invited or not; this NIP does not say who may attend, so the event's
  author decides what an RSVP means.
- An RSVP carrying an `e` tag answers that revision of the event. Without it the answer applies to
  the event as it stands.
- Invite somebody by tagging their key with `p` on the event; answer an invitation by tagging the
  author with `p` on the RSVP.
- A whole event is sent and paid for on every revision, like any other write.
