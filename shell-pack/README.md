# shell-pack · compiler, specs and ledger (builder v1.11, specs v59)

For: Claude, on the workspace shell (Bash). Not for the Encharge page; the page files are in `../v1.11/`.

Private repo. Attach it in the session (`add_repo` with push access), then work from `shell-pack/`. Nothing to unzip or decode.

## Inside

- `vdh-encharge-builder/`: compiler (`scripts/compile.py`, `scripts/compiler/`), page-command tool (`live/pagecmd.py`), page files, data, references, SKILL.md.
- `build-specs-v59/`: `manifest.json`, `emails.json` (19 finished emails), one spec per flow, `tag-groups.json`. Written by flow map v59's export; regenerate with `node claude/export-specs.js <map> <out-folder>` (in the Project) when the map moves.
- `ledger.json`: the sitting ledger. The Project copy is `encharge-api/Encharge-Sitting-Ledger-2026-09-25.json`.
- `permissions.json`: `[]`. Joe's words are needed before anything goes in it.

Not stored, take fresh from the page at the start of a sitting: `fields.json` (`VDHSit.fields()`) and `tags.json` (`VDHSit.tags()`).

## Flow names: display name, API name, ID

An Encharge flow has two names. The **display name** is what the app shows; Joe can rename it at any time. The **API name** (`apiName`) is set once, when the flow is created, and never changes; Encharge adds " (2)" when the name was already taken. Neither is a key: the builder, the ledger and the readers find every flow by its **Encharge ID**. Reconcile matches a name only to spot a draft it has no ID for, and checks both names.

On 2026-10-23 Joe renamed ten built flows (display names only, emails not renamed): for example 409556 shows as *Abandon: Hacks Library checkout* and keeps the API name *Checkout Abandon*. The ledger's flow entries carry `name` (display), `apiName` and, where renamed, `renamed`. The v59 specs use the display names; a spec's flow name is used only when a flow is created.

## Use (run from `shell-pack/`, with `python3 -B`)

- Needs: `python3 -B vdh-encharge-builder/scripts/compile.py --ledger ledger.json --permissions permissions.json --fields fields.json --tags tags.json --tag-groups build-specs-v59/tag-groups.json --manifest build-specs-v59/manifest.json needs build-specs-v59/template-delivery.json`
- Load a plan into the page: `python3 -B vdh-encharge-builder/live/pagecmd.py load <name> <plan.json> --out <file>`
- After a verified run: `python3 -B vdh-encharge-builder/live/pagecmd.py record ledger.json run.json --run <name> --plan <plan.json> --session "<label>" --tags tags.json --fields fields.json --out refs-<name>.js`
- All commands: `python3 -B vdh-encharge-builder/live/pagecmd.py` (no arguments).

## After each flow

Commit the updated `ledger.json` and push it, and also write it to the Project (`encharge-api/Encharge-Sitting-Ledger-2026-09-25.json`). Do not commit `fields.json`, `tags.json`, plans or run records; keep customer data out of the repo.

`vdh-encharge-builder/README-Project-copy.md` names old Project paths (`encharge-api/kit/...`). Ignore those lines; this file is current.
