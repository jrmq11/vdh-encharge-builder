"""flows.py -- vdh-encharge-builder's compiler (v1.10, P20: moved out of compile.py as it stood in v1.09, the code
unchanged): flows and groups: steps, links, settings, the flow shell and its readback.

compile.py is the command line and keeps every command, option, message and exit code."""
import json
import re
from .context import CompileError, KEY_CHARS, PROTECTED_TAG, ROUTER_FIELDS, find_tbd, router_field_why
from .conditions import check_string, expand, flatten, name_checks
from .layout import layout

NOT_ENCHARGE_STEPS = {'HOLD', 'EXITS', 'GREETING', 'LINKS', 'TEST', 'WATCH', 'FLOWMATTIC', 'AIRTABLE', 'MAKE',
                      'KADENCE', 'CACHE', 'DM CHAMP', 'SEGMENT', 'SETTING', 'EXCLUSIVE', 'FIELD', 'SOURCE', 'ENCHARGE'}
TRIGGERS = {'TAG ADDED': '/added-tag', 'ENTERED SEGMENT': '/entered-segment', 'EVENT': '/event'}
STEPS = {'WAIT': '/delay-v2', 'ADD TAG': '/add-tag', 'REMOVE TAG': '/remove-tag', 'SET FIELD': '/change-field',
         'SEND': '/send', 'CHECK': '/check-field', 'FILTER': '/check-field', 'END': '/end-flow-v2'}
REENTRY = {'always', 'once', 'per30d'}
SETTINGS_KEYS = {'reentry', 'duplicateSend'}   # v1.09 (P16): every key a spec's settings may hold
# v1.11 (P21; the independent review of v1.09): the keys each step type takes, besides key and op (spec format, section 2).
# Any other key on a step the builder builds is refused, naming it, as P7 refuses an email's and P16 a flow's settings'
# (v1.10 ignored a misspelt key: duplicatSend on a Send email, onBounce for onBounced). duplicateSend and onBounced on the
# wrong step keep the refusals of their own (P15, A13). Rows that are not Encharge steps are prose, and not checked.
STEP_KEYS = {'TAG ADDED': {'tag', 'next'}, 'ENTERED SEGMENT': {'segment', 'includePeople', 'next'},
             'EVENT': {'name', 'filterProperties', 'next'}, 'WAIT': {'minutes', 'hours', 'days', 'next'},
             'ADD TAG': {'tags', 'tag', 'next'}, 'REMOVE TAG': {'tags', 'tag', 'next'}, 'SET FIELD': {'field', 'value', 'next'},
             'SEND': {'email', 'duplicateSend', 'onBounced', 'next'}, 'CHECK': {'if', 'yes', 'no'}, 'FILTER': {'if', 'yes', 'no'},
             'END': {'flow', 'next'}}
# The keys name_checks() gives the checks it adds (key__2, key__3 …): a spec's own keys may not take that form, or a
# step would silently replace a check or be replaced by one (review of v1.00, 2)
GENERATED_KEY = re.compile(r'__\d+$')
# The statuses the builder builds (the email set's map). "test", or no status at all, is for the builder's own test flows,
# whose names carry ZZ; parked is refused (a dry run aside); anything else is refused
BUILT_STATUS = {'ship', 'gated'}


# ---------------------------------------------------------------- flows

def schema_has(ctx, op, path):
    schema = ctx.cat['operations'][op]['inputSchema']
    node = schema
    for part in path.split('.'):
        props = (node or {}).get('properties') or {}
        if part not in props:
            return False
        node = props[part]
    return True


