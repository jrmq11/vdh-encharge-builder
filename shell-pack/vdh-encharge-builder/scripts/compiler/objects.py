"""objects.py -- vdh-encharge-builder's compiler (v1.10, P20: moved out of compile.py as it stood in v1.09, the code
unchanged): fields, tags, segments, segment edits and emails; the switch-over (D1); what the ledger must hold (needs).

compile.py is the command line and keeps every command, option, message and exit code."""
import json
import os
import re
from .context import (CompileError, KEY_CHARS, OFF_STATUSES, PROTECTED_TAG, SWITCH_OVER, find_tbd, is_router_field,
    live_ledger, load, router_field_why)
from . import conditions as _conditions   # gap A12's switches, read where they live (a test sets them there)
from .conditions import expand, group, reuse_problem, row
from .flows import BUILT_STATUS

def block_list(block, key, where):
    """block[key] as a list ([] if absent); anything else is a clean refusal, never a traceback."""
    if block is None:
        return []
    if not isinstance(block, dict):
        raise CompileError('%s must be an object' % where)
    v = block.get(key)
    if v is None:
        return []
    if not isinstance(v, list):
        raise CompileError('%s.%s must be a list' % (where, key))
    return v


def field_entries(block, where, names_ok=False):
    """The fields of a manifest block: {"name", "type"} each; in `later`, a bare name is accepted too."""
    out = []
    for i, f in enumerate(block_list(block, 'fields', where)):
        if names_ok and isinstance(f, str) and f:
            out.append({'name': f})
        elif isinstance(f, dict) and isinstance(f.get('name'), str) and f['name']:
            out.append(f)
        else:
            raise CompileError('%s.fields[%d]: a field is {"name": "…", "type": "text" or "date"}' % (where, i))
    return out


def tag_entries(block, where):
    out = []
    for i, t in enumerate(block_list(block, 'tags', where)):
        if not isinstance(t, str) or not t:
            raise CompileError('%s.tags[%d]: a tag is its name, as text' % (where, i))
        out.append(t)
    return out


def segment_keys(block, where):
    out = set()
    for i, s in enumerate(block_list(block, 'segments', where)):
        if not isinstance(s, dict) or not isinstance(s.get('key'), str):
            raise CompileError('%s.segments[%d]: a segment has a "key"' % (where, i))
        out.add(s['key'])
    return out


EMAIL_KEYS = ('key', 'name', 'subject', 'master', 'swaps')


def email_problems(e):
    """What is wrong with one entry of shared.emails, in words ([] for an email the builder can make): its keys exactly
    key, name, subject, master and swaps; name and subject text, not empty; master a ledger key (text) or an Encharge ID
    (a whole number); at least one swap, each exactly a "path" (text, not empty) and an "html" (text). P7, v1.07: v1.06
    built an email in the spec format's draft shape (heading, text, button, ps) as an unchanged copy of the master,
    placeholders and all, and verify passed it, since it checks against the plan; a swap keyed "text" wrote undefined
    into the email, which verify caught only after Encharge had made it. If the email set's spec format v0.7 needs another
    key, it is added here then, on purpose."""
    if not isinstance(e, dict):
        return ['an email is an object: {"key", "name", "subject", "master", "swaps"}, not %s' % json.dumps(e)[:60]]
    out = []
    extra = [k for k in e if k not in EMAIL_KEYS]
    if extra:
        out.append('%s: not %s. An email is key, name, subject, master and swaps, each swap a path in the master\'s design '
                   'and the HTML that replaces the whole value stored there (references/api-map.md, section 5)'
                   % (', '.join(extra), 'an email\'s key' if len(extra) == 1 else 'keys of an email'))
    for k in ('name', 'subject'):
        if not isinstance(e.get(k), str) or not e[k]:
            out.append('%s is text, not empty' % k)
    m = e.get('master')
    if m is None:
        out.append('no master: name it by its ledger key (vdh_master_letter) or by its Encharge ID')
    elif not ((isinstance(m, str) and KEY_CHARS.fullmatch(m)) or (type(m) is int and m > 0)):
        out.append('master is a ledger key (text: letters, digits, _ and -) or an Encharge ID (a whole number), not %s'
                   % json.dumps(m)[:60])
    sw = e.get('swaps')
    if sw is None or sw == []:
        out.append('no swaps: it would be an unchanged copy of the master, placeholders and all')
    elif not isinstance(sw, list):
        out.append('swaps is a list of {"path", "html"}, not %s' % json.dumps(sw)[:60])
    else:
        for i, s in enumerate(sw, 1):
            if not isinstance(s, dict):
                why = 'it is %s' % json.dumps(s)[:60]
            elif set(s) != {'path', 'html'}:
                why = 'it has %s' % (', '.join(s) or 'no keys')
            elif not isinstance(s['path'], str) or not s['path']:
                why = 'its path is %s' % json.dumps(s['path'])[:60]
            elif not isinstance(s['html'], str):
                why = 'its html is %s' % json.dumps(s['html'])[:60]
            else:
                continue
            out.append('swap %d is not exactly a "path" and an "html", both text: %s' % (i, why))
    return out


