# shell-pack · compiler, specs and ledger (builder v1.11, specs v57)

For: Claude, on the workspace shell (Bash). Not for the Encharge page; the page files are in `../v1.11/`.

Private repo. Attach it in the session (`add_repo` with push access), then work from `shell-pack/`. Nothing to unzip or decode.

## Inside

- `vdh-encharge-builder/`: compiler (`scripts/compile.py`, `scripts/compiler/`), page-command tool (`live/pagecmd.py`), page files, data, references, SKILL.md.
- `build-specs-v57/`: `manifest.json`, `emails.json` (19 finished emails), one spec per flow, `tag-groups.json`. Written by flow map v57's export; regenerate with `node claude/export-specs.js <map> <out-folder>` (in the Project) when the map moves.
- `ledger.json`: the sitting ledger. The Project copy is `encharge-api/Encharge-Sitting-Ledger-2026-09-25.json`.
- `permissions.json`: `[]`. Joe's words are needed before anything goes in it.

Not stored, take fresh from the page at the start of a sitting: `fields.json` (`VDHSit.fields()`) and `tags.json` (`VDHSit.tags()`).

## Use (run from `shell-pack/`, with `python3 -B`)

- Needs: `python3 -B vdh-encharge-builder/scripts/compile.py --ledger ledger.json --permissions permissions.json --fields fields.json --tags tags.json --tag-groups build-specs-v57/tag-groups.json --manifest build-specs-v57/manifest.json needs build-specs-v57/template-delivery.json`
- Load a plan into the page: `python3 -B vdh-encharge-builder/live/pagecmd.py load <name> <plan.json> --out <file>`
- After a verified run: `python3 -B vdh-encharge-builder/live/pagecmd.py record ledger.json run.json --run <name> --plan <plan.json> --session "<label>" --tags tags.json --fields fields.json --out refs-<name>.js`
- All commands: `python3 -B vdh-encharge-builder/live/pagecmd.py` (no arguments).

## After each flow

Commit the updated `ledger.json` and push it, and also write it to the Project (`encharge-api/Encharge-Sitting-Ledger-2026-09-25.json`). Do not commit `fields.json`, `tags.json`, plans or run records; keep customer data out of the repo.

`vdh-encharge-builder/README-Project-copy.md` names old Project paths (`encharge-api/kit/...`). Ignore those lines; this file is current.