def step_values(ctx, spec, s, op, flow_key):
    """The values the app sets for each step type (catalogue 'values')."""
    o = s['op']
    here = 'flow %s, step %s' % (flow_key, s['key'])
    if o == 'TAG ADDED':
        ctx.check_tag(s['tag'], here)
        return {'tag': s['tag']}
    if o == 'ENTERED SEGMENT':
        inc = s.get('includePeople', 'future')
        if inc != 'future' and not ctx.permitted('includePeople:currentAndFuture', 'use'):
            ctx.err('%s: includePeople "%s" enrolls everyone already in the segment; needs express permission' % (s['key'], inc))
        seg = s['segment']
        if seg not in ctx.build_segments and seg not in ctx.new_segments:
            ctx.check_dead('segments', seg, '%s: Entered segment' % s['key'])
        if not isinstance(seg, int):
            if seg in ctx.parked_segments and not ctx.known('segments', seg) and seg not in ctx.build_segments:
                ctx.err('%s: segment "%s" is only in the manifest\'s later block (parked); un-park it first' % (s['key'], seg))
            elif not ctx.known('segments', seg) and seg not in ctx.build_segments:
                ctx.warnings.append('%s: segment "%s" must exist (ledger) before this runs' % (s['key'], seg))
        return {'segment': seg if isinstance(seg, int) else {'$ref': 'segment:%s' % seg}, 'includePeople': inc}
    if o == 'EVENT':
        return {'name': s['name'], 'filterProperties': s.get('filterProperties', [])}
    if o == 'WAIT':
        units = [u for u in ('minutes', 'hours', 'days') if u in s]
        if len(units) != 1 or not isinstance(s[units[0]], int) or s[units[0]] < 1:
            ctx.err('%s: a WAIT needs exactly one of minutes, hours or days, as a whole number' % s['key'])
            return {}
        return {'period.enabled': True, 'period.quantity': s[units[0]], 'period.unit': units[0]}
    if o in ('ADD TAG', 'REMOVE TAG'):
        tags = s.get('tags') or ([s['tag']] if 'tag' in s else [])
        if not tags:
            ctx.err('%s: no tags' % s['key'])
        for t in tags:
            if PROTECTED_TAG.search(t) and not ctx.permitted('tag:%s' % t, 'use'):
                ctx.err('%s: %s on "%s" changes site access; needs express permission (rule 3)' % (s['key'], o, t))
            ctx.check_tag(t, here)
        return {'tags': tags}
    if o == 'SET FIELD':
        f = s['field']
        if f not in ctx.new_fields:
            ctx.check_dead('fields', f, '%s: Set field' % s['key'])
        if f in ROUTER_FIELDS and not ctx.permitted('field:%s' % f, 'set'):
            ctx.err('%s: "%s" is written by the FlowMattic routers; needs express permission' % (s['key'], f))
        if ctx.fields is not None and f not in ctx.fields and f not in ctx.new_fields:
            ctx.err('%s: field "%s" is only in the manifest\'s later block (parked); un-park it first' % (s['key'], f)
                    if f in ctx.later_fields else ('%s: %s' % (s['key'], router_field_why(f)) if f in ctx.router_absent
                                                   else '%s: unknown field "%s"' % (s['key'], f)))
        elif ((ctx.fields or {}).get(f) or {}).get('readOnly'):
            ctx.err('%s: field "%s" is read-only in the account; a flow cannot set it' % (s['key'], f))
        return {'fieldName': f, 'fieldValue': s['value']}
    if o == 'SEND':
        email = s['email']
        if email not in ctx.build_emails:
            ctx.check_dead('emails', email, '%s: Send email' % s['key'])
        if not isinstance(email, int) and not ctx.known('emails', email):
            ctx.warnings.append('email "%s" must exist (ledger) before this runs' % email)
        vals = {'email.id': email if isinstance(email, int) else {'$ref': 'email:%s' % email},
                'email.html': '', 'email.flowId': '{{encharge.flowId}}', 'email.stepId': '{{encharge.stepId}}',
                'email.subject': '', 'email.fromName': '', 'email.accountId': '{{encharge.accountId}}', 'email.fromEmail': ''}
        # v1.09 (P15): true or false only; the flow's setting and this step's own are checked in compile_flow, so a
        # string such as "false" never reaches here (it read as true, and switched repeat sends on)
        fs = spec.get('settings') if isinstance(spec.get('settings'), dict) else {}
        dup = s.get('duplicateSend', fs.get('duplicateSend', False)) is True
        if dup:
            vals['userCanReceiveMoreThanOnce'] = True
        elif fs.get('reentry', 'always') != 'once':
            ctx.warnings.append('%s: the flow re-enters but this email has the duplicate-send switch off; '
                                'a second run would stall here (email set V2)' % s['key'])
        return vals
    if o == 'END':
        target = s.get('flow', 'self')
        if target == 'self':
            return {'flowIds': '{{encharge.flowId}}'}
        in_build = target in ctx.group_keys
        if not in_build:
            ctx.check_dead('flows', target, '%s: End flow' % s['key'])
        if not in_build and not ctx.permitted('flow:%s' % target, 'end'):
            ctx.err('%s: End Flow naming "%s", which is not in this build, needs express permission (rule 2)' % (s['key'], target))
        if isinstance(target, int):
            return {'flowIds': str(target)}
        if not in_build and not ctx.known('flows', target):
            ctx.err('%s: flow "%s" is unknown (not in this build and not in the ledger)' % (s['key'], target))
        return {'flowIds': '@@flow:%s@@' % target}
    raise CompileError('no values for %s' % o)