def read_later(manifest, ctx):
    """The manifest's later block: parked tags, fields and segments, which the build must not use."""
    later = manifest.get('later')
    if later is not None and not isinstance(later, dict):
        raise CompileError('the manifest\'s later block must be an object')
    ctx.later_tags.update(tag_entries(later, 'later'))
    ctx.later_fields.update(f['name'] for f in field_entries(later, 'later', names_ok=True))
    ctx.parked_segments.update(segment_keys(later, 'later'))


# ---------------------------------------------------------------- objects: fields, tags, emails, segments

def compile_objects(manifest, ctx):
    for p in find_tbd({k: v for k, v in manifest.items() if k != 'later'}):
        ctx.err('%s is still to be decided (TBD); such values may only sit in the manifest\'s later block' % p)
    read_later(manifest, ctx)
    shared = manifest.get('shared') or {}
    if not isinstance(shared, dict):
        raise CompileError('the manifest\'s shared block must be an object')
    field_entries(shared, 'shared')
    tag_entries(shared, 'shared')
    segment_keys(shared, 'shared')
    # Each field, tag, email and segment once, and every key plain (the second review of v1.01: a segment or an email key
    # twice made two objects under one ref, and the first was lost to it; a key with an @ broke its ref mid-run)
    for kind, keyed in (('fields', lambda x: x.get('name') if isinstance(x, dict) else x), ('tags', lambda x: x),
                        ('emails', lambda x: x.get('key') if isinstance(x, dict) else None),
                        ('segments', lambda x: x.get('key') if isinstance(x, dict) else None)):
        names = [keyed(x) for x in block_list(shared, kind, 'shared')]
        twice = sorted({str(n) for n in names if names.count(n) > 1})
        if twice:
            ctx.err('shared.%s lists %s more than once: each once' % (kind, ', '.join(twice)))
        if kind in ('emails', 'segments'):
            for n in names:
                if not isinstance(n, str) or not KEY_CHARS.fullmatch(n):
                    ctx.err('%s key %s: a key is letters, digits, _ and - only' % (kind[:-1], json.dumps(n)))
    calls, expect = [], {'fields': [], 'tags': [], 'emails': [], 'segments': []}

    def add(**c):
        c['n'] = len(calls) + 1
        calls.append(c)
    if ctx.switch_over:
        # v1.02 (D1): a switch-over plan holds only the switch-over's segment edits; every other object of the manifest
        # was made by the build's objects plan before, and is named from the ledger
        shared = {'segmentEdits': [ed for ed in (shared.get('segmentEdits') or []) if is_switch_over(ctx, ed.get('segment'))]}
        if not shared['segmentEdits']:
            ctx.err('--switch-over: the manifest holds no edit to Encharge segment %s, the one the switch-over makes' % SWITCH_OVER['segmentName'])
    for f in shared.get('fields', []):
        name, ftype = f['name'], f.get('type', 'text')
        if not re.match(r'^[a-z][a-z0-9_]*$', name):
            ctx.err('field "%s": names are snake_case' % name)
            continue
        if ftype not in ctx.cat['fieldTypes'] or ftype == 'call':
            ctx.err('field "%s": type must be text or date' % name)
            continue
        why = ctx.dead_reuse('fields', name)
        if why:
            ctx.err(why)
            continue
        if is_router_field(name) and not (ctx.fields is not None and name in ctx.fields):
            # the guard never creates one: the run would stop there, after the fields before it were made (the second
            # review of the fixes, from the v50 manifest)
            ctx.err(router_field_why(name))
            continue
        if ctx.fields is not None and name in ctx.fields:
            # The account's field is used as it is, so it must be the field the manifest describes (review of v1.00, 3)
            problem = reuse_problem(ctx, name, ftype)
            if problem:
                ctx.err(problem)
            else:
                ctx.warnings.append('field "%s" already exists; not created' % name)
                # checked again in the read-back after the run, with the fields this plan creates
                expect.setdefault('fieldsReused', []).append({'name': name, 'type': ftype})
            continue
        tpl = ctx.cat['fieldTypes'][ftype]
        body = {'name': name, 'type': tpl['type'], 'title': name}
        if ftype == 'date':
            body['format'] = 'date-time'
        body.update({k: tpl[k] for k in ('readOnly', 'canMapFrom', 'firstClassField', 'array', 'createdBy')})
        if not expect['fields']:
            # the guard creates a field only after reading the account's fields through itself (it refuses one that exists)
            add(do='read-fields', key='before-fields', method='GET', path='/v1/schemas')
        add(do='create-field', key=name, method='POST', path='/v1/schemas/person/fields', body=[body])
        ctx.new_fields[name] = ftype
        expect['fields'].append({'name': name, 'type': ftype})
    if expect['fields'] or expect.get('fieldsReused'):
        # one fresh read of the account's fields after they are made: verify.js checks each against it, and each field
        # the manifest lists that was already there (its type, and that a flow can write it)
        add(do='read-back', key='fields', method='GET', path='/v1/schemas', save={'readback:schemas': 'objects'})
    existing = []
    for t in shared.get('tags', []):
        why = ctx.dead_reuse('tags', t)
        if why:
            ctx.err(why)
            continue
        if ctx.account_tags is not None and t in ctx.account_tags:
            existing.append(t)   # already in the account: nothing to create
            continue
        if not re.match(r'^[a-z0-9_]+$', t):
            ctx.err('tag "%s": names are snake_case' % t)
            continue
        if PROTECTED_TAG.search(t) and not ctx.permitted('tag:%s' % t, 'create'):
            ctx.err('tag "%s": product and refund tags are created at product go-live by FlowMattic routing, not by the builder' % t)
            continue
        # Encharge's answer lists the tags it made; verify.js checks it names this one
        add(do='create-tag', key=t, method='POST', path='/v1/tags-management', body={'tags': [{'tag': t}]},
            save={'created:tag:%s' % t: 'tags'})
        expect['tags'].append(t)
        ctx.new_tags.add(t)
    if existing:
        ctx.warnings.append('tags already in the account, not created: %s' % ', '.join(existing))
    made_here = set()   # the emails this manifest makes, in order: one of them may be a later email's master
    unknown_masters = {}   # v1.10 (P10): a master the ledger does not hold and no earlier email makes -> the emails naming it
    for i, e in enumerate(block_list(shared, 'emails', 'shared')):
        # P7 (v1.07): each email's shape, before anything else is read from it. One whose key is not plain was refused with
        # the manifest's other keys, above, and is not read further either (v1.06 went on to a traceback's words)
        bad = email_problems(e)
        if bad or not (isinstance(e, dict) and isinstance(e.get('key'), str) and KEY_CHARS.fullmatch(e['key'])):
            label = e['key'] if isinstance(e, dict) and isinstance(e.get('key'), str) else 'shared.emails[%d]' % i
            for b in bad:
                ctx.err('email "%s": %s' % (label, b))
            continue
        if ctx.known('emails', e.get('key')):
            led = (ctx.ledger.get('emails') or {}).get(e.get('key')) or {}
            ctx.err('email "%s" is in the ledger already (Encharge email %s): making it again would leave two under one key. A rebuild '
                    'needs the old entry marked failed first, once Joe agrees it is superseded; or give the email a key of its own'
                    % (e.get('key'), led.get('id')))
            continue
        master = e['master']
        if master not in made_here:
            ctx.check_dead('emails', master, 'email "%s": its master' % e['key'])
            # v1.10 (P10): a master named by a key the ledger does not hold, and no email before it here makes, is warned
            # about, as a Send email step's unknown email is: an Encharge ID in quotes, or a misspelt key, would otherwise
            # compile silently and stop the run before its first call. A warning only: the calls are the same
            if not isinstance(master, int) and not ctx.known('emails', master):
                unknown_masters.setdefault(master, []).append(e['key'])
        made_here.add(e['key'])
        mref = master if isinstance(master, int) else '@@email:%s@@' % master
        add(do='read-master', key=e['key'], method='GET', path='/v1/emails/%s' % mref, save={'master:%s' % e['key']: 'email'})
        add(do='create-email', key=e['key'], method='POST', path='/v1/emails',
            body={'$emailFromMaster': {'from': 'master:%s' % e['key'], 'name': e['name'], 'subject': e['subject'],
                                       'swaps': e['swaps']}},
            save={'email:%s' % e['key']: 'email.id'}, saveBody='sent:email:%s' % e['key'])
        # Live test B4 (2026-09-25): Encharge stores a created email exactly as sent, so verify.js compares them
        add(do='read-back', key='email:%s' % e['key'], method='GET', path='/v1/emails/@@email:%s@@' % e['key'],
            save={'readback:email:%s' % e['key']: 'email'})
        expect['emails'].append({'key': e['key'], 'name': e['name'], 'subject': e['subject'], 'swaps': e['swaps'],
                                 'sent': 'sent:email:%s' % e['key']})
    for master, keys in unknown_masters.items():
        ctx.warnings.append('master "%s" (of email%s %s) must exist (ledger) before this runs: the ledger does not hold it and no '
                            'email before %s in this manifest makes it%s' % (
                                master, '' if len(keys) == 1 else 's', ', '.join(keys), 'it' if len(keys) == 1 else 'them',
                                ' (an Encharge ID is a number, not in quotes)' if master.isdigit() else ' (is it spelt as the ledger spells it?)'))
    segments = shared.get('segments', [])
    id_to_key = {str((v or {}).get('id')): k for k, v in (ctx.ledger.get('segments') or {}).items()}

    def node(s):
        return id_to_key.get(str(s), 'segment %s' % s) if isinstance(s, int) else s
    uses = {}   # segment → the segments its rows name: new segments, and rows added to existing ones
    ctx.later_segments = {sg['key'] for sg in segments}
    for sg in segments:
        if ctx.known('segments', sg['key']):
            ctx.err('segment "%s" already exists (ledger); edit it with segmentEdits instead' % sg['key'])
            continue
        cond = expand(sg['if'], ctx)
        op = next(iter(cond))
        if any(isinstance(i, dict) for i in cond[op]):
            ctx.err('segment "%s": Encharge segments are one level only; make the inner group its own segment, '
                    'list it first, and use it as a row ["segment", "<its key>", "in"]' % sg['key'])
            continue
        uses[sg['key']] = {node(r[1]) for r in cond[op] if r[0] == 'segment'}
        ctx.where = ('new segment %s' % sg['key'], 'segment')
        g = group(ctx, op, cond[op], 'segment', 'segment/%s' % sg['key'])
        ctx.later_segments.discard(sg['key'])
        ctx.new_segments.add(sg['key'])
        add(do='create-segment', key=sg['key'], method='POST', path='/v1/segments/',
            body={'name': sg['name'], 'color': sg.get('color', '#00805e'), 'objectName': 'person'},
            save={'segment:%s' % sg['key']: 'segment.id', 'segobj:%s' % sg['key']: 'segment'})
        add(do='segment-rows', key=sg['key'], method='PATCH', path='/v1/segments/@@segment:%s@@' % sg['key'],
            body={'$spread': 'segobj:%s' % sg['key'], 'conditions': g})
        add(do='segment-preview', key=sg['key'], method='GET', path='/v1/segments/@@segment:%s@@/preview' % sg['key'],
            expectStatus=200)
        expect['segments'].append({'key': sg['key'], 'name': sg['name'], 'color': sg.get('color', '#00805e'),
                                   'objectName': 'person', 'conditions': g})
    ctx.later_segments = set()
    edits, edited, added_names = [], set(), {}
    for ed in shared.get('segmentEdits', []):
        seg = ed['segment']
        if not ctx.switch_over and is_switch_over(ctx, seg):
            # v1.02 (review of v1.01, N3): never in an ordinary objects plan, whatever permissions are given
            ctx.left_for_switch_over.append(seg)
            ctx.warnings.append('segment edit on "%s" (Encharge segment %s) is left out: it starts Encharge flow %s, which is on, so it runs '
                                'only inside the switch-over, after Joe has switched that flow off (references/gaps.md, D1): compile it '
                                'then with --switch-over' % (seg, SWITCH_OVER['segmentName'], SWITCH_OVER['flowName']))
            continue
        if isinstance(seg, str) and seg in ctx.dead_keys['segments']:
            ctx.err('segment edit names segment "%s", which the ledger marks %s: it is never used again' % (seg, ctx.dead_keys['segments'][seg]))
            continue
        seg_id = seg if isinstance(seg, int) else (ctx.ledger.get('segments', {}).get(seg) or {}).get('id')
        if seg_id is None:
            ctx.err('segment edit: "%s" is not in the ledger' % seg)
            continue
        if isinstance(seg_id, int) and seg_id in ctx.dead['segments']:
            ctx.err('segment edit names Encharge segment %d, which the ledger marks %s: it is never used again' % (seg_id, ctx.dead['segments'][seg_id]))
            continue
        if str(seg_id) in edited:
            ctx.err('segment "%s" is edited twice; put all its rows in one edit' % seg)
            continue
        edited.add(str(seg_id))
        if not ctx.permitted('segment:%s' % seg, 'patch') and not ctx.permitted('segment:%s' % seg_id, 'patch'):
            ctx.err('segment edit on "%s" changes a live segment; needs express permission (references/gaps.md, D2)' % seg)
            continue
        if not ed.get('addRows') and not ed.get('removeRows'):
            ctx.err('segment edit on "%s": no addRows or removeRows' % seg)
            continue
        ctx.where = ('edit to segment %s' % seg, 'edit')
        adds = [row(ctx, r, 'segment', 'segment-edit/%s/add/%d' % (seg, i)) for i, r in enumerate(ed.get('addRows', []))]
        removes = [row(ctx, r, 'segment', 'segment-edit/%s/remove/%d' % (seg, i), where=None)
                   for i, r in enumerate(ed.get('removeRows', []))]
        sig_add, sig_rem = [row_sig(r) for r in adds], [row_sig(r) for r in removes]
        if len(set(sig_add)) != len(sig_add) or len(set(sig_rem)) != len(sig_rem):
            ctx.err('segment edit on "%s": a row is listed twice' % seg)
        if set(sig_add) & set(sig_rem):
            ctx.err('segment edit on "%s": the same row is both removed and added' % seg)
        named = {node(r[1]) for r in ed.get('addRows', []) if isinstance(r, list) and r and r[0] == 'segment'}
        added_names[str(seg)] = named
        if node(seg) in named:
            ctx.err('segment edit on "%s": a segment cannot contain itself' % seg)
        uses.setdefault(node(seg), set()).update(named)
        edits.append((seg, seg_id, adds, removes))
    loop = find_loop(uses)
    if loop:
        ctx.err('segments name each other in a loop: %s' % ' → '.join(loop))
    if _conditions.A12_SEGMENTS_OPEN and ctx.numeric_segments:
        # A new segment is tainted if it holds a number written as text, or names a tainted segment (gap A12).
        tainted, grew = set(ctx.numeric_segments), True
        while grew:
            grew = False
            for k, named in uses.items():
                if k in ctx.new_segments and k not in tainted and named & tainted:
                    tainted.add(k)
                    grew = True
        for seg, _, adds, _ in edits:
            hit = sorted(n for n in added_names.get(str(seg), set()) if n in tainted)
            if hit:
                ctx.err('edit to segment %s: its new row names segment %s, which depends on a number written as text '
                        'on a Text field, and would change a live segment at once. It waits for gap A12, which live '
                        'test B3 closes' % (seg, ', '.join(hit)))
    if ctx.switch_over and edits:
        # v1.02 (D1): the first calls read every flow the segment starts, and the run stops there, nothing written, unless
        # Encharge says each is switched off: the live flow, and each flow of the manifest whose trigger enters the segment
        # and which the ledger holds (Checkout Abandon, which Joe switches on only at step 5). runner.js, requireStatusIn.
        reads = [(SWITCH_OVER['flowId'], 'Encharge flow %s' % SWITCH_OVER['flowName'])]
        flows = ctx.raw_ledger.get('flows') or {}
        for key, name in ctx.switch_over_flows:
            # the flow under its key, and one a rebuild moved off it (<key>-live-<date>, <key>-old-<date>): each the ledger
            # holds and Joe has not deleted. A failed one is read too (the third review of the fixes): a draft switched on
            # without the ledger knowing may have been marked failed while on
            for lk in sorted(k for k in flows if k == key or re.fullmatch(re.escape(key) + r'-(live|old)-\d{4}-\d{2}-\d{2}(-\d+)?', k)):
                led = flows[lk]
                if not isinstance(led, dict) or not isinstance(led.get('id'), int) or led.get('state') == 'deleted' or led['id'] == SWITCH_OVER['flowId']:
                    continue
                if led.get('state') == 'handed-over':
                    ctx.err('--switch-over: Encharge flow %s (%d, ledger key %s) is switched on (handed-over): the edit to Encharge segment %s '
                            'comes before Checkout Abandon is switched on (D1, step 5); settle with Joe first' % (name, led['id'], lk, SWITCH_OVER['segmentName']))
                if all(fid != led['id'] for fid, _ in reads):
                    reads.append((led['id'], 'Encharge flow %s' % name))
        calls[0:0] = [{'do': 'require-off', 'key': 'switch-over', 'method': 'GET', 'path': '/v1/integrations/%d' % fid,
                       'requireStatusIn': list(OFF_STATUSES), 'what': what} for fid, what in reads]
    if edits:
        # Two checks made in the page, which send nothing. The first, before the plan's first write: each segment
        # exists and is one flat group, each row to remove matches exactly one row, and none is left empty. The
        # second, just before the first edit, once the plan's new segments exist: every edit is simulated in full,
        # against one read, and no segment may end up naming itself through the others. So no live segment is
        # changed unless every edit can be made.
        first = sum(1 for c in calls if c.get('do') == 'require-off')
        calls[first:first] = [
            {'do': 'read-segments', 'key': 'before-writes', 'method': 'GET', 'path': '/v1/segments',
             'save': {'segments:before': 'segments'}},
            {'do': 'check-edits', 'key': 'before-writes', 'method': 'LOCAL',
             'body': {'$segmentCheck': {'from': 'segments:before', 'mode': 'early',
                                        'edits': [{'id': sid, 'remove': rem, 'adds': len(ad)} for _, sid, ad, rem in edits]}}}]
        add(do='read-segments', key='before-edits', method='GET', path='/v1/segments', save={'segments:all': 'segments'})
        add(do='check-edits', key='before-edits', method='LOCAL',
            body={'$segmentCheck': {'from': 'segments:all', 'mode': 'full',
                                    'edits': [{'id': sid, 'remove': rem, 'add': ad} for _, sid, ad, rem in edits]}})
    for seg, seg_id, adds, removes in edits:
        # The read the edit is made from, kept a second time under this segment's own key: segments:all is read again
        # before the next edit, so only segments:before:<id> still says how this one was just before its edit (review of
        # v1.00, 7). A segment is edited once per plan, so each such key is written once.
        add(do='read-segments', key=str(seg), method='GET', path='/v1/segments',
            save={'segments:all': 'segments', 'segments:before:%s' % seg_id: 'segments'})
        add(do='segment-edit', key=str(seg), method='PATCH', path='/v1/segments/%s' % seg_id,
            body={'$segmentEdit': {'from': 'segments:all', 'id': seg_id, 'remove': removes, 'add': adds}},
            saveBody='sent:segment:%s' % seg_id)
        add(do='segment-preview', key=str(seg), method='GET', path='/v1/segments/%s/preview' % seg_id, expectStatus=200)
        expect.setdefault('segmentEdits', []).append({'segment': seg_id, 'removeRows': removes, 'addRows': adds,
                                                      'sent': 'sent:segment:%s' % seg_id})
    if expect['segments'] or expect.get('segmentEdits'):
        add(do='read-back', key='segments', method='GET', path='/v1/segments', save={'readback:segments': 'segments'})
    for i, c in enumerate(calls):
        c['n'] = i + 1
    report = {'warnings': ctx.warnings, 'permissionsUsed': ctx.used_permissions}
    if ctx.left_for_switch_over:
        report['leftForSwitchOver'] = [str(x) for x in ctx.left_for_switch_over]
    plan = {'kind': 'objects', 'calls': calls, 'expect': expect, 'report': report}
    if ctx.switch_over:
        plan['switchOver'] = ('the switch-over\'s edit to Encharge segment %s: run only after Joe has switched Encharge flow %s off, and '
                              'before he switches Checkout Abandon on (D1); its first calls stop the run, nothing written, unless Encharge '
                              'says each flow they read is switched off' % (SWITCH_OVER['segmentName'], SWITCH_OVER['flowName']))
    return plan


