# Encharge write API — map for Claude

**v0.11 · 2026-10-20 · MECHANICS · every object PROVEN by a build from the page: live tests A13 and B0–B8 on builder v0.3 (2026-09-25), the re-check R1–R4 on builder v0.4 (2026-09-26), build sitting 1 and the master template test on builder v1.02's code (2026-09-28), build sittings 2a and 2b on builder v1.07 (2026-10-19 and 20), on top of two captures and the readers' reads**

*For Claude: capability sessions and the building session. This doc says how Encharge saves each object. The rules are in the builder's `SKILL.md`, and the gap register in its `references/gaps.md` (since v1.00; the plan, `Encharge-Builder-Plan-for-Claude-v0_9.md`, is now a pointer). The spec format is `Encharge-Spec-Format-for-Claude-v0_9.md` (since builder v1.09; v0_7 before), whose section 4 is the email format as proven. The live tests' results are in `Encharge-Live-Test-Results-for-Claude-2026-09-25.md` and `Encharge-Recheck-Results-for-Claude-2026-09-26.md`; the builds' in `Encharge-Build-Sitting-1-Results-for-Claude-2026-09-28.md`, `Encharge-Master-Test-Results-for-Claude-2026-09-28.md`, `Encharge-Sitting-2a-Results-for-Claude-2026-10-20.md` and `Encharge-Sitting-2b-Results-for-Claude-2026-10-20.md`, and the lessons of sittings 2a and 2b, each with what proved it, in `Encharge-Sitting-2-Lessons-for-Builder-v1_08-for-Claude-2026-10-19.md` (E1–E27, M1–M5, B1–B9; all in Project VDH Product & Arch, folder `encharge-api/`). The read side is `Make-Encharge-Readers-for-Claude-v0_5.md`. Builder v1.08 and v1.09 carry this version as `references/api-map.md` (v1.09's revision: section 5's sentence on `emailCheck` after a Send Test, P12); the Project copy is `encharge-api/Encharge-Flow-Write-API-Map-for-Claude-v0_11.md`, which replaces v0_10. The spec format it points to is v0_8 since builder v1.09.*

**Names — system first; Encharge flows by display name, ID in brackets.**
- **Live:** Encharge flow *Abandoned Cart Email Sending Sequence* (310308) · Encharge segments *People IN FLOW* (1257090), *People NOT IN FLOW* (1257089), *Abandoners (active last 24h)* (1059368), *Has ANY Product (All Tools)* (1057634).
- **Test objects (ZZ), deleted by hand after the tests:** Encharge flows *ZZ Capture Test - renamed* (404885) and *Copy of ZZ Capture Test - renamed duplicate* (404886) · segment *ZZ Capture Segment* (1257212) · email *Copy of Tester 1* (486819) · fields `zz_capture_field`, `zz_capture_date` · tags `zz_capture`, `zz_capture_2`. `zz_capture` and *Copy of Tester 1* were deleted at build sitting 1 (2026-09-28).
- **Made at the live tests (2026-09-25) and the re-check (2026-09-26), also deleted by hand:** the results docs list them in delete order (25 Sep, section 5; 26 Sep, section 6).
- **Master template:** Encharge email *VDH Master · Letter* (488125), ledger key `vdh_master_letter` (gap D4, closed 2026-09-28).
- **Made at the master template test (2026-09-28), deleted by Joe:** nine ZZ emails (its results doc, section 7).
- **Built by the builder, off:** at build sitting 1 (2026-09-28), Encharge flows *Lane cleanup · Library* (405726), *Lane cleanup · Templates Pack* (405727), *Lane cleanup · Library refund* (405728) and *Checkout Abandon · stuck-contact cleanup* (405729); at build sitting 2b (2026-10-20), Encharge emails *Checkout Abandon 1*, *2* and *3* (495084, 495085, 495086) and Encharge flow *Checkout Abandon* (409556).
- **Made at build sitting 2a (2026-10-19 and 20), archived by Claude through Encharge's screens on Joe's yes:** four ZZ emails, 494839 (*ZZ Sitting 2a Checkout Abandon 1*), 494846 (*ZZ Sitting 2a Bullet Test*), 495068 (*ZZ Sitting 2a v54 Checkout Abandon 1*) and 495074 (*ZZ Sitting 3 v55 Checkout Abandon 1*) (2a results, section 4).
- **A test of its own for gap A12 (20 Oct), passed, then deleted by Joe:** Encharge flow *ZZ A12 Check* (409563), with tags `zz_a12_test`, `zz_a12_yes` and `zz_a12_no`, and two test contacts (section 6.1; `references/gaps.md`, A12).
- **Other:** Encharge email *Tester 1* (373125) · Make scenario *Flow Reader* (9795088).

