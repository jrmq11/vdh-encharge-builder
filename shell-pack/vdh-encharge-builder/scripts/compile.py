#!/usr/bin/env python3
"""
compile.py — vdh-encharge-builder

Turns specs into a plan: the ordered list of Encharge calls that runner.js makes through guard.js.
A plan is plain JSON and reviewable before anything is sent. It holds our own keys, never Encharge IDs;
the runner fills those in from Encharge's responses and from the ledger.

    compile.py flow    <spec.json>     [context options] -o plan.json
    compile.py group   <spec.json>...  [context options] -o plan.json   (flows that end each other: shells first)
    compile.py objects <manifest.json> [context options] -o plan.json   (fields, tags, emails, segments, segment edits)
    compile.py objects <manifest.json> --switch-over [context options] -o plan.json
                                  only the segment edits the switch-over runs (D1): Encharge segment Abandoners (active
                                  last 24h); the plan's first calls read Encharge flow Abandoned Cart Email Sending
                                  Sequence and every flow of the manifest that enters that segment which the ledger holds
                                  (Checkout Abandon), and stop the run, nothing written, unless Encharge says each is
                                  switched off (deactivated or deactivated-user) (v1.02)
    compile.py needs   <manifest.json> --ledger ledger.json [-o needs.json]
                                  what the ledger must hold before each ship or gated flow runs: the emails its Send email
                                  steps name (made from the master by an objects run, or by Joe by hand) and the
                                  segments it enters (v1.02)

Context options:
    --catalogue data/encharge-catalogue.json   (default: next to this script)
    --ledger ledger.json          what already exists: {"flows": {key: {"id": …}}, "emails": …, "segments": …}
    --permissions permissions.json  Joe's express permissions, in his words
    --fields fields.json          REQUIRED: the account's person fields — the GET /v1/schemas response as saved,
                                  the person object, a list of fields, or {"fields": {name: {type, format, firstClassField}}}
    --tag-groups groups.json      {"template_pack_owner": ["product_canva_templates_1", …]}
    --tags tags.json              the account's tags: the GET /v1/tags-management response as saved, or a list of names.
                                  With it, tags that exist are not created again, and every tag a flow or segment
                                  uses must exist, be in the ledger, or be created by this build (--manifest)
    --manifest manifest.json      for flows: the fields and tags its shared block creates, so flows may use them
                                  before the objects run (--new-fields is the older, fields-only form). A field the
                                  account already has is used as the account has it, and must have the manifest's type
    --allow-parked                for a dry run only: a flow whose status is parked compiles too (otherwise refused);
                                  the plan is marked dryRunOnly, and the page refuses to load it
    --offline-permissions         for the offline suites only: a permission file inside the package's tests folder, and
                                  entries whose words are a note in brackets such as "(offline test only)", are taken;
                                  the plan is marked offlineOnly, and neither pagecmd.py nor the page will load it (v1.02)

Every plan records what it was made from (v1.02, `provenance`): the compiler's version and hash, and the SHA-256 of the
catalogue and of every input file (specs, manifest, ledger, permissions, fields, tags, tag groups). No clock time is
recorded, so the same inputs still compile to the same plan, byte for byte.

Refs in a plan (resolved by runner.js):
    {"$ref": "flow:<key>"}            a whole value, kept as a number
    "…@@flow:<key>@@…"                inside a string (paths, End Flow ids, the Check condition JSON)
    {"$merge": {"schema": "schema:<flow>/<step>", "values": {path: value}}}
                                      the schema Encharge returned when the step was created, with values set
    {"$spread": "segobj:<key>", …}    the segment Encharge returned when it was created, plus these keys
    {"$emailFromMaster": {…}}         a copy of a master email with text swapped in the design and the HTML
    {"$segmentEdit": {…}}             an existing segment as Encharge listed it, with rows removed and added

Rules (SKILL.md) are enforced here and again by guard.js at the wire. A spec that breaks one does not
compile: the plan is not written and the errors are printed. A value still to be decided ("TBD", "TBD:…") may
only sit in the manifest's `later` block, which is never compiled; `note` is prose and is ignored.
"""

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# v1.10 (P20): the compiler's work is in scripts/compiler/, by job (context, conditions, layout, flows, objects, provenance),
# moved there unchanged; this file is its command line, with every command, option, message and exit code as in v1.09, and
# it offers every name the modules define, as before (the suites import it). The modules load from beside this file
# whatever the current folder, and leave no __pycache__ in the package.
sys.dont_write_bytecode = True
# (gap A12's two switches live in scripts/compiler/conditions.py, where every module reads them: set them there, not here)
if HERE not in sys.path:
    sys.path.insert(0, HERE)