def is_switch_over(ctx, seg):
    """Whether a segment edit names the segment the switch-over edits (D1), by key or by Encharge ID, however the ID is
    written (the review of the fixes: an ID written as text passed an equality with the number)."""
    if seg == SWITCH_OVER['segment'] or str(seg).strip() == str(SWITCH_OVER['segmentId']):
        return True
    if isinstance(seg, str):
        led = (ctx.ledger.get('segments') or {}).get(seg) or {}
        return str(led.get('id')).strip() == str(SWITCH_OVER['segmentId'])
    return False


def flows_entering(manifest, manifest_path, segment_key, ctx):
    """[(flow key, display name)] of the manifest's flows whose trigger enters the segment, read from their specs beside
    the manifest; a spec that cannot be read is an error, since the switch-over could not show its flow is off."""
    base = os.path.dirname(os.path.abspath(manifest_path))
    out = []
    for fl in manifest.get('flows') or []:
        if not isinstance(fl, dict) or not fl.get('file'):
            continue
        try:
            spec = load(os.path.join(base, fl['file']))
        except (OSError, ValueError) as e:
            raise CompileError('--switch-over: the spec of flow %s cannot be read (%s): the plan could not show it is off' % (fl.get('key'), e))
        trig = (spec or {}).get('trigger') or {}
        if str(trig.get('op', '')).upper() == 'ENTERED SEGMENT' and is_switch_over(ctx, trig.get('segment')):
            name = (spec.get('flow') or {}).get('name') or fl.get('key')
            # the ledger keys a flow by its spec's own key; the manifest's may differ (the third review): both are read
            for k in dict.fromkeys(k for k in (fl.get('key'), (spec.get('flow') or {}).get('key')) if isinstance(k, str)):
                out.append((k, name))
    return out