> **Changes:**
> **v0.11 (2026-10-20), for builder v1.08 (documents only):** what build sittings 2a and 2b (2026-10-19 and 20, builder v1.07) proved, each fact marked with its sitting. Section 5, emails: the master's letter is an HTML block, and its path, read back twice; paths with dots or brackets; what a hand edit of an HTML block keeps (the square padded button's Outlook-only code) and rewrites (`&emsp;` and `&#8203;` as characters); Send Test rewriting the stored HTML without a version; the name rule in Encharge's own Liquid; the click tracker on every link of a delivered letter, and the button's edge click tracked in classic Outlook; Encharge's Button block untracked in Outlook; deleting an email in Encharge's screens (Archive Email), and an archived email still reading whole; the version history as the record of hand saves; the master's logo and footer. Section 6: People IN FLOW has 12 rows. Section 7.4 and 8: the first built flow with Send email steps verified on build. Section 3: the correction to the readers doc is made. Sections 1 and 9: of the twelve protected fields, `LastLoginDate` and `LoginCount` are WP Fusion's, not the FlowMattic routers'. Section 10 records both sittings.
> **v0.10 (2026-09-29), for builder v1.06:** what build sitting 1 and the master template test (2026-09-28) proved about emails, in section 5: the preheader's path; the version history; deletes; a swap replacing the whole stored value; what a hand edit rewrites in a Text block and an HTML block; Encharge's Button block; Send Test and the click tracker. Section 10 records both sittings.
> **v0.9 (2026-09-27): pointers only, for builder v1.02** (after an independent review of v1.01 and rounds of reviews of its fixes): the spec format is v0.6, the plan v0.9. Nothing about how Encharge saves an object changed. What changed in the builder is in its `CHANGELOG.md` (v1.02). Two builder rules touch this map: an ordinary objects plan never edits Encharge segment Abandoners (active last 24h) (1059368); the switch-over's plan does, behind reads of Encharge flow Abandoned Cart Email Sending Sequence (310308), and of Checkout Abandon once the builder's ledger holds it, that stop it unless Encharge says each flow is `deactivated` or `deactivated-user` (section 7.5's statuses). And no plan goes into the page in one call over 24 KB (the largest call proven live is 34 KB).
> **v0.8 (2026-09-26): pointers only, for builder v1.01** (after an independent review of v1.00): the spec format is v0.5, the plan v0.8. Nothing about how Encharge saves an object changed. What changed in the builder is in its `SKILL.md` (What v1.01 changes).
> **v0.7 (2026-09-26): the re-check R1–R4, on builder v0.4.** All passed (evidence: `evidence/recheck-2026-09-26.json` in the builder package). **Corrected:** Encharge adds a link's `eventListenerIds` when the flow is **switched on**, not when the link is saved, and keeps them when it is switched off (section 7.4): the builder's ZZ R1 Bounce had none until Joe switched it on, and v0.4's check, which expected them on save, failed on it. So a draft never switched on has none; after Joe switches a flow on, the builder checks that every email link has one (section 8). Also: an email copied from a master whose paragraph holds a non-breaking space is stored exactly as sent with both swaps (R2, section 5); the canvas draws a Send email step about 300 px tall, so the builder leaves 450 px below one (section 7.3); an existing tag is skipped (R3); the builder's journal survives a reload of the page (R4).
> **v0.6 (2026-09-25): the live tests.** Builder v0.3 built every kind of object from the page, through the guard, and read each back: A13 and B0–B8 all passed (evidence: `evidence/live-tests-2026-09-25.json` in the builder package). New here: the caller is PROVEN, with the app's cookie login (section 1); the *On bounced* link's `data` (gap A13, section 7.4); Encharge stores an email exactly as sent, and a non-breaking space in the design is `&nbsp;` in the HTML (section 5); a segment the builder leaves unfiled still shows in the sidebar, so it files nothing (section 6); gap A12 closed for segments (section 6.1); names keep `·`, `→` and `+`, in the API name too (section 7.1); stored editor flags equal the configure call's on every type built, and two shapes of Wait exist in the account (section 7.2); an Add tag step starts a Tag added flow (section 7.4); two lessons for reading results (section 10). Sections 1 and 8 also describe builder v0.4's guard and checks, tightened after an independent review.
> **v0.5 (2026-09-24): gap A10 closed through the readers.** Joe added three rows to the Check condition of Encharge flow ZZ Capture Test - renamed and to Encharge segment ZZ Capture Segment. Both readers read them at 15:38 Paris on 2026-09-23 (validator v0.2 passed both), and the segment still loads, with 251 people (Joe, 2026-09-24). A Date field's *is empty* is stored as `"is empty"`, the same word as on a Text field, with the value `0`. *is not empty* is stored with `0` in the check and `""` in ZZ Capture Segment; two older segments hold `0` and no value. Across the account these two tests carry `""`, `0` or nothing, so the value seems to mean nothing, though that is an inference. A number typed on a Text field is stored as text, `"1"`, in the check and the segment alike (section 6.1). New gaps: A11, the empty tests Encharge has not been seen storing (*is empty* on a Text field in a segment, *is not empty* on a Date field, and either test on a field no user created), none needed by v47; and A12, whether a segment row `"1"` finds contacts whose value a writer stored as a number, needed by v47's Abandoners edit and counted in test B3 (sections 6, 6.1 and 8). The census is 42 rows.
> **v0.4 (2026-09-23, 15:30 Paris): gap A7b closed through the readers.** A Number field's *more than* is stored as `"is more than"` with a number, and a segment's *in* as `"in"` with the segment ID (section 6.1). Joe's screenshot of the Number menu is recorded; the rest of it is gap A7c. A census of every condition row stored in the account (section 6.1) shows which tests have been seen on which field types. Three things v47 needs have not: *is empty* on a Date field, the value the app sends for *is not empty*, and how a segment stores a number typed on a Text field (gap A10). A segment row inside a Check condition has not been seen either (gap A9). Editing an existing segment can now remove rows as well as add them (section 6). The guard checks every segment body (section 1). Configured steps of four more types carry the editor flags every stored step of their type has (section 7.2). Section 8 adds the segment read-back.
> **v0.3 revised again, same version (2026-09-23, afternoon):** section 7.3 records that a configure body is the creation default with values set; section 8 names `verify.js` (builder v0.1).
> **v0.3 revised, same version (2026-09-23, 14:02 Paris):** Joe kept the live flow's 30-day re-entry (section 7.5; plan, D5); the master email template is held (plan, D4); A7b closes through the readers.
> **v0.3 (2026-09-23): capture 2 closed gaps A1, A2, A3, A5, A6, A7 and A8.** Added: creating fields; how segments and their rows are saved; one condition grammar shared by segments and checks (section 6.1); how emails are copied and saved, and copy-and-swap proven offline; how flow settings are saved; End Flow naming another flow; the duplicate-send switch. New findings: settings save the moment they change; the status `deactivated-user`; a live-flow change made during the capture (section 7.5); segment rows are saved without validation; the app files new objects into folder indexes; `/v1/schemas/person/fields` works on this plan; captures carry the account API key (section 10).
> **v0.2 (2026-09-23):** re-ordered into build order; the caller changed from Make to the built-in browser pane.
> **v0.1 (2026-09-23):** mapped from capture 1.

---

## 0. Status at a glance

| Object | Create | Status |
|---|---|---|
| Contact fields | `POST /v1/schemas/person/fields` | PROVEN (capture 2; built from the page, B3) |
| Tags | `POST /v1/tags-management` | PROVEN (captures 1 and 2; built from the page, B3, B8 and R3) |
| Emails | `POST /v1/emails` (a full copy); save with `PATCH /v1/emails/{id}` | PROVEN (capture 2; built from the page and stored exactly as sent, B4, R2, the eight ZZ emails of the master template test, and the four ZZ emails and Checkout Abandon's three of sittings 2a and 2b) |
| Segments | `POST /v1/segments/`, then rows with `PATCH /v1/segments/{id}` | PROVEN (capture 2; the readers: the `in` row, then the A10 rows; built and edited from the page, B3) |
| Flows | flow, steps, links, notes, settings | PROVEN (captures 1 and 2; built from the page, B1, B2, B5, B6, B8 and R1; four system flows at build sitting 1; Checkout Abandon, the first with Send email steps, at sitting 2b) |

Gap and test IDs (A…, B…, C…, D…, R…) refer to the builder's `references/gaps.md`.

---

## 1. The caller — built-in browser pane (PROVEN, live test B0)

- **Where.** The built-in browser pane in the Claude desktop app on Joe's laptop, with Joe logged in to Encharge. Claude makes calls from inside `app.encharge.io` to `api.encharge.io`, using the app's own login. No API key is copied anywhere. Test B0 proved it: the app's own login is a **cookie**, and `GET /v1/heartbeat/authenticated` answered 204 from the page (2026-09-25). How the builder's files are put into the page, and why they must be plain ASCII, is in the builder's `live/RUNBOOK.md`.
- **Why not from Claude's workspace.** Its proxy refuses Encharge (`app.encharge.io`, CONNECT 403, 2026-09-23).
- **The guard.** Before any call, Claude installs `guard.js` in the page. One function makes every call, and it refuses anything off this list before it leaves the page.

| Allowed | Condition |
|---|---|
| `GET` | anything except `…/share-token`, `/v1/accounts` (whose response holds the API key), and anything under `/v1/people` or `/v1/broadcasts` |
| `POST /v1/schemas/person/fields` | only after the account's fields were read through the guard (`GET /v1/schemas`); never a field that exists, or one of the twelve protected fields: the ten the FlowMattic routers write and the two WP Fusion writes, `LastLoginDate` and `LoginCount` (the code calls all twelve router fields) |
| `POST /v1/tags-management` | — |
| `POST /v1/emails` | only the keys the app sends (section 5), not archived, not a default template, no id |
| `POST /v1/segments/` | only `name`, `color` and `objectName`: no id, no rows (they come with the PATCH below) |
| `PATCH /v1/segments/{id}` | segments created in this session; any other segment only with a matching `permissions.json` entry. Either way, the body's `id` must match the path, with one All/Any group of at least one row and no group inside it |
| `PATCH /v1/folders/{id}` | append-only: the guard reads the folder first and refuses a body that drops any child. Off: test B3 showed filing is not needed (section 6) |
| `POST /v1/integrations/` | — |
| `PATCH /v1/integrations/{id}` | only flows created in this session, only `{id, name, status, data}`, and only with `status: "deactivated"` |
| `POST /v1/steps/`, `PATCH /v1/steps/{id}` | only on flows created in this session; only the step types the builder makes (Archive person and Send webhook only with permission); content-checked when created and when configured; a configure call keeps the type the step was created with |
| `POST /v1/links/`, `POST /v1/decorations` | only between steps, and on flows, created in this session; a note carries its own UUID as its id |

**Every call:** a path must be `/v1/` and lower-case segments of letters, digits, `_` and `-`, with at most plain `name=value` query pairs, and must be what the browser will send; anything else (dots, `;`, `%`, `#`, backslashes, spaces, capitals) is refused. The body is judged as the exact text sent. No create or update body may carry an id other than the path's (a note's own UUID aside), and each step value must be in the one shape the compiler writes. Saving over an email (`PATCH /v1/emails/{id}`) is refused: the builder posts each email finished. A permission names one object and one action; a segment or flow permission carries its Encharge ID, which the guard matches.

**Refused:** every `DELETE`; `…/share-token`; `GET /v1/accounts`; `PATCH /v1/accounts/me`; anything under `/v1/people` or `/v1/broadcasts`; `PATCH` of a tag; `PATCH /v1/integrations` with any status other than `deactivated`, or on a flow not created in this session; any step, link or note call on a flow not created in this session. Test B7 proved the refusal: `DELETE /v1/segments/1` was refused in the page, and the browser's own record of requests (resource timing, with a control call just before) held nothing to that URL.

⚠️ **This guard is code Claude installs, not a wall Claude cannot cross.** By the reader doc's standard it is discipline, not structure. The walls are Encharge's own: it creates flows off, and nothing on the allowed list can switch one on.

---

## 2. Build order

**fields → tags → emails → segments → flows.** Within flows: shells for the whole group first → steps (create, then configure) → links → notes → settings → read back → Joe switches the flow on.

- Segments filter on fields and tags, and can reference other segments.
- *Send email* steps need email IDs.
- Segment triggers need segment IDs, and People IN FLOW gets one row per `in_flow_*` tag.
- Flows that end each other need each other's IDs, so all their shells are created first.

---

## 3. Contact fields

| Part | |
|---|---|
| Call | `POST /v1/schemas/person/fields` |
| Body | an **array** of fields. Text: `[{"name":"zz_capture_field","type":"string","title":"zz_capture_field","readOnly":false,"canMapFrom":true,"firstClassField":false,"array":false,"createdBy":"user"}]`. Date: the same plus `"format":"date-time"`. Returns `{"fields":[…]}` |
| Other types | Number, True or False, Select and Multi Select are offered in the app, not captured and not needed (every VDH field is Text or Date) |
| Order | before segments and flows. In conditions a custom field is written `data.<name>`; built-in fields are bare (`firstName`, `email`) |
| After | the app then adds the field as a column in the user's People table (`PATCH /v1/accounts/me`). That is cosmetic, and the builder never makes that call |
| Harm | Creating a field is harmless. Renaming or deleting a field that FlowMattic or WP Fusion writes would break them silently, so neither is ever done |
| Status | PROVEN (capture 2, 11:32:46 and 11:33:20 UTC) |

**Corrected in the readers doc (2026-09-28):** the reader doc (1.4) counted all `/schemas/…` paths as Premium-gated, but `POST /v1/schemas/person/fields` and `GET /v1/schemas` both answered 200 on this plan. The gate covers custom objects, not the person schema; `Make-Encharge-Readers-for-Claude-v0_5.md` says so.

---

## 4. Tags

| Part | |
|---|---|
| Call | `POST /v1/tags-management` |
| Body | `{"tags":[{"tag":"zz_capture_2"}]}` → `{"tags":[{"tag","createdAt"}]}` |
| Order | before segments and flows. In the app, typing a new name in a tag picker creates the tag without saying so |
| Filing | the app files new tags into the *Top-level tags* folder later, when a page listing tags loads: both ZZ tags were filed together at 11:46:18, one of them an hour after it was created. The builder does not file tags |
| Harm | Creating is harmless. `PATCH` and `DELETE /v1/tags-management/{tag}` can remove site access for every buyer (reader doc 1.2), so neither is ever called. Product tags belong to FlowMattic's routing and are created at product go-live, not by the builder |
| Status | PROVEN (captures 1 and 2) |

---

## 5. Emails

| Part | |
|---|---|
| Read | `GET /v1/emails/{id}` → `{"email":{…}}`; a flow's emails via `GET /v1/integrations/{id}/emails` |
| Copy | `POST /v1/emails` with the source email's fields, minus `id`, with a new `name`: `type: "HTML"`, `isStandalone: true`, `accountId`, `subject`, `fromEmail`, `fromName`, `html`, `editor`, `previewImage`, `archived: false`, `canSpamCompliance: "approved"`, `communicationCategoryId: 269538` (*Marketing Emails*), `isDefaultTemplate: false`. Returns the new email and its ID |
| Save | `PATCH /v1/emails/{id}` with the whole email. While typing, the app also autosaves to `PATCH /v1/emails/{id}/versions/latest` (12 times in capture 2, around 2 saves). The builder does not need autosave: it posts each email already finished |
| Design | `editor: {type: "unlayer", state: {body, counters, schemaVersion}}`. Tester 1's design has 2 images, 1 heading, 2 text blocks, 1 button, 1 divider and 1 social block. Text lives at `body.rows[r].columns[c].contents[k].values.text` as HTML, and the HTML wraps it in a `<div>` carrying the block's own text style (in the master, `font-size: 16px; line-height: 160%`); an HTML block's content lives at `values.html`, wrapped in a plain `<div>`, with no style of its own. **The master's letter is an HTML block since Joe's change of 19 Oct** (D6): `body.rows[0].columns[0].contents[1].values.html` (row 1, block 2), holding `LETTER GOES HERE`. PROVEN, sitting 2a: `masterCheck` ok, each placeholder once in the HTML, at version 449957 (19 Oct) and again at 450981 (20 Oct). A path may be written with dots (`body.rows.0.columns.0.contents.1.values.html`) or brackets: the compiler and the runner reach the same block either way (offline, 19 Oct), and four emails built from the dotted path were stored exact (sitting 2a); the spec format writes dots, and `masterCheck` reports brackets |
| Preheader | `body.values.preheaderText`, written once into the HTML, in a hidden cell at the top of the body (gap A15, closed by the master template test; read back again at sitting 2a) |
| History | `GET /v1/emails/{id}/versions` → `{"versions":[…]}`, newest first. Each holds `version`, `createdAt`, `createdBy` (none on a create, even of an email Joe made by hand; his login on his saves), `metadata` (`isAutoSave`, `changeReason`: `email_created` or `content_updated`) and `data` (`html`, `editor`, …). A save adds one whether or not anything changed; a failed save leaves none; Send Test adds none (but see *Send Test rewrites the stored HTML*, below); most deletes add one (`content_updated`, under the login of whoever deleted; 7 of the 8 read). The guard allows the read. PROVEN, the master template test. **It is the record of hand saves:** each with its time, the login that made it and the full design, so it shows, and dates, what Joe changed by hand (PROVEN, sitting 2a: the master's versions 449957 and 449975 on 19 Oct; 450981 headed the list on 20 Oct). The builder's ledger notes each hand change to the master (`ledger edited`; `SKILL.md`, The ledger) |
| Delete | the guard refuses every `DELETE`, so by hand, in Encharge's screens, where it is **Archive Email**: the Emails list → the card's "…" menu → *Archive Email* → the confirmation *"Archiving this email will remove it from any flows. Continue?"* → *Archive*. Every card carries a hidden *Archive* button and only the open menu's is visible, so check which card's menu is open (its heading) before clicking. Encharge archives the email, which still reads by ID with `archived: true` and its full design (build sitting 1; the master template test; sitting 2a). PROVEN, sitting 2a: Claude archived four ZZ emails this way on Joe's yes, in a second tab, never the builder's, and read each back (`GET /v1/emails/{id}` → `archived: true`), and the master and Tester 1 unchanged (`live/RUNBOOK.md`, section 8). A flow Joe deletes is archived the same way: it reads by ID with `archived: true` and status `deactivated-user`, and the flow list no longer holds it (PROVEN, ZZ A12 Check, 409563, 20 Oct) |
| Order | before flows; a *Send email* step names its email by ID |
| Status | PROVEN (capture 2, 11:45:32–11:46:10 UTC; live test B4, 2026-09-25; the master template test, 2026-09-28; build sittings 2a and 2b, 2026-10-19 and 20: seven emails copied from the master, each stored exact) |

**Copy-and-swap, proven offline.** Joe's edit changed exactly one leaf of the design: the heading's `values.text`, from `<strong>Your email headline goes here</strong>` to `<strong>Change line of text</strong>`. Swapping that same text in both the design and the `html` reproduces the saved email except for four serialisation details: two self-closing slashes, a non-breaking space written as a character, and an empty attribute. None of them changes the content. So the builder writes each email by copying a master design and swapping text in **both** places. The master template is Encharge email *VDH Master · Letter* (488125, ledger key `vdh_master_letter`; gap D4, closed 2026-09-28).

**Live test B4 — PROVEN, 2026-09-25.** The builder copied Encharge email *Copy of Tester 1* (486819) as *ZZ B4 Email* (487536) and swapped its heading in the design and the HTML. **Encharge stored the email exactly as sent**, HTML and design character for character, so the builder checks every email it makes against the body it sent. The full swap, heading and paragraph, could not run: the paragraph's design text holds a non-breaking space (U+00A0, a blank line), which the HTML writes as `&nbsp;`, so the text as written was in the HTML 0 times. Builder v0.4 finds a text in the HTML as written or, failing that, as the editor writes it, and still requires exactly one match.

**Re-check R2 — PROVEN, 2026-09-26.** Builder v0.4 made the full swap: *ZZ R2 Email* (487671) from *Copy of Tester 1* (486819, only read), the heading found as written and the paragraph as the editor writes it (`&nbsp;`), each once. Encharge stored it exactly as sent, every key, and equal to the master with both swaps made in place; Joe saw both lines swapped in the editor.

**A swap replaces the whole stored value.** The builder reads the value stored at the swap's path in the master, finds it exactly once in the HTML (as written, or as the editor writes it), and replaces that whole value, in the design and in the HTML, with the swap's `html`. So a placeholder paragraph such as the master's `<p style="line-height: 160%;">LETTER GOES HERE</p>` goes with it, and the letter's own paragraphs are not nested inside it. The spec gives only the path and the new HTML; the builder takes the old value from the master.

**The master template test — PROVEN, 2026-09-28.** Builder v1.03 (v1.02's code) made eight ZZ emails by copy-and-swap, seven from *VDH Master · Letter* (488125) and one from Joe's HTML-block copy of it (488137), with two swaps each, the preheader and the letter. Every one was stored exactly as sent, and equal to the master with the swaps made. That copy, the ninth ZZ email, was made by Joe by hand and only read. Results: `encharge-api/Encharge-Master-Test-Results-for-Claude-2026-09-28.md`; evidence: `evidence/master-test-2026-09-28.json`.

**Hand edits after a build.** A save with no changes left a Text-block email identical. A one-word edit made the editor rewrite the Text block's letter:
- `font-size` removed from every paragraph's style, and from the button link's, with its `font-weight: bold`;
- `•` written `&bull;`;
- `line-height: 160%` added to paragraphs without one, and margins written in `px`;
- `rel="noopener"` added to each link.

An HTML block kept everything through the same edit. A save with no changes wrote one link's `&amp;` as `&` in the HTML; the design kept `&amp;` (by HTML's rules the two read the same). Liquid, quotes and `<img>` survived in both.

**A hand edit of an HTML block keeps the square padded button** (PROVEN, sitting 2a, 19 Oct): Joe changed one word of a ZZ letter built from the changed master and saved (version 450041). In the design only that word changed. In the HTML the button's Outlook-only code was intact (both comment blocks, `mso-padding-alt`, `text-underline-color`, the `hidden` spacers), and Encharge also wrote `&emsp;` and `&#8203;` as the characters themselves (U+2003, U+200B: the same characters). Delivered to classic Outlook: square, bold, the right size (RECORDED).

**Send Test rewrites the stored HTML without a new version** (PROVEN, sitting 2a, 20 Oct, ZZ email 495074 read before and after): opening an email in the editor and using Send Test left the design byte for byte as it was, but rewrote the stored HTML, `&emsp;` and `&#8203;` becoming the characters themselves; the version list still held only the create. With those two entities written as characters, the HTML equals what the builder sent, so the delivered email is unchanged. So an `emailCheck` after a Send Test reports `exact.html: false` at the first em space: this rewrite, not a fault. Since builder v1.09 (P12) its `ok` allows that one rewrite and says so (`exact.foldedOnly: true`), and any other change to a swapped text still fails it (`ok` judges the swaps only, as always: a change elsewhere in the email leaves it true and shows as `exact.foldedOnly: false`, so a check needs `ok` and `exact.foldedOnly` not false); on v1.08 and earlier `ok` was false too (spec format, section 4.2).

**Encharge's Button block** holds its link once in the design (`values.href.values.href`) and twice in the HTML:
- an Outlook-only VML shape, `<v:roundrect href=…>` inside `<!--[if mso]>`, with a width worked out from the label at save;
- the `<a class="v-button">`.

Its defaults are 14px, not bold, padding 10px 20px, radius 4px. In classic Outlook it is rounded, but a click there is not tracked: it landed on the raw link (RECORDED, master test), since the tracker leaves the VML shape's link alone (below). So VDH letters use the square padded button instead (decision D7; spec format, section 4.2).

**Sending, seen through Send Test.**
- **Liquid:** Send Test fills it in from the recipient's own contact. `capitalize` lowercases everything but the first letter. **The name rule** (spec format, section 4.2), in Encharge's own Liquid: Send Test to three contacts gave "Hi McH," (first name mcH), "Hi Joe," (JOE) and "Hi there," (no first name), with no Liquid left in the delivered source (PROVEN, sitting 2a, 19 Oct, the three delivered sources in Gmail).
- **The click tracker:** it rewrites each link in the letter and the logo to `https://maillinkforward.encharge.io/ls/click?upn=…`. That is SendGrid's format, and the delivered headers carry SendGrid's. It appends `enchmail=` and the reader's address, base64-encoded, to the landing URL (after `?`, or `&` when the link already has a query). PROVEN again at sitting 2a: every link of v55's delivered Gmail source went through it. The square padded button is tracked in classic Outlook across the whole button: with the pointer on its edge, away from the words, Outlook shows the tracker link (`maillinkforward.encharge.io/ls/click`), and the click works (RECORDED, sitting 2a, 20 Oct, Joe's photo; email 495068).
- **What the tracker leaves alone:** a link inside `<!--[if mso]>` comments, such as a VML shape's, and the footer's unsubscribe and preferences links.
- **UTM tags:** a Send Test email's tracked landings carried none. Whether Automatic UTM Tagging is on is UNVERIFIED.
- **Send Test's address box keeps the last address typed.** Setting it by script changed what the screen showed but not what Encharge sent (the copy meant for iCloud went to the previous address again; PROVEN, sitting 2a, both copies' To lines). How to send one safely: `live/RUNBOOK.md`, section 8.

**The master, as it stands** (VDH Master · Letter, 488125; the builder only reads it):
- **The logo** points at `Resizsed-Logo-shadow-1.png` (200×85) on visualdesignhacks.com, the Better Notifications PNG with a soft shadow, since 20 Oct: the old logo (`vdh-email-logo-240w-white.png`, black on white) showed as a white box on a dark background in the Gmail and Outlook apps on iPhone in dark mode. Claude changed only the image's source in Encharge's editor, on Joe's instruction (Encharge took the new PNG's own size, 200×85, was 240×98; the HTML differs only in the `img` source); version 450981; ledger `email:488125#3`. RECORDED (Joe: *"much better in dark mode"*), sitting 2a.
- **visualdesignhacks.com blocks hotlinks:** the logo fails to load when a page on another site asks for it with a referrer, and loads without one (PROVEN, sitting 2a, the same image loaded from app.encharge.io with and without a referrer). Mail apps and Gmail's image proxy send none, so inboxes show it (RECORDED: Gmail, iCloud Mail); Encharge's editor and card previews may show it broken. If an inbox ever shows it broken, host the PNG in Encharge's own image store instead.
- **The footer's text and links** are `#6b6b6b`: Encharge stores the colour in lower case, and the footer link colour sits in the text block's own `linkStyle` (PROVEN, version 449975, sitting 2a).

**One thing the builder cannot reproduce:** the list thumbnail (`previewImage`) is regenerated only by the editor, so an email built by API shows its master's thumbnail until someone opens and saves it (cosmetic).

---

## 6. Segments

| Part | |
|---|---|
| Create | `POST /v1/segments/` with `{"name","color":"#00805e","objectName":"person"}` → `{"segment":{id, name, accountId, version: 2, color, objectName}}`, with no rows |
| Rows | `PATCH /v1/segments/{id}` with the whole segment plus `"conditions"` (section 6.1) |
| Edit an existing one | `GET /v1/segments`, take the segment as listed, remove rows, add rows, then `PATCH /v1/segments/{id}` with only the fields the app sends: `id`, `name`, `accountId`, `version`, `color`, `objectName`, `conditions`. Rows not named are kept. A row to remove must match exactly one row: the whole row, ignoring its `uuid` and key order, and its value for *is empty* and *is not empty* (Encharge has stored `""`, `0` and no value for them). Two checks in the page send nothing: one before the run's first write (each segment exists, each removal matches exactly one row, none is left empty) and one just before the first edit, which simulates every edit in full and refuses a segment that would name itself through others. So no live segment changes unless every edit can be made |
| Filing | the app then files the new segment into the *Top-level segments* folder with `PATCH /v1/folders/0051d41e-0605-4170-a917-2af72a0c2bef`, sending the **whole** `childrenIds` list. **Not needed:** a segment the builder left unfiled, *ZZ B3 Segment*, still showed in the sidebar (test B3, Joe's screenshot). The builder files nothing |
| Verify | ⚠️ **Rows are saved without validation.** Joe's first try had a row with no field chosen. It saved with 200, then every read of the segment failed: `GET …/preview` and `…/people` returned 500 (*"invalid input syntax for type boolean"*). The builder checks every row before saving and reads `GET /v1/segments/{id}/preview` straight after. For gap A12, test B3 also counted two segments' people with `GET /v1/segments/{id}/people`, a documented read: counted in the page, and only the number left it |
| Order | after fields and tags, before the flows they trigger |
| Harm | Editing an existing segment changes a live object: People IN FLOW decides who gets broadcasts, and Abandoners (active last 24h) starts a live flow. Such edits need Joe's express permission |
| Status | PROVEN (capture 2, 11:33:35–11:47:51 UTC; live test B3: three segments built, and one row of ZZ Capture Segment swapped with Joe's permission). Delete is `DELETE /v1/segments/{id}` (204), seen and never called by the builder |

**The two live segments the build will edit** (read 11:31:51 UTC):
- **People IN FLOW:** Any of — tag has `in_flow_checkout_abandon` (read 2026-09-23). Since build sitting 1 (2026-09-28) it has 12 rows, one per `in_flow_*` tag: the objects plan added 11, with Joe's words (ledger `edited`). The email set adds one per new flow.
- **Abandoners (active last 24h):** All of — field `data.mostrecent_abandoned_at` after period 1; segment not in *Has ANY Product (All Tools)*. v47 replaces the second row with tag has not `product_canva_hacks_library`, and adds field `data.mostrecent_abandonedproduct_id` is 1. That field is Text, and today's app stores the 1 typed into it as text, `"1"`, in checks and segments alike (gap A10). The live flow's own checks hold the number `1`, written by an older build. In a segment, the text `"1"` finds every contact with the value 1, whichever writer stored it (gap A12, closed for segments by test B3, section 6.1). The segment starts a live flow, so the edit's timing goes with D1 (the builder's `references/gaps.md`): inside the switch-over.

### 6.1 The condition grammar — shared by segments and Check condition

A condition is **one flat group**: `{"type":"group","operator":"and"|"or","conditions":[rows],"uuid"}`. In the app, *All of the following* is `and` and *Any of the following* is `or`. Every row carries its own `uuid`, generated by the caller.

| Row | Written | Means |
|---|---|---|
| Tag | `{"type":"tag","condition":"has","value":"zz_capture"}`; also `"has not"` | the person has, or lacks, the tag |
| Field is / is not | `{"type":"field","field":"firstName","condition":"is","value":"zz"}`; also `"is not"`; a boolean compares to `true` / `false`; a number typed on a Text field is text, `"value":"1"` | equals, or differs |
| Field empty | `{"type":"field","field":"data.zz_capture_field","condition":"is empty","value":""}`; also `"is not empty"`. A Date field uses the same words: `{"type":"field","field":"data.zz_capture_date","condition":"is empty","value":0}`. On fields a user created (`createdBy: "user"`, as every stored one is) the builder writes the value stored for the same test, field type and place: Text *is empty* `""` (in a check; never seen in a segment), Date *is empty* `0`, Text *is not empty* `0` in a check and `""` in a segment | blank, or filled |
| Date: more than N days ago | `{"type":"field","field":"data.zz_capture_date","condition":"before period","value":1}` | older than N days |
| Date: within the last N days | `"condition":"after period"` (e.g. `lastActivity` 7 in *Engaged*) | newer than N days |
| Number: more than | `{"type":"field","field":"data.LoginCount","condition":"is more than","value":0}`. The value is a number. The menu says *more than*; the preview says *Login Count is more than 0* | above N |
| Segment | `{"type":"segment","condition":"not in","value":1257090}`; also `"in"`, with the segment ID as a number | outside, or inside, that segment |

**"Any of these tags"** is one tag row per tag under `or`. **No nesting:** every segment and check condition in the account is a single flat group, and the app shows one All/Any selector. Mixed logic is built two ways instead: in a flow, as a chain of checks; in a segment, as a row referencing another segment.

**PROVEN through the readers (gap A7b, closed 2026-09-23).** Joe added a row *Login Count · more than · 0* to the Check condition of Encharge flow ZZ Capture Test - renamed (404885, step 1718247), and a row *Segment · in · People NOT IN FLOW* to Encharge segment ZZ Capture Segment (1257212). Both readers ran at 14:06 Paris, and validator v0.2 passed both. The two rows above are what Encharge stored. Rebuilt from specs, both come out the same apart from row IDs: the Check condition string character for character, the segment rows key for key (builder v0.2 offline tests). Evidence: `evidence/reader-2026-09-23.json`.

**PROVEN through the readers (gap A10, closed 2026-09-23).** Joe added three rows to the same Check condition (saved 15:36:55 Paris) and to ZZ Capture Segment: *zz_capture_date · is empty*, *zz_capture_field · is not empty* and *zz_capture_field · is · 1*. Both readers ran at 15:38 Paris, and validator v0.2 passed both. Stored:

| Row | In the Check condition | In the segment | Preview |
|---|---|---|---|
| Date · is empty | `"condition":"is empty","value":0` | the same | *zz_capture_date is empty* |
| Text · is not empty | `"condition":"is not empty","value":0` | `"value":""` | *zz_capture_field is not empty* |
| Text · is · 1 | `"condition":"is","value":"1"` (text) | the same | *zz_capture_field is 1* |

Rebuilt from specs, both come out the same apart from row IDs: the Check condition string character for character, and the segment's seven rows key for key (builder v0.3 offline tests J1 and J2). No other condition row changed, and no flow was updated, between the two reads. With the three rows in it, ZZ Capture Segment still loads: 251 people (Joe, 2026-09-24), so Encharge reads them, unlike capture 2's broken row. Evidence: `evidence/reader-2026-09-23-a10.json`.

**The Number menu** (Joe's screenshot, `LoginCount`): *more than, less than, at least, is, is not, is empty, is not empty, is any, is any of, is not any of*. The menu's words are not always the stored ones: *more than* is stored as `"is more than"`, and a date's *more than N days ago* as `"before period"`. Encharge's own schema for Event trigger filters (catalogue, `/event`) lists `"is less than"`, `"at least"` and `"is any"`, which are probably the stored words for three of these. That is not proof. UNVERIFIED (gap A7c): *less than*, *at least*, *is any*, *is any of* and *is not any of*, and *is* / *is not* on a Number field. No v47 flow needs them, and they close the same way as A7b if one ever does.

**Values by field type** (PROVEN): Text fields store text, numbers included (`firstName` is `"zz"`; `zz_capture_field` is `"1"`, gap A10). The live flow's checks hold the numbers `1` and `2` on the Text field `mostrecent_abandonedproduct_id`; how they came to be numbers is not known (an older build of the app is the likeliest reason). True/False fields store `true` / `false` (`unsubscribed` in *Subscribers* and *Unsubscribed*); Number fields store a number (`LoginCount` 0); the periods store a whole number of days; *is empty* and *is not empty* carry `""`, `0` or no value.

**Census — every condition row stored in the account** (six flows and 13 segments, read 15:38 Paris: the 36 rows of the 14:06 read plus Joe's six A10 rows, 42 in all). Rows by field type:
- Text: *is* (the numbers `1` and `2` in the live flow's checks; `"1"` in ZZ Capture Test's check and in ZZ Capture Segment; `"zz"` in capture 2's deleted segment), *is not* (`"invalid"`, a check), *is empty* (`""`, a check), *is not empty* (no value and `0` in two live segments; `0` in a check; `""` in ZZ Capture Segment).
- True/False: *is* and *is not*, `true` (two segments) and `false` (a check).
- Date: *before period*, *after period*, and *is empty* (`0`, a check and a segment).
- Number: *is more than* only.
- Tags *has* / *has not*; segments *in* / *not in* (segments only).

The builder allows a test only on a field type the census shows it on, and the empty tests only where their stored form is known. On a Text field it writes the value as text, and refuses a bare number, naming the fix (`"1"`). UNVERIFIED (gap A11), none needed by v47: *is empty* on a Text field in a segment (stored only in a check), *is not empty* on a Date field, and either test on a field no user created: built-in, system, read-only or integration fields such as `email`, `firstName`, `processingConsent` or `shipping_address_zip` (the one stored: segment *Subscribers*, `email` *is not empty* with no value). The compiler refuses them; each closes like A7b if a spec ever needs one.

**Gap A12 — CLOSED for segments (live test B3, 2026-09-25); open for checks.** The question: does a row `mostrecent_abandonedproduct_id is "1"` hold the contacts whose value is 1, however a writer stored it? The live flow's check compares with the number `1`, and no check has ever compared a value FlowMattic wrote (the router's own tag write ends every contact it sends at the flow's first gate; reader doc, question 12). If Encharge compared types strictly, the text `"1"` would match nobody and Abandoners (active last 24h) would stay empty without any error.

Test B3 answered it for segments. A fresh Contact Reader read (17:11:23 Paris, validator PASS) gave the targets: 18 contacts with the value 1, three of them abandoned within 250 days, the three written on 2026-04-26 after FlowMattic became the only writer. The builder made *ZZ B3 Product 1* (1257418, that single row) and *ZZ B3 Product 1 FlowMattic* (1257419, plus *abandoned within 250 days*). Three independent measures equal the targets, 18 and 3: the people counted in the page, with paging proven over three pages; Joe's count on each segment's page; and a match of hashed addresses in the page against the read, 18 of 18 and 3 of 3, none missing and none extra. Encharge's own preview total says 18 and 3 too. Only counts and hashes left the page. Builder v0.4 sets `A12_SEGMENTS_OPEN = False`, so the Abandoners edit compiles, with Joe's permission.

In a **check**, only a run with a test contact shows a `"1"` row matches. **Shown for values entered in Encharge** (20 Oct, Encharge flow ZZ A12 Check, 409563, the same check as Checkout Abandon's `c4`; RECORDED, Joe's screenshots of each contact's timeline): a test contact made by hand with the value 1 went down *Yes*, one without it down *No*. A value FlowMattic writes goes through a check first at the switch-over's test abandon, so the compiler keeps `A12_CHECKS_OPEN` and warns on such a row, naming the flow and check, until then.

UNVERIFIED (gap A9): a segment row inside a Check condition step. Rows of this kind have been seen only in segments. No v47 check needs one: v47 uses segments in triggers, segments and broadcasts.

In a Check condition step the same group is stored as a JSON **string**, wrapped as `{"objectName":"person","conditions":<group>}` (section 7.4).

---

## 7. Flows

### 7.1 How the builder saves

- **It never saves a whole flow.** Every canvas action is its own small call. PROVEN.
- **A new flow is created off** (`status: "deactivated"`). **A copy is created off even when its original is on.** PROVEN.
- ⚠️ **On/off has no call of its own.** It goes through `PATCH /v1/integrations/{id}`, which also renames and saves the flow's settings. That call always carries a status: the app sends the flow's current one. PROVEN.
- **The API name is frozen at creation.** PROVEN. **A rename changes only the display name** (`name`); `apiName` keeps the name the flow was created with. PROVEN 2026-10-23: Joe renamed ten flows (for example 409556, now *Abandon: Hacks Library checkout*, API name *Checkout Abandon*), read back by the Flow Reader. A flow created under a name already taken gets an API name with " (2)" (410153, *Lane cleanup · Templates Pack (2)*). So match flows by ID; where a name must be matched, check both `name` and `apiName`, as reconcile does. **Names keep `·` (U+00B7), `→` (U+2192) and `+`**, in the display name and in the API name (live test B1: Encharge flow *ZZ B1 Lane cleanup · Library → Pack + test*, 405353). PROVEN.
- **Values round-trip exactly** (section 8). PROVEN.

### 7.2 Calls

All PROVEN. Paths are relative to `https://api.encharge.io`.

| Canvas action | Call | Body | Returns |
|---|---|---|---|
| Create flow | `POST /v1/integrations/` | `{"name"}` | the flow, `status: "deactivated"` |
| Duplicate flow | `POST /v1/integrations?source={flowId}` | `{"name"}` | a full copy: new step IDs, links remapped, notes copied, off |
| Rename, settings **and** on/off ⚠️ | `PATCH /v1/integrations/{id}` | `{"id","name","status","data":{…}}` (section 7.5) | the flow |
| Drop a step | `POST /v1/steps/` | `{"integrationId","serviceId":"encharge","data":{"editor":{"coordinates":{x,y},"mustConfig":{…}},"operationKey","inputFields":{},"outputFields":{}}}` | the step: `id`, a `position` UUID made by Encharge, default schemas and the whole service definition (about 185–200 KB) |
| Configure or move a step | `PATCH /v1/steps/{id}` | the same envelope; `inputFields` = the type's schema with `value` on each set field; `outputFields`; `position`; `mustConfig` as the app sends it for the type: `{"configStep":false,"mapInputFields":false}` for most, `{"configStep":false}` for Wait, plus `"mapOutputFields":false` on Check condition. Moving sends new `coordinates` | the step |
| Connect | `POST /v1/links/` | `{"source","target"}`, plus `data` for branches and email events (7.4) | `{"link":{id,source,target,data}}` |
| Disconnect | `DELETE /v1/links/{source}/{target}`, `DELETE /v1/links/{linkId}` | — | `{}` (never called by the builder) |
| Sticky note / text | `POST /v1/decorations` | `{"id": UUID made by the browser, "type":"note"\|"annotation","text","coordinates","dimensions","integrationId"}`, plus `fontSize` for text | the decoration |
| Edit a note | `PATCH /v1/decorations/{uuid}` | the same | the decoration |

`mustConfig` on creation differs by type: `{"configStep":true}` for Tag added, Send email and Add tag; `{"configStep":false}` for Wait; `{}` for End flow; `{"configStep":true,"mapOutputFields":false}` for Check condition. The builder copies what the app sent for each type (evidence files).

Once configured, every stored step of the types never captured (Entered segment, Update field, Remove tag, Event trigger) carries `{"configStep":false,"mapInputFields":false}`: all 13 in the account's six flows (Flow Reader, 14:06 Paris). The builder configures them with the same. What the app sends when it creates them is not known; the builder sends its default, and the configure call replaces it. **PROVEN, live test B5 (2026-09-25):** on all five step types built (Entered segment, Check condition, Update field, Remove tag, Send email), Encharge stored exactly the flags the configure call sent. The builder checks every step's stored flags after each build.

**Two shapes of Wait** (Flow Reader, 2026-09-25 17:49 Paris): of the 15 Wait steps in the account, 12 store `{"configStep":false}` with only `time.hour.type` among the time settings, as capture 1 did and the builder does. Three store `{"configStep":false,"mapInputFields":false}` with `time.enabled: false`, hours 09:00–17:00 and `useAccountTimezone: false`, as the Wait Joe drew by hand for gap A13 did. Both shapes are in the live, working flow 310308, so the builder keeps its own. Why the app writes one or the other is UNVERIFIED (perhaps opening the Wait's time panel). Steps still flagged `configStep: true` exist only in Encharge flow Purchase Flow (Assigning Tags) (309188), which has never been switched on. RECORDED.

### 7.3 The order the builder used

1. `POST /v1/integrations/ {name}` → the flow's ID. The flow is off.
2. For each step: `POST /v1/steps/` with empty `inputFields` → the step's ID and `position`; then `PATCH /v1/steps/{id}` with `inputFields`, `outputFields`, `coordinates` and that `position`.
3. For each connection: `POST /v1/links/`.
4. For each note: `POST /v1/decorations`.

UNVERIFIED — do not rely on it: whether `POST /v1/steps/` accepts the values in one call. Coordinates are canvas pixels with *y* growing downward. The builder puts each step 300 px below the step before it, and 450 px below a *Send email* step, which the canvas draws about 300 px tall with its email and counters: at 300 the next step touched it and hid the *On delivered* label (re-check R1, Joe's screenshot; Joe, 2026-09-26: *"450 px fine"*). Branches (*No*, *On bounced*) go in lanes 350 px to the right.

**The configure body is the creation default with values set** (PROVEN, both captures). What `POST /v1/steps/` returns as `inputFields` is the catalogue schema plus `$schema` (Encharge also rewrites `enum` to `const` in the Wait's dependencies, and fills defaults for Wait and End flow). The app sends that same object back with `value` set on each field. It sometimes moves `$schema` to the end of the object, which JSON ignores. The builder does exactly this at run time, so it never depends on the catalogue being current.

### 7.4 Step settings

A step's settings are its type's schema from the catalogue (44 types: 23 triggers, 14 actions, 6 conditions, 1 helper), with `value` added to each field that is set.

| Step type | `operationKey` | Values | Status |
|---|---|---|---|
| Tag added (trigger) | `/added-tag` | `tag: "zz_capture"` | PROVEN |
| Entered segment (trigger) ⚠️ | `/entered-segment` | `segment: <id>`, `includePeople: "future"` or `"currentAndFuture"`. The second enrolls everyone already in the segment when the flow is switched on | PROVEN (stored) |
| Event (trigger) | `/event` | `name: "thrivecart purchase"`, `filterProperties: [{condition:"is", propertyName, propertyValue}]` | PROVEN (stored) |
| Wait | `/delay-v2` | `period {enabled:true, quantity:1, unit:"days"}`; `time.day` Monday–Friday true; `time.hour.type: "exactly"`. Units: minutes, hours, days | PROVEN |
| Send email | `/send` | `email.id: 373125`; `email.flowId "{{encharge.flowId}}"`, `email.stepId "{{encharge.stepId}}"`, `email.accountId "{{encharge.accountId}}"`; `html`, `subject`, `fromName`, `fromEmail` = `""`; the duplicate-send switch `userCanReceiveMoreThanOnce: true` | PROVEN |
| Add tag / Remove tag | `/add-tag` / `/remove-tag` | `tags: [...]`. **An Add tag step starts a Tag added flow** (live test B8: Encharge flow *ZZ B8 Start*'s Add tag step started *ZZ B8 Chain*, which ran to its end) | PROVEN |
| Check condition | `/check-field` | `conditions`: a JSON **string** of `{"objectName":"person","conditions":<group>}`, using the grammar in section 6.1 | PROVEN |
| End flow | `/end-flow-v2` | `flowIds: "{{encharge.flowId}}"` for this flow, or another flow's ID as a **string**, e.g. `"404886"`. One step per flow ended, as the Build tab does it. How several flows in one step are stored is UNVERIFIED and not needed | PROVEN |
| Update field | `/change-field` | `fieldName`, `fieldValue` (Liquid allowed, e.g. `{{person.firstName \| capitalize}}`) | PROVEN (stored) |

**Links:**
- Most links: `data: null`.
- Check condition branches: `{"conditions":[{"condition":"yes","label":"Yes"}]}` and `{"conditions":[{"condition":"no","label":"No"}]}`. Both can lead to the same step.
- *Send email* → *Proceed on*: `{"conditions":[{"label":"On delivered","condition":"email-delivered"}],"registerEventListener":true}`. **Encharge adds `eventListenerIds` when the flow is switched on, not when the link is saved, and keeps them when it is switched off** (PROVEN 2026-09-26, re-check R1: Encharge flow ZZ R1 Bounce, 405472, built by the builder and never switched on, had none on either email link at two reads; Joe switched it on and both had one, 653140 and 653141; he switched it off and both were kept, status `deactivated-user`; nobody entered). The Flow Reader agrees: ids on the three email links of the live flow 310308 (on), none on the two of ZZ Capture Test - renamed (404885), made in the app while it was off after having been on. So a draft never switched on has none, and a flow that is on needs one on every such link: without it, Encharge would likely never move anyone on at that link (inferred; every such link of the live flow 310308 has one). Whether a link added while a flow is off gets its id at the next switch-on is UNVERIFIED; the builder never adds one.
- *Send email* → *On bounced* (gap A13, closed 2026-09-25): `{"conditions":[{"label":"On bounced","condition":"email-bounce"}],"registerEventListener":true}`, a link of its own out of the Send email step. Joe drew it by hand in Encharge flow ZZ Capture Test - renamed (link 1373730, Send email 1718202 → Wait 1720103); the Flow Reader read it at 16:49:18 Paris (validator PASS). The builder writes exactly this for a spec's `onBounced`. The keys for open, click and reply are not needed in v47.
- **PROVEN on a real flow, sitting 2b (2026-10-20):** Encharge flow Checkout Abandon (409556), the first flow the builder built with Send email steps, read back with each Send email step's *On delivered* and *On bounced* links both `registerEventListener: true` and no listener ids, status `deactivated`: 44 steps, 45 links, every value and flag as sent (verify ok, counted).
- One Entered segment trigger link carries `{"retriggerObjectsUponActivation": false}`; its meaning is UNVERIFIED.

**Encharge sets these itself; never written:** `type` and `active` on each step. **A copy** drops the empty `fromName` and `fromEmail`, which the catalogue flags `clearValue`.

### 7.5 Flow settings

| Setting | Body sent by the app | Status |
|---|---|---|
| Enter once | `{"id","name","status":<current>,"data":{"canEnterOnce":true}}` | PROVEN (capture 2) |
| Once per period | `…"data":{"canEnterOnce":true,"canEnterOncePerPeriod":{"periodType":"days","periodLength":30}}`; `periodType` can also be `"months"` | PROVEN (capture 2) |
| Every time | a new flow's default (`data` holds only `objectType`). No call needed | PROVEN (new flows) |

- **Settings save the moment they change.** There is no Save button (Joe, capture 2), and each change sends one `PATCH` with the flow's **current** status. The builder sends settings only for its own drafts, with `"deactivated"`.
- **Three statuses:** `deactivated` (a new flow, never switched on), `on`, and `deactivated-user`. The last means switched off by a person after being on: Encharge flow ZZ Capture Test - renamed was on at the end of capture 1 and `deactivated-user` in capture 2, after Joe switched it off; so was ZZ R1 Bounce after Joe's switch on and off (2026-09-26). RECORDED. Switching a flow on is also what registers its email links' listeners (section 7.4).

⚠️ **A live flow was changed during capture 2.** At 11:36:13 UTC (13:36 Paris), Encharge flow Abandoned Cart Email Sending Sequence (310308) had its re-entry changed from once every **11** days to once every **30** days, and its status stayed **on**. It matches the email set's Checkout Abandon setting, and only test contacts have ever been through that flow. **Kept** — Joe, 14:02 Paris (the builder's `references/gaps.md`, D5).

---

## 8. Reading back and verifying

**Method:** compare **values only** (the `value` on each field of `inputFields`); links as source, target and conditions; notes in full. Encharge strips schema decoration when it stores a step, so whole-schema equality fails even when nothing changed. After saving a segment, read `GET /v1/segments/{id}/preview`: a 500 means a broken row (section 6). An objects run ends with one `GET /v1/segments`: each new segment must match its rows, ignoring row IDs and key order; each edited segment must equal the body sent, operator and every row (row IDs and key order aside), holding every added row and none of the removed ones. `verify.js` implements all of this, and passes on Encharge's real stored flow from capture 1 (builder offline tests). Since v0.4 it also checks each step's stored editor flags and every value it holds against the configure call sent (the schema's defaults included; capture 1's four steps store exactly the values the app sent), re-entry both ways, and, since v1.00, the listener ids the flow's state calls for: none on a draft never switched on (section 7.4). After Joe switches a flow on, `VDHSit.listeners(<flow ID>)` reads it in the page and checks one on every link that waits for an email event; the Flow Reader's read can check the same (`readers_check.py listeners`). The first built flow with Send email steps, Checkout Abandon (409556), passed all of this on its first plain verify at sitting 2b (section 7.4). For an objects plan: each new field against one `GET /v1/schemas` made after it, each new tag against Encharge's answer to its create call (and, after the run, `VDHSit.tags()` must list every tag, old and new: the tag list is not paged, section 10, Lists), and each email against the body sent (`GET /v1/emails/{id}` straight after: every key as sent but the thumbnail, not archived, HTML and design equal), and against its master with the swaps made in place, worked out again by `verify.js` itself. Make scenario *Flow Reader* gives an independent second read of flows. For gap A12, test B3 counted the people of *ZZ B3 Product 1* and *ZZ B3 Product 1 FlowMattic* in the page and compared them with the Contact Reader's counts, read just before (section 6.1).

**Capture 1 evidence.** The last `PATCH` of each step was compared with `GET /v1/integrations/404885` (10:50:08 UTC):
- Values are equal for all four steps (1, 9, 8 and 1 values), and coordinates and `position` match.
- Links: five created and two deleted leave exactly the three stored.
- Both notes are equal.
- The only difference: the stored Wait step's schema had lost two option lists, an `x-comment` and `x-unused-dependencies`.

The copy, Encharge flow *Copy of ZZ Capture Test - renamed duplicate* (404886), has the same values, except that the *Send email* step's empty `fromName` and `fromEmail` were dropped.

---

## 9. Calls never made

| Call or setting | Harm | Control |
|---|---|---|
| `PATCH /v1/integrations/{id}` on a flow not built this session | switches a live flow on or off; a settings change carries the status too | the guard; renames, settings of live flows and on/off are done by hand |
| `GET …/share-token` | mints a permanent read link to a flow and its emails; there is no revoke | the guard. Being GET-only is not enough on its own |
| `GET /v1/accounts` | its response holds the account API key | the guard |
| `PATCH /v1/accounts/me` | changes Joe's own People-table columns | the guard |
| `PATCH` / `DELETE /v1/tags-management/{tag}` | removes or renames a tag account-wide; site access breaks | the guard (reader doc 1.2) |
| every `DELETE` (links, segments, anything) | removes objects | the guard; cleanup is by hand |
| `PATCH /v1/folders/{id}` that drops children | unfiles objects from the sidebar | the guard allows appending only |
| `/v1/people…`, `/v1/broadcasts…` | changes contacts; sends to the list | the guard |
| Entered segment with `includePeople: "currentAndFuture"` | switching the flow on enrolls the whole segment | `"future"` unless Joe gives express permission |
| End flow naming a flow outside the build | pulls people out of a live flow | express permission |
| Add or Remove tag on `product_*`, `refunded_*`, `abandoned_active` | grants or removes site access | express permission |
| Archive person; Send webhook; Update field on one of the twelve protected fields | archives contacts; a webhook can call FlowMattic, a second writer; the protected fields are written by another system: ten by the FlowMattic routers, `LastLoginDate` and `LoginCount` by WP Fusion | express permission |

---

## 10. Evidence

**Capture 1 — PROVEN, 2026-09-23, 10:45:04–10:50:57 UTC (12:45–12:50 Paris).** Flows: create, steps, links, notes, rename, on/off, duplicate, share. 742 entries, 76 to `api.encharge.io`, 31 writes. Joe's actions: created *ZZ Capture Test*; added a Tag added trigger (typing `zz_capture` created the tag), a Wait of 1 day, *Send email* with Encharge email *Tester 1* and Add tag `zz_capture`; connected them; renamed the flow; added a sticky note and a text note; moved steps; replaced two links; switched the flow on, off and on; duplicated it; opened Share. At the end the flow was on with 0 entered, 0 queued and 0 failed at every step. File: `Encharge-Flow-Write-fixtures-for-Claude-2026-09-23.json`.

**Capture 2 — PROVEN, 2026-09-23, 11:31:51–11:47:52 UTC (13:31–13:47 Paris).** Fields, flow settings, the duplicate-send switch, End Flow, Check condition, a segment (two tries), an email copy and edit. 100 entries, all to `api.encharge.io`. Joe's actions: created Text field `zz_capture_field` and Date field `zz_capture_date`; created and deleted segment *zz segment* (1257210, the broken-row case); set ZZ Capture Test's re-entry to once, then once a month; changed Encharge flow Abandoned Cart Email Sending Sequence's re-entry to 30 days (section 7.5); switched on the duplicate-send switch; added End Flow naming the copy and a Check condition (Any of: date more than 1 day ago, field empty, has `zz_capture`, has `zz_capture_2`); duplicated Tester 1 as *Copy of Tester 1* (486819) and changed its heading; created *ZZ Capture Segment* (1257212) with three rows, All then Any. File: `Encharge-Write-capture2-evidence-for-Claude-2026-09-23.json`. It leaves out `GET /v1/accounts`, `PATCH /v1/accounts/me`, the contact lists and the autosave bodies.

**Reader read — PROVEN, 2026-09-23, 14:06:45–14:06:51 Paris (12:06 UTC).** Make data store 185037, written by the Flow Reader (9795088) and the Contact Reader (9790978); validator v0.2 passed both as complete single-run snapshots. Joe's actions just before: a row *Login Count · more than · 0* added to the Check condition of ZZ Capture Test - renamed (404885, step 1718247, saved 14:06:03 Paris), and a row *Segment · in · People NOT IN FLOW* added to ZZ Capture Segment (1257212). Kept: that step's Check condition string and preview, that segment, the types of four fields, a census of every condition row stored in the account (section 6.1), and the editor flags of every step in the six flows. File: `evidence/reader-2026-09-23.json` in the builder package. The whole read was checked and holds no API key.

**Reader read 2 — PROVEN, 2026-09-23, 15:38:18–15:38:24 Paris (13:38 UTC).** The same data store and readers; validator v0.2 passed both as complete single-run snapshots. Joe's actions just before: three rows added to the Check condition of ZZ Capture Test - renamed (404885, step 1718247, saved 15:36:55 Paris) and to ZZ Capture Segment (1257212): *zz_capture_date · is empty*, *zz_capture_field · is not empty*, *zz_capture_field · is · 1*. Kept: that step's Check condition string, preview and editor flags; that segment; the types of four fields; a new census of every condition row (42: the 36 of the first read plus these six, nothing else changed); and the count of identified contacts by their `mostrecent_abandonedproduct_id` (counts only), for test B3. File: `evidence/reader-2026-09-23-a10.json` in the builder package. It holds no API key and no contact data. Afterwards Joe opened ZZ Capture Segment's people: it loaded, 251 people (2026-09-24).

**Live tests — PROVEN, 2026-09-25, Paris afternoon.** Builder v0.3, unchanged, in the built-in browser pane on Joe's laptop, every call through the guard, permissions empty except the one row swap Joe allowed in B3. A13 and B0–B8 all passed; every flow the builder made arrived off, and the final reconcile found no ZZ flow or segment the ledger did not know (it compared only those; the ZZ tags and fields were listed). Results and the delete list: `Encharge-Live-Test-Results-for-Claude-2026-09-25.md`. Evidence, IDs and counts only: `evidence/live-tests-2026-09-25.json` in the builder package. The readers' buffers used for B3 and B8 held contact data and stayed in the session workspace. Two lessons for reading results:
- The browser pane's network log (`read_network_requests`) lists none of the page's own API calls, not even a control call that answered 200. To show nothing was sent, read `performance.getEntriesByType('resource')` in the page, with a control call just before.
- The Encharge app caches its lists per page load. Before reading an absence off the screen, refresh the page.

**Lists — PROVEN, 2026-09-26** (a read-only probe through the guard, builder v0.4 installed, after the re-check): `GET /v1/integrations` pages by `limit` and `offset` (14 flows: `limit=1` gives 1, `offset=1` gives the second, `limit=2` gives 2, past the end gives none, a last page of 1). `GET /v1/segments` and `GET /v1/tags-management` ignore both: every request gives the whole list (16 segments, 25 tags, even with `limit=1` or past the end). Whether those two cap a much longer list is UNVERIFIED (gap A19). The builder reads each list so.

**Re-check — PROVEN, 2026-09-26, Paris afternoon.** Builder v0.4, unchanged, in the built-in browser pane on Joe's laptop, permissions empty throughout. R1 (a Send email step with its own *On bounced* link), R2 (the full email swap through `&nbsp;`), R3 (an existing tag skipped) and R4 (the journal across a reload) all passed; the final reconcile found no ZZ flow or segment the ledger did not know (v0.4 compared only those; the ZZ tags and fields Joe made by hand in the captures were listed, and were not in the ledger), and the only flow on was 310308, untouched. R1's in-page check failed on two lines only, the listener ids v0.4 expected on save; Joe's control (on, then off, in his own browser) showed when Encharge adds them (section 7.4). Results: `Encharge-Recheck-Results-for-Claude-2026-09-26.md`. Evidence, IDs and counts only: `evidence/recheck-2026-09-26.json` in the builder package. The lesson for reading results: an expected value taken from an object in another state (310308 is on) is not evidence for a draft that has never been on; derive it from an object in the same state, or run a control that changes only that state.

**Build sitting 1 — PROVEN, 2026-09-28.** Builder v1.02, unchanged, in the built-in browser pane on Joe's laptop: the first live use of v1.00 to v1.02. The install passed (`locks: true`, gap A20; `sitting.js` in one call, 68,524 bytes as sent (68,525 by the install rehearsal's count), gap A21), then five runs, each verified on its first plain verify, and the end-of-sitting reconcile answered `ok`. Three deleted ZZ emails read by ID with `archived: true`. Results: `Encharge-Build-Sitting-1-Results-for-Claude-2026-09-28.md`.

**Master template test — PROVEN, 2026-09-28.** Builder v1.03 (v1.02's code), unchanged, same pane. Eight runs, 24 calls, all 200; each email stored exactly as sent; both reconciles `ok`. It closed gap A15 (D4 closed with the master itself) and found the email facts in section 5. Results: `Encharge-Master-Test-Results-for-Claude-2026-09-28.md`. Evidence, IDs, times, hashes, version metadata and short descriptions: `evidence/master-test-2026-09-28.json`.

**Build sitting 2a — PROVEN, 2026-10-19 and 20.** Builder v1.07, unchanged, in the built-in browser pane on Joe's laptop; begun by the chat *Encharge Sitting 2* on 19 Oct and closed by *Encharge Sitting 3* on 20 Oct, after an install in a new chat. Each install passed, `sitting.js` in one call of 69,611 bytes as sent, its fingerprint matched (gap A21, proven at that size), and each `refs` and `reconcile` call, sent as JSON text with its SHA-256 (v1.07's P2), was taken the first time. The master read back as an HTML block after Joe's change (section 5); four ZZ emails were built from it, each stored exact: Checkout Abandon 1 as v53 wrote it, with the square padded button (Joe changed one word by hand: the button's Outlook-only code survived), a bullet test of three list patterns (Joe picked pattern A), the v54 letter (v54 against v53: the same 37 entries, 12 letters changed in their swaps only, every list pattern A; built from master version 450981) and the v55 letter (decision 133's spacing). They were sent with Send Test to classic Outlook, Gmail, the Gmail and Outlook apps on iPhone and Apple Mail, then archived through Encharge's screens. Claude changed the master's logo on Joe's instruction (section 5). The closing reconcile resolved. Results: `Encharge-Sitting-2a-Results-for-Claude-2026-10-20.md`; the lessons: `Encharge-Sitting-2-Lessons-for-Builder-v1_08-for-Claude-2026-10-19.md`.

**Build sitting 2b — PROVEN, 2026-10-20.** Builder v1.07, unchanged, same pane and install. Two runs, each verified on its first plain verify: Checkout Abandon's three emails (9 calls, all 200, each stored exact), then Encharge flow Checkout Abandon (137 calls, all 200, about 90 s at 300 ms after each answer; 44 steps, 45 links, off). The flow's plan, 94,153 bytes, was the first over 24 KB to load live in parts: four `loadPart` calls, the whole plan's hash matched. One permission, `tag:abandoned_active` / `use`, with Joe's words of 20 Oct. The closing reconcile resolved, `failedOn` empty. Results: `Encharge-Sitting-2b-Results-for-Claude-2026-10-20.md`.

⚠️ **Capture hygiene.** *Export HAR (sanitized)* strips headers and cookies but **not response bodies**. `GET /v1/accounts`, which fires on every page load, returns the account's API key under `apiKeys`. Both captures contain it (the same single key). Captures are handled under the builder's rules (`SKILL.md`, rule 8): don't reload while recording; delete the HAR after uploading; evidence files leave that read out.

**How to capture** (Joe, Chrome DevTools; for any future capture, such as the Emails page for gap A17):
1. Open `app.encharge.io`, logged in, and let the page finish loading.
2. Press F12, open **Network**, tick **Preserve log**, click **Fetch/XHR**, type `api.encharge.io` in the filter box, and click **clear**.
3. Do the clicks. **Don't reload the page**: a reload fetches the account details with the API key. Settings save as you change them, so there is no Save button to find.
4. Click the download arrow → **Export HAR (sanitized)**, upload the file to the chat, then **delete it from the laptop**.

**RECORDED — Encharge's public source map, 2026-09-23.** The web app's API client is generated code (`store/persistence/api_client/generated/src/enchargeAPI.ts`), so a complete internal spec exists, and the published `merged.yaml` is a filtered part of it. Seen through a summarising web fetch, not byte-verified.

**RECORDED — Encharge changelog.** April 2026: "Improved flow APIs to reduce payload size", so these endpoints change. 2 June 2026: "The Encharge MCP is in testing now"; nothing since.