def compile_flow(spec, ctx, create_shell=True, group_keys=None):
    # Rows the builder does not build (HOLD, EXITS…) are prose for Joe: a TBD there holds nothing up
    scan = dict(spec, steps=[s if str(s.get('op', '')).upper() not in NOT_ENCHARGE_STEPS else {}
                             for s in spec.get('steps', []) if isinstance(s, dict)])
    for p in find_tbd(scan):
        ctx.err('%s is still to be decided (TBD); a flow with one waits in the manifest\'s later block' % p)
    ctx.group_keys = set(group_keys or []) | {spec['flow']['key']}
    fk = spec['flow']['key']
    name = spec['flow']['name']
    settings = spec.get('settings', {})
    if not isinstance(settings, dict):
        ctx.err('settings: an object of %s' % ', '.join(sorted(SETTINGS_KEYS)))
        settings = {}
    # v1.09 (P16): a key the builder does not know is refused, not ignored (reEntry for reentry gave the default re-entry)
    for k in sorted(set(settings) - SETTINGS_KEYS):
        ctx.err('settings.%s is not a setting the builder knows (%s); a misspelt one would be silently ignored'
                % (k, ', '.join(sorted(SETTINGS_KEYS))))
    if not isinstance(settings.get('reentry', 'always'), str) or settings.get('reentry', 'always') not in REENTRY:
        ctx.err('settings.reentry must be one of %s' % sorted(REENTRY))   # v1.09: a list or object refused by name
    # v1.09 (P15): duplicateSend is true or false, in the settings and on any Send email step
    if 'duplicateSend' in settings and not isinstance(settings['duplicateSend'], bool):
        ctx.err('settings.duplicateSend is %s: write true or false (a string such as "false" would read as true)'
                % json.dumps(settings['duplicateSend']))
    for n, st in enumerate([spec.get('trigger')] + list(spec.get('steps', []))):
        if not isinstance(st, dict):
            continue
        where = st.get('key') if isinstance(st.get('key'), str) else ('the trigger' if n == 0 else 'step %d (no key)' % n)
        if n and 'key' not in st:
            ctx.err('step %d has no key' % n)
        if 'duplicateSend' in st and str(st.get('op', '')).upper() != 'SEND':
            # v1.09 (the review of v1.09): only a Send email step takes it; anywhere else it would be silently ignored
            ctx.err('%s: duplicateSend belongs on a SEND step or in settings, not on %s' % (where, st.get('op') or 'this step'))
        elif 'duplicateSend' in st and not isinstance(st['duplicateSend'], bool):
            ctx.err('%s: duplicateSend is %s: write true or false' % (where, json.dumps(st['duplicateSend'])))
    if not name or not isinstance(name, str):
        ctx.err('flow name missing')
    # ---- nodes: trigger + steps; checks expanded into flat chains
    trig = spec['trigger']
    if trig.get('op') not in TRIGGERS:
        raise CompileError('trigger op must be one of %s' % sorted(TRIGGERS))
    raw = [trig] + list(spec.get('steps', []))
    keys = [s['key'] for s in raw]
    if not isinstance(fk, str) or not KEY_CHARS.fullmatch(fk):
        raise CompileError('flow key %s: a key is letters, digits, _ and - only' % json.dumps(fk))
    if ctx.known('flows', fk):
        # a live entry (the fifth review of v1.01): the old draft would stay alive beside the new one, under one name
        led = (ctx.ledger.get('flows') or {}).get(fk) or {}
        ctx.err('flow %s is in the ledger already (Encharge flow %s, %s): building it again would make a second draft beside it. '
                'A rebuild takes the old entry off the key first (SKILL.md, The ledger): a draft Joe agrees is superseded is '
                'marked failed; a flow he has switched on is never marked failed while it is on, but moves, state and all, to a '
                'key of its own, and is rebuilt only on his go; or give the new flow a key of its own' % (fk, led.get('id'), led.get('state') or 'no state'))
    if not all(isinstance(k, str) and k for k in keys):
        raise CompileError('every step key is text, such as "c1"')
    if len(keys) != len(set(keys)):
        raise CompileError('step keys must be unique')
    for k in keys:
        # json.dumps: a key holding a newline or a quote prints as it is written in the spec, on any console (v1.02, N7)
        if not KEY_CHARS.fullmatch(k):
            ctx.err('step key %s: a key is letters, digits, _ and - only' % json.dumps(k))
        elif GENERATED_KEY.search(k):
            ctx.err('step key %s ends with "__" and a number: the builder keeps those for the checks it adds when it '
                    'splits a nested CHECK; rename the step' % json.dumps(k))
    # The builder builds ship and gated flows; the spec's status and the manifest's (with --manifest) must agree
    status, listed = spec['flow'].get('status'), ctx.manifest_status.get(fk)
    if status is not None and listed is not None and status != listed:
        ctx.err('flow %s: the manifest says status %s, the spec %s' % (fk, json.dumps(listed), json.dumps(status)))
    for st in sorted({x for x in (status, listed) if x is not None}, key=str):
        if st == 'parked':
            if ctx.allow_parked:
                if 'parked flow %s' % fk not in ctx.dry_run_only:
                    ctx.dry_run_only.append('parked flow %s' % fk)
            else:
                ctx.err('flow %s is parked (its status in the export): the builder builds ship and gated flows only, and '
                        'the email set un-parks a flow first' % fk)
        elif st == 'test':
            pass   # judged with a missing status, below
        elif st not in BUILT_STATUS:
            ctx.err('flow %s: status %s is not one the builder builds (ship or gated; test for a ZZ test flow)' % (fk, json.dumps(st)))
    if (status in (None, 'test') and listed in (None, 'test')) and 'ZZ' not in str(name):
        ctx.err('flow %s: a flow with status test, or none, is a test flow, and its name carries ZZ; the email set\'s flows say ship, gated '
                'or parked' % fk)
    nodes, edges, skipped = {}, [], []
    for s in raw:
        o = str(s.get('op', '')).upper()
        s['op'] = o
        if 'onBounced' in s and s['onBounced'] is None:   # null means "no path", as for next, yes and no
            del s['onBounced']
        if 'onBounced' in s and o != 'SEND':
            ctx.err('%s: onBounced belongs on a SEND step, not %s' % (s.get('key'), o))
        if o in NOT_ENCHARGE_STEPS:
            skipped.append({'key': s['key'], 'op': o, 'text': s.get('text', '')})
            continue
        if o == 'LIVE FLOW':
            ctx.err('%s: editing a live flow needs express permission (rule 2); build it new instead' % s['key'])
            continue
        if s is not trig and o not in STEPS:
            raise CompileError('%s: unknown op "%s"' % (s['key'], o))
        if o in STEP_KEYS:   # v1.11 (P21)
            extra = sorted(k for k in s if k not in STEP_KEYS[o] and k not in ('key', 'op', 'duplicateSend', 'onBounced'))
            for k in extra:
                ctx.err('%s: %s is not a key of %s %s step (it takes %s): a misspelt key is refused, not ignored'
                        % (s['key'], k, 'an' if o[0] in 'AEIOU' else 'a', o, ', '.join(sorted(STEP_KEYS[o]))))
        if o in ('CHECK', 'FILTER'):
            cond = expand(s['if'], ctx)
            yes, no = s.get('yes'), s.get('no')
            counter = [0]

            def alloc():
                counter[0] += 1
                return '\x00tmp%d' % counter[0]
            entry, checks = flatten(cond, yes, no, alloc)
            checks = name_checks(entry, checks, s['key'])
            for c in checks:
                if c['key'] in nodes:
                    raise CompileError('two steps are named "%s" once CHECK %s is split into checks' % (c['key'], s['key']))
                ctx.where = ('flow %s, check %s' % (fk, c['key']), 'check')
                nodes[c['key']] = {'key': c['key'], 'op': '/check-field', 'spec_op': 'CHECK',
                                   'values': {'conditions': check_string(ctx, c['op'], c['rules'], '%s/%s' % (fk, c['key']))}}
                for kind in ('yes', 'no'):
                    if c[kind]:
                        edges.append((c['key'], c[kind], kind))
            continue
        op = TRIGGERS.get(o) if s is trig else STEPS[o]
        if s['key'] in nodes:
            raise CompileError('two steps are named "%s" once nested CHECKs are split into checks' % s['key'])
        nodes[s['key']] = {'key': s['key'], 'op': op, 'spec_op': o, 'values': step_values(ctx, spec, s, op, fk)}
        if s.get('next'):
            edges.append((s['key'], s['next'], 'next'))
        if o == 'SEND' and 'onBounced' in s:
            # A13, closed 2026-09-25: the app stores a bounce as its own link out of the Send email step, carrying
            # only the On bounced condition. One link carrying two conditions has never been seen stored.
            if not s['onBounced'] or not isinstance(s['onBounced'], str):
                ctx.err('%s: onBounced names the step a bounced email goes to' % s['key'])
            elif s['onBounced'] == s.get('next'):
                ctx.err('%s: onBounced and next both lead to %s; one link carrying two conditions has not been seen '
                        'stored, so give the bounce a step of its own' % (s['key'], s['onBounced']))
            else:
                edges.append((s['key'], s['onBounced'], 'bounced'))
    skipped_keys = {x['key'] for x in skipped}
    for a, b, kind in edges:
        if b in skipped_keys:
            ctx.err('%s → %s: the target is not an Encharge step' % (a, b))
        elif b not in nodes:
            ctx.err('%s → %s: no such step' % (a, b))
    if ctx.errors:
        return None
    # ---- reachability and cycles
    reach, stack = set(), [trig['key']]
    while stack:
        k = stack.pop()
        if k in reach:
            continue
        reach.add(k)
        stack.extend(b for a, b, _ in edges if a == k)
    for k in nodes:
        if k not in reach:
            ctx.err('%s is not reachable from the trigger' % k)
    state = {}

    def cyc(k):
        state[k] = 1
        for a, b, _ in edges:
            if a == k:
                if state.get(b) == 1 or (state.get(b) is None and cyc(b)):
                    return True
        state[k] = 2
        return False
    if cyc(trig['key']):
        ctx.err('the flow has a loop; Encharge flows here are built without loops')
    # ---- value paths exist in the catalogue schema
    for n in nodes.values():
        for p in n['values']:
            if not schema_has(ctx, n['op'], p):
                ctx.err('%s: "%s" is not a setting of %s' % (n['key'], p, n['op']))
    if ctx.errors:
        return None

    pos = layout(list(nodes), edges, trig['key'], {k: n['op'] for k, n in nodes.items()})
    created_as = ctx.cat['createdAs']['captured']
    configured_as = dict(ctx.cat['configuredAs'].get('stored', {}), **ctx.cat['configuredAs']['captured'])
    calls, flags = [], {}

    def add(**c):
        c['n'] = len(calls) + 1
        calls.append(c)
    if create_shell:
        add(do='create-flow', method='POST', path='/v1/integrations/', body={'name': name},
            save={'flow:%s' % fk: 'integration.id'})
    for k, n in nodes.items():
        mc = created_as.get(n['op'])
        if mc is None:
            mc = ctx.cat['createdAs']['default']
            ctx.uncaptured.append('%s %s' % (k, n['op']) if create_shell else '%s/%s %s' % (fk, k, n['op']))
        add(do='create-step', step=k, method='POST', path='/v1/steps/',
            body={'integrationId': {'$ref': 'flow:%s' % fk}, 'serviceId': 'encharge',
                  'data': {'editor': {'coordinates': pos[k], 'mustConfig': mc}, 'operationKey': n['op'],
                           'inputFields': {}, 'outputFields': {}}},
            save={'step:%s/%s' % (fk, k): 'step.id', 'position:%s/%s' % (fk, k): 'step.data.position',
                  'schema:%s/%s' % (fk, k): 'step.data.inputFields', 'out:%s/%s' % (fk, k): 'step.data.outputFields'})
        mc2 = configured_as.get(n['op'], ctx.cat['configuredAs']['default'])
        flags[k] = mc2
        add(do='configure-step', step=k, method='PATCH', path='/v1/steps/@@step:%s/%s@@' % (fk, k),
            body={'integrationId': {'$ref': 'flow:%s' % fk}, 'serviceId': 'encharge',
                  'data': {'editor': {'coordinates': pos[k], 'mustConfig': mc2}, 'operationKey': n['op'],
                           'inputFields': {'$merge': {'schema': 'schema:%s/%s' % (fk, k), 'values': n['values']}},
                           'outputFields': {'$ref': 'out:%s/%s' % (fk, k)},
                           'position': {'$ref': 'position:%s/%s' % (fk, k)}}},
            saveBody='sent:step:%s/%s' % (fk, k))
    links = []
    for a, b, kind in edges:
        if kind == 'yes':
            data = ctx.cat['links']['conditionYes']
        elif kind == 'no':
            data = ctx.cat['links']['conditionNo']
        elif kind == 'bounced':
            data = ctx.cat['links']['fromSendOnBounced']
        elif nodes[a]['op'] == '/send':
            data = ctx.cat['links']['fromSendOnDelivered']
        else:
            data = None
        body = {'source': {'$ref': 'step:%s/%s' % (fk, a)}, 'target': {'$ref': 'step:%s/%s' % (fk, b)}}
        if data is not None:
            body['data'] = data
        add(do='link', step='%s→%s%s' % (a, b, ' (on bounced)' if kind == 'bounced' else ''), method='POST',
            path='/v1/links/', body=body)
        links.append({'source': a, 'target': b, 'data': data})
    notes = []
    for i, nt in enumerate(spec.get('notes', [])):
        near = pos.get(nt.get('near'), {'x': 25, 'y': -50})
        t = nt.get('type', 'note')
        # the note's own id is made fresh when the call is sent (runner.js $uuid), so a rebuild never reuses one
        body = {'id': {'$uuid': 'note'}, 'coordinates': {'y': near['y'], 'x': near['x'] + 400},
                'dimensions': {'height': 200, 'width': 200}, 'integrationId': {'$ref': 'flow:%s' % fk},
                'type': t, 'text': nt['text']}
        if t == 'annotation':
            body['dimensions'] = {'height': 67.5, 'width': 180}
            body['fontSize'] = nt.get('fontSize', 24)
        add(do='note', method='POST', path='/v1/decorations', body=body)
        notes.append({'type': t, 'text': nt['text']})
    data = dict(ctx.cat['flowSettings'].get(settings.get('reentry', 'always'), {}))   # an unknown value is already an error
    if data:
        add(do='settings', method='PATCH', path='/v1/integrations/@@flow:%s@@' % fk,
            body={'id': {'$ref': 'flow:%s' % fk}, 'name': name, 'status': 'deactivated', 'data': data})
    add(do='read-back', method='GET', path='/v1/integrations/@@flow:%s@@' % fk,
        save={'readback:%s' % fk: 'integration'})
    if create_shell:
        flags_note(ctx)
    plan = {
        'kind': 'flow', 'flow': fk, 'name': name, 'calls': calls,
        'expect': {'flow': fk, 'name': name, 'status': 'deactivated', 'data': data,
                   'steps': {k: {'op': n['op'], 'values': n['values'], 'mustConfig': flags[k], 'sent': 'sent:step:%s/%s' % (fk, k)}
                             for k, n in nodes.items()},
                   'links': links, 'notes': notes},
        'report': {'skipped': skipped, 'warnings': ctx.warnings, 'permissionsUsed': ctx.used_permissions}
    }
    if create_shell and ctx.dry_run_only:
        plan['dryRunOnly'] = dry_run_note(ctx)
    return plan