def row_sig(r):
    """What a row tests, without its uuid; the value is left out for is empty / is not empty (runner.js rowSig)."""
    c = {k: v for k, v in r.items() if k != 'uuid'}
    if c.get('condition') in ('is empty', 'is not empty'):
        c.pop('value', None)
    return json.dumps(c, sort_keys=True)


def find_loop(graph):
    """A loop in {node: {nodes}}, as a list of nodes ending where it started, or None."""
    state, path = {}, []

    def visit(n):
        state[n] = 1
        path.append(n)
        for m in sorted(graph.get(n, ())):
            if state.get(m) == 1:
                return path[path.index(m):] + [m]
            if state.get(m) is None:
                found = visit(m)
                if found:
                    return found
        state[n] = 2
        path.pop()
        return None
    for n in sorted(graph):
        if state.get(n) is None:
            found = visit(n)
            if found:
                return found
    return None


def needs(manifest_path, ledger):
    """What the ledger must hold before each ship or gated flow of a manifest runs (v1.02): the emails its Send email
    steps name (made from the master by an objects run, or by Joe by hand) and the segments its Entered segment trigger names, each with
    the ledger's ID or MISSING; the objects the manifest's shared block makes are marked so. A flow whose spec is missing
    is named. Nothing is compiled."""
    man = load(manifest_path)
    base = os.path.dirname(os.path.abspath(manifest_path))
    shared = (man or {}).get('shared') or {}
    made_emails = {e.get('key') for e in shared.get('emails') or [] if isinstance(e, dict)}
    made_segments = {s.get('key') for s in shared.get('segments') or [] if isinstance(s, dict)}
    live = live_ledger(ledger)
    have = lambda kind, key: (live.get(kind) or {}).get(key, {}).get('id') if isinstance((live.get(kind) or {}).get(key), dict) else None   # noqa: E731
    out = {'flows': [], 'emails': {}, 'segments': {}}
    for fl in man.get('flows') or []:
        if not isinstance(fl, dict) or fl.get('status') not in BUILT_STATUS:
            continue
        path = os.path.join(base, fl.get('file') or '')
        row = {'key': fl.get('key'), 'status': fl.get('status'), 'emails': [], 'segments': []}
        if not fl.get('file') or not os.path.isfile(path):
            row['problem'] = 'spec file not found: %s' % fl.get('file')
            out['flows'].append(row)
            continue
        spec = load(path)
        for st in [spec.get('trigger') or {}] + list(spec.get('steps') or []):
            op = str(st.get('op', '')).upper()
            if op == 'SEND' and isinstance(st.get('email'), str):
                row['emails'].append(st['email'])
            if op == 'ENTERED SEGMENT' and isinstance(st.get('segment'), str):
                row['segments'].append(st['segment'])
        for kind, keys, made in (('emails', row['emails'], made_emails), ('segments', row['segments'], made_segments)):
            for k in keys:
                out[kind][k] = {'id': have(kind, k)} if have(kind, k) is not None else ({'madeByObjectsPlan': True} if k in made else {'id': 'MISSING'})
        out['flows'].append(row)
    out['missing'] = {k: sorted(x for x, v in out[k].items() if v.get('id') == 'MISSING') for k in ('emails', 'segments')}
    return out
