# Encharge build specs — the format

**v0.9 · 2026-10-20 · CONTRACT between the email set and the Encharge builder**

*For the email-set session (Project VDH EMAIL Sequences) and the builder (`vdh-encharge-builder`, Project VDH Product & Arch). The email set exports its flows in this format. The builder turns them into Encharge's own calls and builds drafts that arrive **switched off**; Joe reviews each one and switches it on. The format uses the Build tab's own words, and Encharge's words for conditions. The builder refuses a spec that breaks a rule, and says why. Joe relays this file between the two sessions. Builder v1.09 carries this version as `references/spec-format.md`; the Project copy is `encharge-api/Encharge-Spec-Format-for-Claude-v0_8.md`, which replaces v0_7.*

> **v0.9 (2026-10-20, builder v1.11): each step's keys are checked (P21).** A step the builder builds takes only `key`, `op`, the fields section 2 gives its type, and where it goes (`next`, or `yes` and `no` for a CHECK); any other key is refused, naming the step and the key, as a flow's settings are since v0.8 (a misspelt `onBounce` or `duplicatSend` used to be ignored, losing the bounce path or the repeat send). Rows that are not Encharge steps (HOLD, EXITS, …) are prose, and not checked. Every flow of the v50 and v55 exports, and every test spec, already passes. Also: the router-field list lives in `guard.js` alone since builder v1.10, which the compiler reads (section 2, SET FIELD).
>
> **v0.8 (2026-10-20, builder v1.09): two settings rules the builder now enforces, and `emailCheck`.** A flow's `settings` holds only `reentry` and `duplicateSend`; any other key is refused, naming it (a misspelt `reEntry` used to be ignored, giving the default re-entry: P16). `duplicateSend`, in the settings or on a SEND step, is `true` or `false`, never text (`"false"` used to read as true: P15). Every flow of v55 already follows both. Section 4.2: after a Send Test or a hand edit rewrites `&emsp;` and `&#8203;`, `emailCheck`'s `ok` stays true (P12). Nothing else changes; the plans v55 compiles to are v1.08's, call for call.
>
> **v0.7 (2026-10-20, builder v1.08, documents only): section 4 is the email format as proven.** It replaces the draft that waited for the master (`heading`, `text`, `button`, `ps`), which builder v1.07 already refused. What it holds was proven at the master template test (28 Sep), at build sitting 2a (19 and 20 Oct) and at build sitting 2b (20 Oct), each rule marked with what proved it: the five keys and the two swaps, with their paths written with dots; the letter in one HTML block, every paragraph with its own styles; the name rule; single quotes for Liquid in a link; the square padded button between its 16 px and 32 px spacers (decision 133); list pattern A (`vdh-ul`). **The builder side writes section 4** (`references/gaps.md`, C4, closed at v1.08); the email set writes its letters to it, as its v54 and v55 already do. v0.7 also takes in the Project copy's revision of 30 Sep (below): `LastLoginDate` and `LoginCount` are written by WP Fusion, not by FlowMattic's routers (sections 1 and 2). Nothing else changes, and no compile changes: the compiler is v1.07's, and v55 compiles as it did at sitting 2b.
>
> **v0.6, revised 2026-09-30 (the Project copy; the builder's copy took it in at v0.7): who writes two of the protected fields, and section 4 marked stale.** `LastLoginDate` and `LoginCount` are written by WP Fusion on each WordPress login, not by FlowMattic's routers (skill `vdh-architecture`, `access.md` § WPF → Encharge field sync policy; FlowMattic's three workflows, read on 2026-09-30, map neither). The rule for them is unchanged: the builder never creates them, and a Set field on one needs Joe's express permission; the builder calls all twelve "router fields". Section 4's email shape is refused by builder v1.07; until v0.7 replaces section 4, write each email as the master template test's section 8 gives it. The note below says sections 1 and 3: the list is in sections 1 and 2.
>
> **v0.6, revised 2026-09-29 (builder v1.04): the router-field list only.** For the attribution design, `first_source` and `first_dm` become `first_channel` and `first_touch_id`, and `first_purchase_at` and `last_purchase_at` join the list; `first_hack` stays (sections 1 and 3). Joe creates the five in Encharge by hand; a spec never creates one, and a Set field on one needs his express permission. Nothing else changes, and the v50 export names none of the six.
>
> **v0.6 (2026-09-27), after an independent review of builder v1.01, and the reviews of its fixes.** Nothing in the format changes, and in the v50 export nothing compiles differently except the objects plan and the flow naming a router field:
> - **The Abandoners edit waits for the switch-over.** An edit to Encharge segment Abandoners (active last 24h) (`abandoners_active_24h`, 1059368), however it is named, is left out of the ordinary objects plan, which says so (`leftForSwitchOver`) and uses no permission for it. The builder makes it inside the switch-over only (decision D1: after Joe has switched off Encharge flow Abandoned Cart Email Sending Sequence, step 1, and before he switches on Checkout Abandon, step 5), in a plan of its own that first reads both flows and stops, nothing written, unless Encharge says each is off. The manifest keeps the edit as it is: no copy without it is needed.
> - **Permissions** (Joe's, for what the rules reserve to him) carry his own words in the chat and the date he gave them; a note in brackets or a test's words are not his, and the builder refuses them.
> - **Router fields:** a field the FlowMattic routers write is never created by the builder, which refuses the objects plan, and any flow naming such a field, while the account lacks it. The v50 manifest lists two, `requested_template_name` and `requested_template_url`, in `shared.fields`: before the build, Joe makes them by hand in Encharge as Text fields, or the email set moves them out of `shared` (builder gap C5).
> - **What the builder returns** (section 5) adds each plan's provenance (the builder's version, and the SHA-256 of every input: the specs, the manifest, the ledger, the account's fields and tags) and the edits left for the switch-over.

> **v0.5 (2026-09-26), after an independent review of builder v1.00, and the reviews of its fixes.** In the v50 export, only the status rule changes anything: its parked flows are refused, and one of them, the Bundle's lane cleanup, compiled before.
> - **Keys** (a flow's, each step's, and each email's and segment's in the manifest) are letters, digits, `_` and `-` only, and a step key may not end in `__` and a number (`c__2`): the builder names the checks it adds, when it splits a CHECK with nested groups, after the CHECK's own key that way. A key like `c2` or `c_2` is fine.
> - **`["tagGroup", "<group>", "none"]` means none of the group's tags wherever it stands.** Inside an `any` it stays one group of its own: a CHECK becomes a chain of checks with that meaning, and a segment, which cannot nest, is refused unless the group holds one tag (make the group its own segment). Before builder v1.01 it was merged into the `any`, which meant "lacks at least one".
> - **A manifest field the account already has** is used as it is, not created: it must have the manifest's type (`text` or `date`) and be writable, or the manifest is refused. A field that is not there yet is created with the manifest's type. A SET FIELD on a field the account holds read-only is refused.
> - **Statuses:** the builder builds `ship` and `gated` flows. A `parked` flow is refused (it compiles only for a dry run, and such a plan is never run); so is any other status, except `test` (or none) on the builder's own test flows, whose names carry ZZ. Where the manifest and a spec both give a flow's status, they must agree.
> - **A group** may not hold one flow key, or one flow name, twice; and the manifest's `shared` block lists each field, tag, email and segment once (two entries would make two objects under one key).
> - **An object the builder's ledger marks deleted or failed** (Joe deleted it, or it is a failed draft on his delete list) is never named again, by key, by name or by Encharge ID, unless the same build makes it anew; and a flow or email the ledger holds live is not built again under its key until Joe agrees the old one is superseded. Such a refusal is the builder's to settle with Joe, not the email set's.

> **v0.4 (2026-09-25), after the live tests (all passed):**
> - **`onBounced` on SEND** (gap A13, closed): the key of the step a bounced email goes to. The builder draws it as a link of its own out of the Send email step, carrying only *On bounced*, exactly as Encharge stored one Joe drew by hand. It must lead somewhere other than `next`. `"onBounced": null`, like `next: null`, means no such path.
> - **`later` and `note` in the manifest**, as the email set uses them. `later` holds parked flows' fields, tags, segments and edits; the builder never compiles it. `note` is prose and is ignored.
> - **A value still to be decided** (`"TBD"`, or `"TBD:<name>"` such as `"TBD:pack_product_id"`) may sit only in `later`. Anywhere else in a manifest, a spec or the tag groups it is refused, with its path. Prose under a `note` or `notes` key may say TBD, and so may the text of a row the builder does not build (HOLD, EXITS…).
> - **Tags:** given the account's tags, the builder does not create one that exists, and names those it skipped in one line. Every tag a flow or segment uses must then exist, be created by the manifest's `shared` block, or be in the builder's ledger. A product or refund tag not live yet (FlowMattic creates it at go-live) compiles with a warning. A tag only in `later` is refused ("un-park it first"), and so is a tag found nowhere: usually a misspelling. Fields in `later` get the same message.
> - **Gap A12 is closed for segments** (live test B3): a segment row `"1"` found all 18 contacts with the value 1, whichever writer stored it. The Abandoners edit now compiles, with Joe's permission. A `"1"` row in a CHECK still carries its warning, until the switch-over's test abandon shows a check matches too.
> - **Names:** Encharge keeps `·`, `→` and `+` in a flow's name and in the API name it freezes (live test B1). Names stay as written (decision 117).
> - **Editor flags** (question 2): Encharge stored the flags the builder sent on all five step types test B5 built, as on the four capture 1 saw, so the per-step warning is gone; the builder checks the stored flags after each build.
> - **Parked segments:** a flow's Entered segment, or a segment row, naming a segment only in `later` is refused like a parked tag or field; one the builder knows nowhere compiles with a warning, and the run then stops before its first call if nothing provides it.
> - **Shapes:** a `later` or `shared` block of the wrong shape is refused with a plain message. `later.fields` may list bare names. New tag names are snake_case, like field names.
> - **Emails** (live test B4): a text to swap is found in the master as written or as the editor writes it (a non-breaking space as `&nbsp;`), exactly once in all (section 4). Encharge stores an email exactly as sent, and the builder checks each one against what it sent and against the master with the swaps made.

> **v0.3 (2026-09-24):** `empty` now works on Date fields and `filled` on Text fields (gap A10, closed), so "`last_pitch_at` is empty or more than 1 day ago" is `["field", "last_pitch_at", "emptyOrOlderThanDays", 1]`, and "both filled" is two `filled` rows. A Text field takes text, numbers included: write `"1"`, in quotes, as the app stores it. A bare `1` is refused. Three forms wait for gap A11, and no v47 flow is known to need them: `empty` on a Text field in a segment, `filled` on a Date field, and either test on a field Joe did not create (built-in fields such as `email` or `firstName`, and system or integration fields). The Abandoners row is written as `"1"`; the builder refuses the edit until live test B3 shows that the text `"1"` finds the right people (gap A12).
> **v0.2 (2026-09-23):** `moreThan` (Number fields) and `in` (segments) are proven. The test is named after Encharge's own menu: *more than*, not *greater than* (Joe). Segment edits can now remove rows as well as add them, as v47's edit to Abandoners (active last 24h) needs. Existing segments have agreed keys (section 1). Each test is allowed only on the field types Encharge has been seen storing it on (section 3). Three things v47 needs wait for gap A10: `empty` on a Date field, `filled`, and a number on a Text field. A segment row inside a CHECK waits for gap A9; no v47 check needs one.
> **v0.1 (2026-09-23):** first version.

**The email set supplies:** a manifest, one spec per flow, the tag groups, and each email's copy.
**It never supplies:** Encharge IDs, canvas positions, or schemas. The builder gets those from Encharge.

---

## 1. The files

| File | Holds |
|---|---|
| `manifest.json` | the objects shared by every flow (fields, tags, emails, segments, edits to existing segments), then the flows in build order |
| `<flow>.json` | one flow: identity, settings, trigger, steps in run order, notes |
| `tag-groups.json` | the flow map's `tagGroups`, e.g. `{"template_pack_owner": ["product_canva_templates_1", "…"]}` |

**Everything is in build order: fields → tags → emails → segments → flows.** Each depends only on those before it.

### Manifest

```json
{
  "emailSet": "v47",
  "note": "prose for the reader; ignored by the builder",
  "shared": {
    "fields":   [ { "name": "last_pitch_at", "type": "date" }, { "name": "flow_lane_library", "type": "text" } ],
    "tags":     [ "in_flow_checkout_abandon", "recovered_user" ],
    "emails":   [ { "key": "checkout_abandon_1", "name": "Checkout Abandon 1", "subject": "…", "master": "vdh_master_letter",
                    "swaps": [ { "path": "body.values.preheaderText", "html": "…" },
                               { "path": "body.rows.0.columns.0.contents.1.values.html", "html": "…" } ] } ],
    "segments": [ { "key": "library_sales_audience", "name": "Library sales broadcast audience",
                    "if": { "all": [ ["segment", "people_not_in_flow", "in"], ["tag", "product_canva_hacks_library", "absent"] ] } } ],
    "segmentEdits": [
      { "segment": "people_in_flow", "addRows": [ ["tag", "in_flow_checkout_abandon", "present"] ] },
      { "segment": "abandoners_active_24h",
        "removeRows": [ ["segment", "has_any_product", "notIn"] ],
        "addRows": [ ["tag", "product_canva_hacks_library", "absent"], ["field", "mostrecent_abandonedproduct_id", "is", "1"] ] }
    ]
  },
  "flows": [
    { "key": "lane_cleanup_library", "file": "lane-cleanup-library.json", "status": "ship" },
    { "key": "checkout_abandon", "file": "checkout-abandon.json", "status": "ship" },
    { "key": "lw_fonts", "file": "lw-fonts.json", "status": "gated", "group": "exclusive_leads" }
  ],
  "later": {
    "tags": [ "in_flow_pack_abandon" ],
    "segments": [ { "key": "pack_abandoners_active_24h", "name": "Pack abandoners (active last 24h)",
                    "if": { "all": [ ["field", "mostrecent_abandonedproduct_id", "is", "TBD:pack_product_id"] ] } } ]
  }
}
```

- **Fields** are `text` or `date`, with snake_case names. A field the account already has must be of the same type, and writable (v0.5). A field another system writes is never created by the builder: it must be in the account already, or the manifest is refused (v0.6). FlowMattic's routers write `mostrecent_abandoned_at`, `mostrecent_abandonedproduct_id`, `mostrecent_abandonedproduct_name`, `first_channel`, `first_touch_id`, `first_hack`, `first_purchase_at`, `last_purchase_at`, `requested_template_name` and `requested_template_url`; WP Fusion writes `LastLoginDate` and `LoginCount` (twelve since builder v1.04, which calls them all router fields).
- **Tags** are names only, snake_case. Product and refund tags are not created here: FlowMattic's routing creates them when a product goes live. Keep listing a tag the account already has: the builder skips it.
- **Emails** are copies of the master with two swaps, in the shape of section 4. Only finished emails go in `shared.emails` (v55: those of flows not parked, with every link known and no placeholder left).
- **Segments** are new segments, with keys of their own. A segment that another uses as a row comes first. A copy of an existing segment, such as Pack abandoners (active last 24h), is a new segment with all its rows written out.
- **`segmentEdits`** change a segment that already exists: `removeRows` first, then `addRows`. Rows not named are kept. A row to remove must match exactly one row of the segment. The builder simulates every edit before it changes any live segment, so if one would fail, none is made. One edit per segment. A segment cannot contain itself, and segments cannot name each other in a loop, counting the rows they already have. Every edit needs Joe's express permission. (The Abandoners row `mostrecent_abandonedproduct_id is "1"` above compiles since live test B3 closed gap A12 for segments. Since builder v1.02 an edit to Abandoners is made only inside the switch-over, in a plan of its own; the ordinary objects plan leaves it out and says so.)
- **Flows** that end each other share a `group`: the builder creates all their shells before any step names another flow. Each flow is in a group once, with a name of its own (v0.5).
- **`status`** is the map's own (`ship`, `gated`, `parked`), in the manifest and in each spec's `flow`, the same in both where both give it. The builder builds only what Joe asks for, and only `ship` and `gated` flows (v0.5).
- **`later`** holds a parked flow's objects until it un-parks: `fields`, `tags`, `segments`, `segmentEdits`. The builder never compiles it, and a flow or segment that needs a field, tag or segment only in `later` is refused until it moves to `shared`. `later` is the one place a value may still be `"TBD"` or `"TBD:<name>"`.
- **`note`** is prose, ignored by the builder.

**Existing Encharge segments, by key.** The builder's ledger maps each key to its Encharge ID.

| Key | Encharge segment |
|---|---|
| `people_in_flow` | People IN FLOW |
| `people_not_in_flow` | People NOT IN FLOW |
| `has_any_product` | Has ANY Product (All Tools) |
| `refunded_any` | Refunded Any |
| `abandoners_active_24h` | Abandoners (active last 24h) |
| `abandoners_historic` | Abandoners (historic) |

### Spec — one per flow

Keys are in the order a person reads a flow: **identity → settings → trigger → steps in run order → notes.**

```json
{
  "spec": 1,
  "flow": { "key": "checkout_abandon", "name": "Checkout Abandon", "status": "ship" },
  "settings": { "reentry": "per30d", "duplicateSend": true },
  "trigger": { "key": "t1", "op": "ENTERED SEGMENT", "segment": "abandoners_active_24h", "next": "c1" },
  "steps": [
    { "key": "c1", "op": "CHECK", "if": { "all": [["tag", "product_canva_hacks_library", "absent"]] }, "yes": "w1", "no": null },
    { "key": "w1", "op": "WAIT", "hours": 1, "next": "a1" },
    { "key": "a1", "op": "ADD TAG", "tags": ["in_flow_checkout_abandon"], "next": "f1" },
    { "key": "f1", "op": "SET FIELD", "field": "last_pitch_at", "value": "{% now %}", "next": "s1" },
    { "key": "s1", "op": "SEND", "email": "checkout_abandon_1", "next": null },
    { "key": "h1", "op": "HOLD", "text": "Library sales broadcasts skip this person for 180 days" }
  ],
  "notes": [ { "type": "note", "text": "Checkout Abandon · v47", "near": "t1" } ]
}
```

(The example is shortened: the real Checkout Abandon has more steps. Keys like `t1` are yours to choose; they only need to be unique within the flow, be letters, digits, `_` and `-`, and not end in `__` and a number, such as `c__2` (v0.5).)

**Rules:**
- **Steps are one list in run order.** The main path comes first, and each check's else-branch follows straight after its check.
- **Every step says where it goes next:** `next`, or `yes` and `no` for a check. `null` ends that path. Several steps may lead to the same step (a join); no loops.
- **Name things by key,** never by Encharge ID: emails by their stable key (`checkout_abandon_1`); new segments, flows and fields by key; existing segments by the keys above.
- **Names are final for the builder.** Encharge freezes a flow's API name when it is created, and the builder never renames. Encharge keeps `·`, `→` and `+` in both (live test B1, 2026-09-25). Joe may rename the **display name** later in Encharge (he renamed ten flows on 2026-10-23); the API name stays as built, so the two can differ. A spec's `flow.name` is the display name the flow is created with; every flow is found by its Encharge ID and its key, never by a name.
- **`settings`** holds only `reentry` and `duplicateSend`; any other key is refused, naming it (v0.8).
- **Each step holds only its own keys** (v0.9): `key`, `op`, the fields section 2 gives its type, and `next` (or `yes` and `no` for a CHECK, which takes no `next`). Any other key on a step the builder builds is refused, naming the step and the key. Rows that are not Encharge steps are not checked.
- **`reentry`:** `"always"` (Encharge's default), `"once"`, or `"per30d"`.
- **`duplicateSend: true`** switches on *People can receive email more than once* for every email in a flow that people can re-enter. Without it a second run stalls at the first email, and the builder warns. It is `true` or `false` (JSON's own, not in quotes), in the settings and on a SEND step alike; anything else is refused (v0.8).
- **Rows that are not Encharge steps** (HOLD, EXITS, GREETING, LINKS, TEST, WATCH, FLOWMATTIC, AIRTABLE, MAKE, KADENCE, CACHE, DM CHAMP, SEGMENT, SETTING, EXCLUSIVE, FIELD, SOURCE, ENCHARGE) may sit in `steps` with their `text`. The builder lists them for Joe and builds nothing for them. No step may point to one.
- **A value still to be decided** (`"TBD"`, `"TBD:<name>"`) is refused anywhere in a spec. Prose under `note` or `notes` may say TBD, and so may the text of a row that is not an Encharge step.

---

## 2. Step types and their fields

| `op` (the Build tab's word) | Fields | Notes |
|---|---|---|
| `TAG ADDED` (trigger) | `tag` | starts the flow when the tag is added |
| `ENTERED SEGMENT` (trigger) | `segment`; `includePeople` (default `"future"`) | `"currentAndFuture"` enrolls everyone already in the segment the moment Joe switches the flow on, so it needs his express permission |
| `EVENT` (trigger) | `name`; `filterProperties`: `[{"condition": "is", "propertyName": "…", "propertyValue": "…"}]` | |
| `WAIT` | exactly one of `minutes`, `hours`, `days` (a whole number) | |
| `ADD TAG`, `REMOVE TAG` | `tags`: `[…]` (or one tag as `tag`: `"…"`, which the builder has always taken) | `product_*`, `refunded_*` and `abandoned_active` change site access and need Joe's express permission |
| `SET FIELD` | `field`, `value` | Liquid allowed, e.g. `{% now %}` or `{{person.firstName \| capitalize}}`. Fields FlowMattic's routers or WP Fusion write need Joe's express permission. The builder knows them by a list, not a pattern: `mostrecent_abandoned_at`, `mostrecent_abandonedproduct_id`, `mostrecent_abandonedproduct_name`, `first_channel`, `first_touch_id`, `first_hack`, `first_purchase_at`, `last_purchase_at`, `requested_template_name`, `requested_template_url`, `LoginCount`, `LastLoginDate` (WP Fusion writes the last two, on each WordPress login). A new such field is added to that list in `guard.js` before a spec uses it (since builder v1.10 the compiler reads the list from there) |
| `SEND` | `email` (its key); optional `duplicateSend` to override the flow's setting; optional `onBounced` (a step key) | the email must exist first (section 4). `next` leaves *On delivered*. `onBounced` is a link of its own, carrying only *On bounced*, to another step than `next` |
| `CHECK` (also `FILTER`) | `if` (a condition, section 3), `yes`, `no` | the `no` branch is the else-branch. Its rows are tags and fields: a segment row inside a CHECK waits for gap A9 |
| `END` | `flow`: `"self"`, or the key of another flow in the same `group`; `next` (null) | one END step per flow ended. Ending a flow outside the build needs Joe's express permission |
| `LIVE FLOW` | — | refused. Editing a live flow needs Joe's express permission; build the flow new instead |

---

## 3. Conditions

A condition is `all` or `any` of rules. A rule reads **subject, name, test, value**:

```json
{ "all": [
  ["tag", "product_canva_hacks_library", "absent"],
  ["field", "flow_lane_pack", "is", "library_to_pack"],
  ["field", "LoginCount", "moreThan", 0],
  ["field", "last_pitch_at", "emptyOrOlderThanDays", 1],
  ["tagGroup", "template_pack_owner", "none"]
] }
```

(Every row here compiles. `emptyOrOlderThanDays` on the Date field `last_pitch_at` is v47's "empty or more than 1 day ago".)

In a segment, a row can also name another segment: `["segment", "people_not_in_flow", "in"]` or `["segment", "has_any_product", "notIn"]`.

| Test | Means | Status in Encharge |
|---|---|---|
| `present` / `absent` (tag) | has / hasn't the tag | proven |
| `is` / `isNot` (Text or True/False field) | equals / differs from the value | proven. On a Text field the value is text: write a number in quotes, `"1"` |
| `empty` (Text or Date field) | blank | proven, on your own fields: on a Date field anywhere, on a Text field in a CHECK. In a segment, `empty` on a Text field waits for gap A11 |
| `filled` (Text field) | has a value | proven, on your own fields. On a Date field it waits for gap A11 |
| `olderThanDays` / `withinDays` (Date field) | more than N days ago / within the last N days | proven |
| `moreThan` (Number field) | above the number. Encharge's menu says *more than* | proven |
| `emptyOrIs` (Text field); `emptyOrOlderThanDays` (Date field) | shorthands for an `any` of the two | proven; `emptyOrIs` in a CHECK only, as its `empty` half is. The builder expands both |
| `in` / `notIn` (segment) | inside / outside the segment | proven in segments; not yet in a CHECK (gap A9) |
| `any` / `none` (tagGroup) | has at least one / none of the group's tags | proven (the builder expands them into tag rows: `any` as an OR group, `none` as an AND group of *has not* rows, each merged into its parent only where that keeps the meaning; v0.5) |

**Encharge's menu for a Number field** (Joe's screenshot of `LoginCount`, 2026-09-23): *more than, less than, at least, is, is not, is empty, is not empty, is any, is any of, is not any of*. On a Number field only *more than* is proven. The rest wait for gap A7c, and no v47 flow needs them. In the Build tab, write "LoginCount is more than 0", not "greater than".

**Each test works only on the field types Encharge has been seen storing it on.** The builder refuses the rest and names the gap. It reads the account's fields to know each field's type.
- A Text field takes `is`, `isNot`, `filled`, and `empty` in a CHECK. Its value is text, numbers included: write `"1"`, in quotes, because that is how the app stores a number typed on a Text field. A bare `1` is refused, with that fix. In a segment, the text `"1"` finds every contact with the value 1, whichever writer stored it (gap A12, closed for segments by live test B3). In a CHECK it still carries a warning, until a run with a test contact shows a check matches too (Checkout Abandon's switch-over test). On 20 Oct a test flow showed it does for values entered in Encharge (a contact made by hand with the value 1 went down *Yes*, one without it down *No*); a value FlowMattic writes is checked first at the switch-over (`references/gaps.md`, A12).
- A True/False field takes `is` and `isNot`, with `true` or `false`.
- A Number field takes `moreThan`, with a number.
- A Date field takes `olderThanDays` and `withinDays`, with a whole number of days, and `empty`.
- `empty` and `filled` work on fields created in Encharge by a user (every VDH field the email set adds), not on built-in, system or integration fields such as `email`, `firstName` or `shipping_address_zip` (gap A11).

**Encharge conditions are one level deep:** each check or segment is a single All/Any list. A child group with its parent's operator, or with a single rule, is merged into its parent, so it stays one level. A CHECK may still nest `all` and `any`, and the builder turns it into a chain of checks with the same meaning. A segment may not nest: make the inner group its own segment, list it first, and use it as a row, `["segment", "<its key>", "in"]`. An empty `all` or `any` is refused.

**Encharge cannot count tags.** "Has 2 or more Pack tags" needs another route; say what is wanted, and the builder side proposes one.

---

## 4. Emails

*v0.7 (2026-10-20) replaces the draft that waited for the master. The builder side writes this section (`references/gaps.md`, C4); the email set writes its letters to it. Each rule says what proved it: the master template test (28 Sep), build sitting 2a (19 and 20 Oct) or build sitting 2b (20 Oct). PROVEN means read back from Encharge or seen in a delivered email's source; RECORDED, Joe's report or screenshot; UNVERIFIED, not tested.*

Every email is a copy of the master, Encharge email VDH Master · Letter (488125, ledger key `vdh_master_letter`), with two swaps: the preview text and the letter. The master holds four blocks, the logo, one HTML block holding `LETTER GOES HERE`, a divider and the footer, and the preview text `PREVIEW TEXT GOES HERE`. The logo, the divider and the footer are never swapped: a change to them is made in the master, and the builder's ledger notes each one.

### 4.1 The shape

```json
{ "key": "checkout_abandon_1",
  "name": "Checkout Abandon 1",
  "subject": "Did you forget the Canva Hacks Library?",
  "master": "vdh_master_letter",
  "swaps": [
    { "path": "body.values.preheaderText", "html": "Watermark removal, letter frames, glass panels and more." },
    { "path": "body.rows.0.columns.0.contents.1.values.html", "html": "<p style=\"…\">{% assign fn = … %}Hi …,</p><p style=\"…\">…</p>…" }
  ] }
```

- **Exactly these five keys,** and each swap exactly a `path` and an `html`, both text. Since builder v1.07 the compiler refuses anything else (the old draft's `heading`, `text`, `button` and `ps` among it), an email with no swaps, and a name, subject or master of the wrong kind, naming the email and what is wrong (P7). The email set's own list of every letter (`emails.json` in v55) may carry more keys (`flow`, `status`, `ready`, `missing`): only the manifest's `shared.emails` reaches the builder, and only in this shape. PROVEN: v54's and v55's emails compiled in it and were built exact (sittings 2a and 2b).
- **`key`** is the stable key the specs' SEND steps name the email by (letters, digits, `_` and `-`; v0.5). **`name`** is its display name in Encharge and **`subject`** its subject line, both text, not empty.
- **`master`** is the ledger key `vdh_master_letter` (a test may give the Encharge ID as a JSON number). A key the ledger does not hold compiles without a warning, and its run stops before its first call (`references/gaps.md`, P10, planned).
- **The two paths, written with dots:** `body.values.preheaderText` for the preview text, and `body.rows.0.columns.0.contents.1.values.html` for the letter (row 1, block 2 of the master). PROVEN: read back at master version 449957 (19 Oct) and again at 450981 (20 Oct), each placeholder once in the HTML (sitting 2a). Builder v1.07 also takes the bracket form, `body.rows[0].columns[0].contents[1].values.html`, and reaches the same block (offline, 19 Oct); the format writes dots, as v54 and v55 do and as every email of sittings 2a and 2b was built. The page's `masterCheck` reports the bracket form.
- **The preview text** is plain text. Encharge writes it once into the HTML, in a hidden cell at the top of the body (gap A15; master test).
- **A swap replaces the whole value stored at its path,** in the design and in the HTML (API map, section 5). So the letter is the whole block, never nested inside the placeholder's paragraph. PROVEN, master test.

### 4.2 The letter

**One HTML block holds the whole letter:** the greeting, the paragraphs, any list, the button, the sign-off and any P.S. Why an HTML block: when someone edits a Text block's letter by hand, Encharge's editor rewrites its styles (the button lost its size and bold; nine paragraphs lost `font-size: 16px`), while an HTML block kept everything but the edited word. PROVEN: master test (Text block: ZZ Master Letter Test, 488131; HTML block: ZZ Master Letter HTML Test, 488140); again on the changed master at sitting 2a (Joe's one-word edit of a ZZ letter, version 450041).

**Every element carries its own styles,** because an HTML block adds none: it writes the letter inside a plain `<div>` (PROVEN, master test). As v55 writes them:

| Element | Written |
|---|---|
| A paragraph | `<p style="margin: 0 0 16px; font-family: helvetica,arial,sans-serif; font-size: 16px; line-height: 160%; color: #2b2b2b;">…</p>` |
| The last paragraph: the sign-off, or the P.S. after it | the same, with `margin: 0` |
| The sign-off | the closing, `<br>`, then the name (`All the best,<br>Joe`), in the last paragraph; when a P.S. follows, the sign-off's paragraph keeps `margin: 0 0 16px` |
| A heading in the letter | a paragraph whose text is `<strong>…</strong>` |
| A link in the text | `<a href="…" target="_blank" style="color: #933bc9; text-decoration: underline;">…</a>` |

PROVEN, built exact at sitting 2b in Checkout Abandon 1 to 3: the paragraph, the last paragraph, the sign-off, headings (Checkout Abandon 2), the button and the list; a ZZ copy of Checkout Abandon 1 was delivered to Gmail, Outlook.com and iCloud at sitting 2a. A P.S. and a link in the text are written the same way in v55's other letters, not built yet.

**The greeting is the name rule,** at the start of the first paragraph, word for word:

```
{% assign fn = person.firstName | strip %}{% assign up = fn | upcase %}Hi {% if fn == blank %}there{% elsif fn == up %}{{ fn | capitalize }}{% else %}{{ fn | slice: 0 | upcase }}{{ fn | slice: 1, 100 }}{% endif %},
```

- It replaces `capitalize`, which lowercases the rest of a name ("Joer Test" became "Joer test", so "McDonald" would become "Mcdonald"; master test). The rule keeps a name as typed, with its first letter in capitals; a name typed all in capitals becomes a capital and lower case; no name gives "there".
- In Encharge's own Liquid, Send Test to three contacts gave "Hi McH," (first name mcH), "Hi Joe," (JOE) and "Hi there," (none), with no Liquid left in the delivered source. PROVEN, sitting 2a. Side effects, accepted: "anne-marie" gives "Anne-marie", "O'NEIL" gives "O'neil".
- Send Test fills Liquid in from the recipient's own Encharge contact, so testing a name needs a contact at that address with that first name (PROVEN: master test; sitting 2a).

**Liquid inside a link uses single quotes,** since the link's `href` is in double quotes (PROVEN, master test). As v55 writes the coupon on the Library checkout link, stored exact in Checkout Abandon 1 and 3 (sitting 2b):

```
<a href="https://checkout.visualdesignhacks.com/canva-hacks/{% if person.library_offer_code and person.library_offer_code != '' %}?coupon={{ person.library_offer_code }}{% endif %}" target="_blank" style="…">
```

**The button is the square padded button** (decision D7, Joe, 28 Sep): one link, padded for classic Outlook with hidden em spaces and `mso-text-raise` inside Outlook-only comments, with `mso-padding-alt: 0` and `text-underline-color`, between two spacer paragraphs. As v55 writes it, the three elements one after the other with nothing between them (shown here on three lines):

```html
<p style="margin: 0; font-size: 16px; line-height: 16px;">&nbsp;</p>
<a href="LINK" target="_blank" style="display: inline-block; background-color: #933bc9; color: #ffffff; font-family: helvetica,sans-serif; font-size: 16px; font-weight: bold; line-height: 120%; text-decoration: none; padding: 14px 24px; border-radius: 8px; mso-padding-alt: 0; text-underline-color: #933bc9;"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:175%" hidden>&emsp;</i><span style="mso-text-raise:88%;"><![endif]-->LABEL<!--[if mso]></span><i style="mso-font-width:150%;" hidden>&emsp;&#8203;</i><![endif]--></a>
<p style="margin: 0; font-size: 16px; line-height: 32px;">&nbsp;</p>
```

- **The spacers (decision 133, v55).** Above the button, a paragraph 16 px high: with the 16 px margin of the paragraph or list before it, the button sits 32 px below it. Below, a paragraph 32 px high, before the sign-off. PROVEN in the delivered source (sitting 2a: Gmail, both spacers intact); the look RECORDED (sitting 2a: Joe's Apple Mail screenshot, the two gaps even; the copies to Gmail and Outlook.com delivered). Before v55 (v53, v54) the spacers were 8 px above and 28 px below, RECORDED in classic Outlook at sitting 2a.
- **How it looks and clicks.** In classic Outlook: square, bold, the right size, clickable across the whole button and tracked, the edge too (RECORDED, sitting 2a, 20 Oct: with the pointer on the bottom-left edge of the purple, away from the words, Outlook shows Encharge's tracker link, and the click works; email 495068, v54). In Gmail: rounded (RECORDED: master test; sitting 2a). The Gmail and Outlook apps on iPhone and Apple Mail (iCloud) were checked on 20 Oct (RECORDED), but the button's shape there was not recorded (lesson E6; corrected in v1.08's revision of 20 Oct, after the review by Encharge API Reverse 5).
- **Why not the alternatives** (RECORDED, master test): classic Outlook ignores padding and rounded corners on a plain styled link, which shows as a purple highlight; Encharge's own Button block is rounded there, but its clicks in classic Outlook are not tracked (it landed on the raw link).
- **No link inside `<!--[if mso]>` comments.** Encharge's click tracker rewrites the letter's `<a>` links, but not a link inside those comments. PROVEN: the master test's delivered sources, and v55's Gmail source at sitting 2a, where every link of the letter went through `maillinkforward.encharge.io/ls/click`.
- **Short labels.** Windows Outlook does not wrap a button's label. Look-tested: "Finish checkout". Built but not look-tested: "Have a look at the Hacks Library" (Checkout Abandon 2). Whether a longer label wraps: UNVERIFIED.
- **A hand edit keeps the button.** After Joe changed one word of a ZZ letter by hand and saved, both Outlook-only comment blocks, `mso-padding-alt`, `text-underline-color` and the hidden spacers were intact, and only that word changed in the design. PROVEN, sitting 2a (version 450041); delivered to classic Outlook square, bold and the right size, RECORDED.
- **`&emsp;` and `&#8203;` are written as entities,** as v55 writes them (PROVEN, built exact). Encharge may later store the two as the characters themselves (U+2003, U+200B), which are the same characters: a hand edit of the HTML block does (sitting 2a, version 450041), and so does a Send Test, which leaves the design as it was and adds no version (sitting 2a: ZZ email 495074 read before and after). The delivered email is unchanged; an `emailCheck` afterwards reports `exact.html: false` at the first em space. Since builder v1.09 (P12) its `ok` allows this one rewrite, reported apart as `exact.foldedOnly: true`, and any other change to a swapped text still fails it (`ok` judges the swaps only, as always: a change elsewhere in the email leaves it true and shows as `exact.foldedOnly: false`, so a check needs `ok` and `exact.foldedOnly` not false); up to v1.08, `ok` was false too (the review of v1.08 reproduced it offline). Writing the two as characters from the start would avoid it: UNVERIFIED, never built.

**Lists are pattern A** (Joe's pick, 20 Oct): a real list (`ul` and `li`) with an Outlook-only fix; screen readers announce it as a list. Each list carries its own Outlook-only style just before it:

```html
<!--[if mso]><style>.vdh-ul li { margin-left: 27px !important; mso-special-format: bullet; } .vdh-ul-wrap { margin-left: -25px !important; }</style><![endif]--><div class="vdh-ul-wrap"><ul class="vdh-ul" type="disc" style="margin: 0 0 16px 25px; padding: 0; font-family: helvetica,arial,sans-serif; font-size: 16px; line-height: 160%; color: #2b2b2b;"><li style="margin: 0 0 8px 0;">…</li><li style="margin: 0 0 8px 0;">…</li></ul></div>
```

- RECORDED: classic Outlook (bullets, normal indent, even gaps), the Gmail and Outlook apps on iPhone (wrapped lines stay under the text), Apple Mail (iCloud, v55). PROVEN: built exact in ZZ Sitting 2a Bullet Test (494846), in v54's and v55's ZZ emails (sitting 2a) and in Checkout Abandon 1 and 3 (sitting 2b).
- Not used: bullets as `•` characters with `<br>` in one paragraph (v53; cramped in classic Outlook), a table with list roles (uneven in classic Outlook) and one paragraph per bullet (no hanging indent), the other two in 2a's bullet test. None of the three choices affects deliverability, which the evidence ties to sender reputation, authentication and content.

**Images:** no letter holds one yet, and none is tested.

### 4.3 What the builder does with an email

- Before the run it reads the master and checks that each text it replaces sits exactly once in the master's HTML, as written or as the editor writes it (a non-breaking space as `&nbsp;`; live test B4), and it stops before making an email that fails.
- It posts each email finished: a copy of the master with the swaps made in the design and in the HTML. Encharge stores an email exactly as sent, and the builder checks each one against what it sent and against the master with the swaps made (`verify`; `VDHSit.emailCheck` reports where a stored copy differs, under `exact`).
- Each flow's emails are built just before that flow, in a run of their own (sitting 2b: Checkout Abandon's three, then the flow).
- An email Joe makes by hand still goes in the builder's ledger under the key the specs name it by.

---

## 5. What the builder returns

For each run, the builder reports:
- the drafts made, all **off**, by display name;
- the check result, value by value (each step's editor flags included), each segment's rows, each new field and tag, and each email against the one sent and against its master;
- the rows it did not build (HOLD, EXITS…);
- the tags it did not create because they exist;
- the permissions it used, each with Joe's words and date;
- the edits left for the switch-over (`leftForSwitchOver`: the Abandoners edit, since v1.02);
- the plan's provenance: the builder's version and hash, the email set's export it came from, and the SHA-256 of every input file (since v1.02);
- any warnings.

Joe reviews each draft on the canvas and switches it on by hand.