def dry_run_note(ctx):
    """A plan compiled with --allow-parked counts calls for a dry run; VDHSit.load refuses to keep it."""
    return '%s: compiled with --allow-parked for a dry run only; the page refuses to load it' % ', '.join(ctx.dry_run_only)


def flags_note(ctx):
    """One line per run for the steps whose creation flags were never captured (the email set's question 2)."""
    if ctx.uncaptured:
        ctx.warnings.append('creation flags not captured for %d step(s) (%s): the default is sent, and the configure call '
                            'that follows sets the flags Encharge keeps (proven live, test B5, 2026-09-25); verify.js '
                            'checks every stored step\'s flags' % (len(ctx.uncaptured), ', '.join(ctx.uncaptured)))
        ctx.uncaptured = []


def compile_group(specs, ctx):
    """Flows that end each other: create every shell first, then each flow's steps (api-map section 2)."""
    keys = [s['flow']['key'] for s in specs]
    names = [s['flow']['name'] for s in specs]
    # Each flow once (review of v1.00, 6): a key twice made two shells under one ref, and the first was lost to it;
    # a name twice gives two drafts whose names cannot say which spec each came from (reconcile finds drafts by name).
    twice = sorted({str(k) for k in keys if keys.count(k) > 1})
    if twice:
        raise CompileError('flow key %s is in the group more than once: each flow once' % ', '.join(twice))
    twice = sorted({str(n) for n in names if names.count(n) > 1})
    if twice:
        raise CompileError('two flows in the group are both named %s: give each flow its own name' % ', '.join(twice))
    calls = []
    for s in specs:
        calls.append({'do': 'create-flow', 'method': 'POST', 'path': '/v1/integrations/',
                      'body': {'name': s['flow']['name']}, 'save': {'flow:%s' % s['flow']['key']: 'integration.id'}})
    plans = []
    for s in specs:
        p = compile_flow(s, ctx, create_shell=False, group_keys=keys)
        if p is None:
            return None
        plans.append(p)
        calls.extend(p['calls'])
    for i, c in enumerate(calls):
        c['n'] = i + 1
    flags_note(ctx)
    plan = {'kind': 'group', 'flows': keys, 'calls': calls,
            'expect': {p['flow']: p['expect'] for p in plans},
            'report': {'skipped': sum((p['report']['skipped'] for p in plans), []), 'warnings': ctx.warnings,
                       'permissionsUsed': ctx.used_permissions}}
    if ctx.dry_run_only:
        plan['dryRunOnly'] = dry_run_note(ctx)
    return plan