from compiler.context import *      # noqa: E402,F401,F403  account data, ledger, permissions, policy facts
from compiler.conditions import *   # noqa: E402,F401,F403  conditions, rows, checks
from compiler.layout import *       # noqa: E402,F401,F403  canvas positions
from compiler.flows import *        # noqa: E402,F401,F403  flows and groups
from compiler.objects import *      # noqa: E402,F401,F403  fields, tags, segments, emails; needs
from compiler.provenance import *   # noqa: E402,F401,F403  what a plan was made from


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('mode', choices=['flow', 'group', 'objects', 'needs'])
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--catalogue', default=os.path.join(HERE, '..', 'data', 'encharge-catalogue.json'))
    ap.add_argument('--ledger')
    ap.add_argument('--permissions')
    ap.add_argument('--fields')
    ap.add_argument('--tag-groups')
    ap.add_argument('--tags', help="the account's tags (GET /v1/tags-management as saved, or a list of names)")
    ap.add_argument('--manifest', help='for flows: the manifest whose shared fields and tags this build creates')
    ap.add_argument('--new-fields', help='manifest whose shared.fields this build creates (the older, fields-only --manifest)')
    ap.add_argument('--allow-parked', action='store_true',
                    help='for a dry run only: compile a parked flow too; the plan is marked dryRunOnly and the page refuses to load it')
    ap.add_argument('--offline-permissions', action='store_true',
                    help='the offline suites only: their permission files and bracketed words are taken; the plan is marked offlineOnly')
    ap.add_argument('--switch-over', action='store_true',
                    help='objects: only the switch-over\'s edit to Encharge segment Abandoners (active last 24h), behind reads that '
                         'stop the run unless Encharge flow Abandoned Cart Email Sending Sequence, and each flow of the manifest '
                         'entering that segment which the ledger holds, is switched off (D1)')
    ap.add_argument('-o', '--out')
    a = ap.parse_args(argv)
    for stream in (sys.stdout, sys.stderr):
        # the messages use → and ·, which a Windows console's default code page fails on; and every line ends in LF on any
        # platform, as pagecmd.py's output does (review of v1.01, N7: CRLF on Windows broke one assertion of the suite)
        try:
            stream.reconfigure(encoding='utf-8', newline='\n')
        except (AttributeError, ValueError):
            pass
    if a.mode == 'needs':
        if not a.ledger:
            print('NOT RUN — needs takes --ledger ledger.json', file=sys.stderr)
            return 1
        try:
            n = needs(a.inputs[0], load(a.ledger))
        except (OSError, ValueError, AttributeError, TypeError) as e:
            print('NOT RUN — %s' % e, file=sys.stderr)
            return 1
        for row in n['flows']:
            print('%-30s %-6s emails: %s%s' % (row['key'], row['status'], ', '.join('%s=%s' % (k, n['emails'][k].get('id', 'made by the objects plan'))
                                                                            for k in row['emails']) or '-',
                                              ('  segments: ' + ', '.join('%s=%s' % (k, n['segments'][k].get('id', 'made by the objects plan')) for k in row['segments'])) if row['segments'] else '')
                  + ('  ' + row['problem'] if row.get('problem') else ''))
        print('missing from the ledger: %d email(s)%s, %d segment(s)%s' % (
            len(n['missing']['emails']), (': ' + ', '.join(n['missing']['emails'])) if n['missing']['emails'] else '',
            len(n['missing']['segments']), (': ' + ', '.join(n['missing']['segments'])) if n['missing']['segments'] else ''))
        if a.out:
            with open(a.out, 'w', encoding='utf-8') as fh:
                json.dump(n, fh, indent=1, ensure_ascii=False)
        return 0
    if not a.out:
        print('NOT COMPILED — pass -o <plan.json>', file=sys.stderr)
        return 1
    if a.switch_over and a.mode != 'objects':
        print('NOT COMPILED — --switch-over is for an objects plan (the switch-over\'s segment edit)', file=sys.stderr)
        return 1
    if a.permissions and not a.offline_permissions:
        # the offline suites' permission files live in the package's tests folder; never for a real build (rule 5)
        tests = os.path.realpath(os.path.join(HERE, '..', 'tests')) + os.sep
        if os.path.realpath(a.permissions).startswith(tests):
            print('NOT COMPILED — %s is one of the offline suites\' permission files (tests/): never for a real build (rule 5). '
                  'Joe\'s permissions go in a permissions.json of the session\'s own' % a.permissions, file=sys.stderr)
            return 1
    if not a.fields:
        print('NOT COMPILED — pass --fields: the account\'s person fields (GET /v1/schemas, or this package\'s '
              '{"fields": {...}} map), so every row can be checked against its field\'s type', file=sys.stderr)
        return 1
    try:
        ctx = Context(load(a.catalogue), load(a.ledger, {}), load(a.permissions, []), load(a.fields), load(a.tag_groups, {}),
                      load(a.tags), offline_permissions=a.offline_permissions)
    except CompileError as e:
        print('NOT COMPILED — ' + str(e), file=sys.stderr)
        return 1
    ctx.allow_parked = a.allow_parked
    ctx.switch_over = a.switch_over
    try:
        for opt, path in (('--new-fields', a.new_fields), ('--manifest', a.manifest)):
            if not path:
                continue
            man = load(path)
            if not isinstance(man, dict):
                raise CompileError('%s: not a manifest' % opt)
            shared = man.get('shared') or {}
            for f in field_entries(shared, '%s shared' % opt):
                ftype = f.get('type', 'text')
                if ftype not in ('text', 'date'):
                    raise CompileError('%s: field "%s" has type %s; fields are text or date' % (opt, f['name'], json.dumps(f.get('type'))))
                if ctx.dead_reuse('fields', f['name']):
                    continue   # the objects plan refuses it; a flow that names it is refused as dead
                if is_router_field(f['name']) and not (ctx.fields is not None and f['name'] in ctx.fields):
                    ctx.router_absent.add(f['name'])   # the objects plan refuses it; a flow that names it is refused
                    continue
                if ctx.fields is not None and f['name'] in ctx.fields:
                    # Already in the account: this build does not create it, and every rule reads the account's own
                    # field, which must be the field the manifest describes (review of v1.00, 3)
                    problem = reuse_problem(ctx, f['name'], ftype)
                    if problem:
                        ctx.err('%s: %s' % (opt, problem))
                    continue
                ctx.new_fields[f['name']] = ftype
            if opt == '--manifest':
                for fl in man.get('flows') or []:
                    if isinstance(fl, dict) and isinstance(fl.get('key'), str):
                        ctx.manifest_status[fl['key']] = fl.get('status')
                for tg in tag_entries(shared, '--manifest shared'):
                    # a product or refund tag is created only with Joe's permission (the objects plan refuses it
                    # otherwise), so without one it is not counted as made by this build: it gets the go-live warning
                    if (not PROTECTED_TAG.search(tg) or ctx.has_permission('tag:%s' % tg, 'create')) and not ctx.dead_reuse('tags', tg):
                        ctx.new_tags.add(tg)
                ctx.build_segments.update(segment_keys(shared, '--manifest shared'))
                ctx.build_emails.update(e['key'] for e in block_list(shared, 'emails', '--manifest shared') if isinstance(e, dict) and isinstance(e.get('key'), str))
                read_later(man, ctx)
    except CompileError as e:
        print('NOT COMPILED — ' + str(e), file=sys.stderr)
        return 1
    try:
        if a.mode == 'flow':
            plan = compile_flow(load(a.inputs[0]), ctx)
        elif a.mode == 'group':
            plan = compile_group([load(p) for p in a.inputs], ctx)
        else:
            man = load(a.inputs[0])
            if a.switch_over:
                ctx.switch_over_flows = flows_entering(man, a.inputs[0], SWITCH_OVER['segment'], ctx)
            plan = compile_objects(man, ctx)
    except CompileError as e:
        ctx.err(str(e))
        plan = None
    except (KeyError, AttributeError, TypeError, IndexError, ValueError) as e:
        # a spec or manifest not in the shape the spec format describes: refused plainly, never half-compiled
        ctx.err('the input is not in the shape the spec format describes (%s: %s)' % (type(e).__name__, e))
        plan = None
    if ctx.errors or plan is None:
        print('NOT COMPILED — %d problem(s):' % len(ctx.errors), file=sys.stderr)
        for e in ctx.errors:
            print('  - ' + e, file=sys.stderr)
        return 1
    # The Encharge IDs the ledger marks deleted or failed, for the runner: a ref the page's refs give with one of them
    # (refs older than the ledger, not sent again after it was written back) stops the run before any call (the fourth
    # review of v1.01). Written only when there are some, so a plan without them is as before.
    dead = {k: sorted(v) for k, v in ctx.dead.items() if v}
    if dead:
        plan['deadIds'] = dead
    if a.offline_permissions:
        plan['offlineOnly'] = 'compiled with --offline-permissions for the offline suites: neither pagecmd.py nor the page loads it'
    plan['provenance'] = provenance(a, a.mode)
    with open(a.out, 'w', encoding='utf-8') as fh:
        json.dump(plan, fh, indent=1, ensure_ascii=False)
    print('compiled: %d calls → %s' % (len(plan['calls']), a.out))
    if plan.get('dryRunOnly'):
        print('  DRY RUN ONLY: ' + plan['dryRunOnly'])
    if plan.get('offlineOnly'):
        print('  OFFLINE ONLY: ' + plan['offlineOnly'])
    if plan.get('switchOver'):
        print('  SWITCH-OVER: ' + plan['switchOver'])
    for s in plan['report'].get('leftForSwitchOver', []):
        print('  left out for the switch-over (D1): segment edit on %s' % s)
    for w in plan['report']['warnings']:
        print('  warning: ' + w)
    for s in plan['report'].get('skipped', []):
        print('  not an Encharge step, listed for Joe: %s %s' % (s['key'], s['op']))
    return 0


if __name__ == '__main__':
    sys.exit(main())
