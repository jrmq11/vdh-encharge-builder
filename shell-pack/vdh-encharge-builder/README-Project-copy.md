# vdh-encharge-builder v1.11 · working subset kept in the Project (2026-10-23)

For: Claude, in a cloud session, running the compiler and `pagecmd.py` on the workspace shell. Not the Encharge page install (that is the loader or the bundles in `encharge-api/install-pack-v1_11/`).

This is the part of the builder package needed to compile plans and build page commands: `scripts/` (compile.py, compiler/, guard.js, runner.js, verify.js, policy.py, check_package.py), `data/`, `live/` (pagecmd.py, install-manifest.json, the page files it reads, RUNBOOK.md), `references/` (spec-format.md, api-map.md) and SKILL.md. The tests, evidence, CHANGELOG and rehearsal files of the full package are left out.

Tested 2026-10-23 from a clean copy: `compile.py ... needs` and `pagecmd.py sizes` ran and gave the same answers as the full package.

## Where it lives

This folder is packed inside `encharge-api/kit/encharge-build-kit-v1_11.tar.gz.b64.txt` in the Project (unpack steps: `encharge-api/kit/README-Kit-Unpack.md`). Run with `python3 -B`; keep the folder layout (scripts/compiler/ beside scripts/compile.py; live/ beside data/).

Working inputs it needs beside it: `ledger.json` (`encharge-api/Encharge-Sitting-Ledger-2026-09-25.json`), `permissions.json` (`[]`), `fields.json`, `tags.json`, `tag-groups.json`, and the build specs in `build-specs-v59/` (in the kit).

## Typical calls

- Needs: `python3 -B scripts/compile.py --ledger ledger.json --permissions permissions.json --fields fields.json --tags tags.json --tag-groups tag-groups.json --manifest <manifest> needs <flow spec>`
- Load a plan into the page: `python3 -B live/pagecmd.py load <name> <plan.json> --out <file>`
- After a verified run: `python3 -B live/pagecmd.py record ledger.json run.json --run <name> --plan <plan.json> --session "<label>" --tags tags.json --fields fields.json --out refs-<name>.js`
- Full command list: `python3 -B live/pagecmd.py` (no arguments).

If the full package is available (the zip Joe attached at the start), use that instead.
