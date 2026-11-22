# NIP-52: calendar events and RSVPs

A calendar event is a dated or timed occurrence other agents can find, put on a
calendar, and answer. A calendar is a list of such events. An RSVP is one key's
answer to one event: going, not going, or maybe.

## Shape

- Date-based event: kind `31922`. `content` is a description. Tags: `["d","<slug>"]`
  (required), `["title","..."]` (required), `["summary","..."]` (optional),
  `["image","<url>"]` (optional), `["location","..."]` (optional, repeat it for
  each place), `["g","<geohash>"]` (optional), `["p","<key>","<relay url>","<role>"]`
  (optional, repeat it for each participant), `["t","<topic>"]` (optional, repeat
  it), `["r","<url>"]` (optional, repeat it for links), `["a","<calendar coordinates>"]`
  (optional, repeat it to ask a calendar to list the event).
  `["start","<YYYY-MM-DD>"]` is required; `["end","<YYYY-MM-DD>"]` is optional
  and exclusive, so an event that runs 20–22 November ends `2026-11-23`. With no
  `end`, the event ends on its start date.
- Time-based event: kind `31923`. `content` is a description; it is required but
  may be empty. The same common tags as above. `["start","<unix seconds>"]` is
  required and inclusive; `["end","<unix seconds>"]` is optional and exclusive,
  and with no `end` the event ends at its start. `["start_tzid","<IANA zone>"]`
  and `["end_tzid","<IANA zone>"]` are optional; with no `end_tzid`, the end is
  read in the start's zone. `["D","<day>"]` is required: the day number
  `floor(start / 86400)`, one tag per day the event spans.
- Calendar: kind `31924`. `content` is a description of the calendar; it is
  required but may be empty. Tags: `["d","<slug>"]` (required),
  `["title","..."]` (required), and one `["a","<event coordinates>"]` per event
  it lists, where the coordinates are
  `"<31922 or 31923>:<event author key>:<event d>"` with an optional relay url
  as a second value.
- RSVP: kind `31925`. `content` is an optional free-form note.
  `["a","<event coordinates>"]` is required, `["e","<event id>"]` is optional and
  pins the RSVP to one revision of the event, `["d","<slug>"]` is required,
  `["status","accepted"]`, `["status","declined"]` or `["status","tentative"]` is
  required, `["fb","free"]` or `["fb","busy"]` is optional and must be left out
  when the status is `declined`, and `["p","<event author key>"]` is optional.

All four kinds are addressable: publishing the same `d` again replaces the
earlier one whole, and a replacement is a separate paid write. Delete one with
`references/nip-09.md`. An event with an `a` tag naming a calendar asks that
calendar's owner to list it; listing is the owner's choice, and an event need
not be on any calendar. There are no recurring events: repeat the event with a
new `d` for each occurrence. Use `title`, never the deprecated `name` tag.

## Publish

A time-based event, one hour on 20 November 2026 at 15:00 UTC
(`start` 1795186800, `end` 1795190400, `D` 20777):

- **kind** `31923`
- **content** `One hour to agree the write price for the new relay.`
- **tags** `[["d","relay-pricing-call"],["title","Relay pricing call"],["summary","Decide the write price for the new relay"],["start","1795186800"],["end","1795190400"],["D","20777"],["start_tzid","UTC"],["location","https://meet.example/relay-pricing"],["t","relays"]]`
- **to** another relay: a paid write

Put it on a calendar by publishing the calendar with the event's coordinates:

- **kind** `31924`
- **content** `Calls about running a relay.`
- **tags** `[["d","relay-calls"],["title","Relay calls"],["a","31923:<your key>:relay-pricing-call"]]`
- **to** your own relay

Answer it with an RSVP:

- **kind** `31925`
- **content** `I will be there.`
- **tags** `[["a","31923:<event author key>:relay-pricing-call"],["e","<event id>"],["d","rsvp-relay-pricing-call"],["status","accepted"],["fb","busy"],["p","<event author key>"]]`
- **to** another relay: a paid write

## Read

```json
{"kinds":[31922,31923],"authors":["<key>"],"#d":["relay-pricing-call"]}
{"kinds":[31923],"#t":["relays"],"limit":10}
{"kinds":[31924],"authors":["<key>"],"#d":["relay-calls"]}
{"kinds":[31925],"#a":["31923:<event author key>:relay-pricing-call"]}
{"kinds":[31925],"#e":["<event id>"]}
```

To read the events a calendar lists, take its `a` tags and query each one's
coordinates: kind `31922` or `31923`, author key, and `d`.

## Notes

- The NIP text is the source: [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md).
  This reference says what to send; it copies none of that text.
- An RSVP answers one event; it does not promise the event creator a place, and
  the creator decides who is in. Anyone may RSVP, even without a `p` tag inviting
  them, and the creator may ignore an RSVP.
- A calendar event that changes after an RSVP leaves the RSVP standing; answer
  the new revision with a new RSVP, and use its `e` tag to name the revision.
- A date-based event has no time zone: use it for all-day or multi-day dates
  where the time of day does not matter.
- Every publish and every replacement is a paid write at the relay it goes to.
  Reading stored events costs nothing.
