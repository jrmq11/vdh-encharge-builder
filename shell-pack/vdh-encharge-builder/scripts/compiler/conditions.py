"""conditions.py -- vdh-encharge-builder's compiler (v1.10, P20: moved out of compile.py as it stood in v1.09, the code
unchanged): checking, expanding and turning conditions into Check steps and segment rows: tests, field types, gap A12.

compile.py is the command line and keeps every command, option, message and exit code."""
import json
import re
import uuid
from .context import CompileError, router_field_why

UUID_NS = uuid.UUID('6f1c1d2e-8a51-4b0f-9d7e-0c1a2b3c4d5e')   # fixed namespace: the same spec compiles to the same plan
                 # row under it touched it and hid the On delivered label (re-check R1; Joe, 2026-09-26: "450 px fine")

# Spec tests → the words Encharge stores (api-map section 6.1). Tests are named after the Build tab's words.
TESTS = {'present': ('tag', 'has'), 'absent': ('tag', 'has not'),
         'is': ('field', 'is'), 'isNot': ('field', 'is not'), 'empty': ('field', 'is empty'), 'filled': ('field', 'is not empty'),
         'olderThanDays': ('field', 'before period'), 'withinDays': ('field', 'after period'),
         'moreThan': ('field', 'is more than'),
         'in': ('segment', 'in'), 'notIn': ('segment', 'not in')}
# On the Build tab's Number menu, but not yet seen stored in a person condition (gap A7c).
NOT_YET = {'lessThan': 'less than', 'atLeast': 'at least', 'isAnyOf': 'is any of', 'isNotAnyOf': 'is not any of'}
# Old spec words → the Build tab's word (Joe, 2026-09-23: "its 'more than' not greater than").
RENAMED = {'greaterThan': 'moreThan'}
# Every stored condition row in the account, by field type (api-map 6.1). Anything else is refused until seen.
PROVEN_ON = {'string': {'is', 'is not', 'is empty', 'is not empty'}, 'boolean': {'is', 'is not'},
             'number': {'is more than'}, 'date-time': {'before period', 'after period', 'is empty'}}
# "is empty" and "is not empty" on fields a user created (createdBy "user", as every stored one is): the value Encharge
# stored for the same test, field type and place (captures and the readers; gap A10, evidence/reader-2026-09-23-a10.json),
# so a rebuilt check or segment equals the stored one. Encharge has stored "", 0 and no value for these tests, so the
# value seems to carry nothing, but that is an inference: a pairing not listed here has not been seen stored and is
# refused (gap A11), and so is either test on a field no user created (the one stored: segment Subscribers, email
# "is not empty", with no value).
EMPTY_VALUE = {('is empty', 'string', 'check'): '',
               ('is empty', 'date-time', 'check'): 0, ('is empty', 'date-time', 'segment'): 0,
               ('is not empty', 'string', 'check'): 0, ('is not empty', 'string', 'segment'): ''}
# Gap A12: whether a Text row whose value is a number written as text ("1") finds the contacts whose value is 1.
# Segments and checks may compare differently, so each has its own switch. While the segment one is open, such a row
# is refused in an edit to an existing segment, directly or through a new segment it names (it would change a live
# segment at once), and warned about in new segments. Live test B3 closed it for segments on 2026-09-25: a segment
# row "mostrecent_abandonedproduct_id is "1"" held all 18 contacts the Contact Reader counted with the value 1, and all
# 3 FlowMattic wrote (page count at two page sizes, a hashed match, and Joe's count in Encharge). The check one stays
# open until a run with a test contact shows it (the email set's TEST rows; Checkout Abandon's switch-over test).
A12_SEGMENTS_OPEN = False
A12_CHECKS_OPEN = True
NUMERIC_TEXT = re.compile(r'\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*', re.ASCII)
NEEDS_TYPE = {'before period': 'date-time', 'after period': 'date-time', 'is more than': 'number'}
TYPE_NAME = {'string': 'Text', 'boolean': 'True/False', 'number': 'Number', 'date-time': 'Date'}


def det_uuid(*parts):
    return str(uuid.uuid5(UUID_NS, '/'.join(str(p) for p in parts)))


# ---------------------------------------------------------------- conditions

def field_ref(ctx, name, check=True):
    """Built-in fields are written bare in conditions, custom ones as data.<name> (api-map section 6.1)."""
    bare = name[5:] if name.startswith('data.') else name
    if check and bare not in ctx.new_fields:
        ctx.check_dead('fields', bare, ctx.where[0])
    if check and ctx.fields is not None and bare not in ctx.fields and bare not in ctx.new_fields:
        if bare in ctx.later_fields:
            ctx.err('field "%s" is only in the manifest\'s later block (parked); un-park it first' % bare)
        elif bare in ctx.router_absent:
            ctx.err(router_field_why(bare))
        else:
            ctx.err('unknown field "%s" (not in the account and not created by this build)' % bare)
    return bare if bare in ctx.first_class else 'data.' + bare


def field_type(ctx, name):
    """The field's type as the account holds it. Only a field the account lacks, which this build creates, takes the
    manifest's type (review of v1.00, 3: the manifest's word used to win over the account's)."""
    bare = name[5:] if name.startswith('data.') else name
    f = (ctx.fields or {}).get(bare)
    if f:
        return f.get('format') or f.get('type')
    if bare in ctx.new_fields:
        return {'date': 'date-time', 'text': 'string'}.get(ctx.new_fields[bare])
    return None


def account_kind(af):
    """'text' or 'date' for an account field the manifest's two types describe, else None."""
    if af.get('type') == 'string' and af.get('format') == 'date-time':
        return 'date'
    if af.get('type') == 'string' and not af.get('format'):
        return 'text'
    return None


def reuse_problem(ctx, name, ftype):
    """Why a manifest field the account already holds cannot be the field the manifest describes, or None.
    The account's field is used as it is: its type must be the manifest's, and a flow must be able to write it."""
    af = (ctx.fields or {}).get(name) or {}
    kind = account_kind(af)
    if kind != ftype:
        have = {'date': 'a Date field', 'text': 'a Text field'}.get(kind) or 'a field of type %s' % json.dumps(
            af.get('format') or af.get('type'))
        return ('field "%s" already exists in the account as %s, but the manifest makes it a %s field: change the '
                'manifest, or use another name' % (name, have, ftype))
    if af.get('readOnly'):
        return 'field "%s" already exists in the account and is read-only: a flow cannot write it; use another name' % name
    return None


def expand(cond, ctx):
    """Normalise a spec condition into {'all'|'any': [rule | group]}, expanding tag groups and 'or' shorthands.
    A child group with its parent's operator, or with a single item, is merged into the parent: it is still one level."""
    if isinstance(cond, list):
        cond = {'all': [cond]}
    if not isinstance(cond, dict) or len(cond) != 1 or next(iter(cond)) not in ('all', 'any'):
        raise CompileError('a condition must be {"all": [...]} or {"any": [...]}, got %s' % json.dumps(cond)[:120])
    op = next(iter(cond))
    if not isinstance(cond[op], list) or not cond[op]:
        raise CompileError('an empty "%s" list: a condition needs at least one rule' % op)
    items = []

    def add_group(sub):
        sop = next(iter(sub))
        if sop == op or len(sub[sop]) == 1:
            items.extend(sub[sop])
        else:
            items.append(sub)
    for it in cond[op]:
        if isinstance(it, dict):
            add_group(expand(it, ctx))
            continue
        if not isinstance(it, list) or len(it) < 3:
            raise CompileError('a rule is [subject, name, test(, value)], got %s' % json.dumps(it))
        subject, name, test = it[0], it[1], it[2]
        if subject == 'tagGroup':
            tags = ctx.tag_groups.get(name)
            if not tags:
                raise CompileError('unknown tag group "%s"' % name)
            if test == 'any':
                add_group({'any': [['tag', t, 'present'] for t in tags]})
            elif test == 'none':
                # None of the group's tags is one AND group of absent rows: merged into an AND parent, but kept as a
                # group of its own inside an ANY, where merging would mean "lacks at least one" (review of v1.00, 1)
                add_group({'all': [['tag', t, 'absent'] for t in tags]})
            else:
                raise CompileError('tag group test "%s" has no Encharge form (conditions are one level only; gap C3)' % test)
            continue
        if subject == 'field' and test in ('emptyOrOlderThanDays', 'emptyOrIs'):
            if len(it) < 4:
                raise CompileError('"%s" on %s needs a value' % (test, name))
            second = ['field', name, 'olderThanDays' if test == 'emptyOrOlderThanDays' else 'is', it[3]]
            add_group({'any': [['field', name, 'empty'], second]})
            continue
        items.append(it)
    # A group of one group is that group.
    if len(items) == 1 and isinstance(items[0], dict):
        return items[0]
    return {op: items}


def is_number(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def unproven(ftype, keyword, test, name, mode, built_in):
    """Why this test cannot be written on this field yet, or None when the account holds a stored row like it."""
    if ftype not in TYPE_NAME:
        return 'field %s has type %s; the compiler writes rows only on Text, True/False, Number and Date fields' % (
            name, json.dumps(ftype))
    need = NEEDS_TYPE.get(keyword)
    if need and ftype != need:
        return '"%s" is not a %s field; "%s" needs one' % (name, TYPE_NAME[need], test)
    if ftype == 'number' and keyword not in PROVEN_ON['number']:
        return '"%s" on the Number field %s is not verified yet (gap A7c)' % (test, name)
    if keyword in ('is empty', 'is not empty'):
        if built_in:
            return ('"%s" on the built-in or system field %s is not verified yet (gap A11): the empty tests are proven '
                    'only on fields a user created' % (test, name))
        if (keyword, ftype, mode) not in EMPTY_VALUE:
            return '"%s" on the %s field %s in a %s is not verified yet (gap A11)' % (
                test, TYPE_NAME[ftype], name, 'CHECK' if mode == 'check' else 'segment')
        return None
    if keyword in PROVEN_ON.get(ftype, ()):
        return None
    if ftype == 'date-time':
        return '"%s" on the Date field %s is not verified; use olderThanDays, withinDays or empty' % (test, name)
    kind = TYPE_NAME.get(ftype, 'a %s' % ftype if ftype else 'an untyped')
    return '"%s" on the %s field %s is not verified yet' % (test, kind, name)


def typed_value(ctx, name, ftype, test, value, where):
    """is / isNot: the value must fit the field's type, as the app's own input stores it (api-map 6.1).
    where is None for a row to remove, which is matched, never written; otherwise the place and its kind ('check',
    'segment' for a new one, 'edit' for rows added to an existing one) come from ctx.where."""
    if value is None:
        ctx.err('"%s" on %s needs a value' % (test, name))
    elif ftype == 'boolean' and not isinstance(value, bool):
        ctx.err('"%s" on the True/False field %s needs true or false' % (test, name))
    elif ftype == 'string':
        if is_number(value):
            ctx.err('"%s" on the Text field %s: write %s as text, "%s". The app stores what is typed on a Text field '
                    'as text, numbers included (gap A10)' % (test, name, json.dumps(value), json.dumps(value)))
        elif not isinstance(value, str):
            ctx.err('"%s" on the Text field %s needs text' % (test, name))
        elif value == '':
            ctx.err('"%s" on %s with an empty value is not a stored form; use empty or filled' % (test, name))
        elif NUMERIC_TEXT.fullmatch(value) and where is not None and (
                A12_CHECKS_OPEN if ctx.where[1] == 'check' else A12_SEGMENTS_OPEN):
            place, kind = ctx.where
            if kind == 'segment':
                ctx.numeric_segments.add(place.split(' ')[-1])
            if kind == 'edit':
                ctx.err('%s: "%s %s %s" compares a Text field with a number written as text, and would change a live '
                        'segment at once. It waits for gap A12, which live test B3 closes' % (place, name, test, value))
            else:
                closes = ('live test B3 counts it' if kind == 'segment' else
                          'only a run with a test contact shows it (the email set\'s TEST rows)')
                warn = ('%s: "%s %s %s" compares a Text field with a number written as text. Whether Encharge matches it '
                        'against values stored as numbers is gap A12: %s. Nothing that depends on it goes live '
                        'until then' % (place, name, test, value, closes))
                if warn not in ctx.warnings:
                    ctx.warnings.append(warn)
    return value


def row(ctx, rule, mode, seed, where='row'):
    """One Encharge condition row, keys in the app's order. mode 'check' embeds refs as @@…@@ tokens.
    where=None for a row to remove (matched against the segment, never written)."""
    subject, name, test = rule[0], rule[1], rule[2]
    value = rule[3] if len(rule) > 3 else None
    if test in RENAMED:
        raise CompileError('test "%s" is now "%s", the Build tab\'s word' % (test, RENAMED[test]))
    if test in NOT_YET:
        raise CompileError('test "%s" (the Build tab\'s "%s") is not verified yet (gap A7c)' % (test, NOT_YET[test]))
    kind = TESTS.get(test)
    if kind is None:
        raise CompileError('unknown condition test "%s"' % test)
    rtype, keyword = kind
    if rtype != subject:
        raise CompileError('test "%s" applies to a %s, not a %s' % (test, rtype, subject))
    u = det_uuid(seed, subject, name, test, value)
    if rtype == 'tag':
        if where is not None:   # a row to remove is matched, never written: its tag need not exist
            ctx.check_tag(name, ctx.where[0])
        return {'uuid': u, 'type': 'tag', 'condition': keyword, 'value': name}
    if rtype == 'segment':
        if mode == 'check':
            raise CompileError('a segment row inside a CHECK has not been seen stored yet (gap A9; v47 needs none): '
                               'put the segment in the trigger, or in a segment the flow enters')
        if isinstance(name, int):
            if where is not None:   # a row to remove is matched, never written
                ctx.check_dead('segments', name, ctx.where[0])
            ref = name
        else:
            if where is not None and name not in ctx.new_segments and name not in ctx.build_segments and name not in ctx.later_segments:
                ctx.check_dead('segments', name, ctx.where[0])
            if name in ctx.later_segments:
                ctx.err('segment "%s" is created after the segment that uses it (or is that segment); '
                        'list it first (build order)' % name)
            elif where is not None and name in ctx.parked_segments and not ctx.known('segments', name) \
                    and name not in ctx.new_segments and name not in ctx.build_segments:
                ctx.err('segment "%s" is only in the manifest\'s later block (parked); un-park it first' % name)
            elif where is not None and not ctx.known('segments', name) and name not in ctx.new_segments \
                    and name not in ctx.build_segments:
                ctx.warnings.append('segment "%s" must exist (ledger) before this runs' % name)
            ref = ('@@segment:%s@@' % name) if mode == 'check' else {'$ref': 'segment:%s' % name}
        return {'uuid': u, 'type': 'segment', 'condition': keyword, 'value': ref}
    # field
    if not name or not isinstance(name, str):
        raise CompileError('a field row needs a field name')   # the broken-segment case from capture 2
    fref = field_ref(ctx, name, check=where is not None)   # a row to remove is matched, never written
    ftype = field_type(ctx, name)
    bare = name[5:] if name.startswith('data.') else name
    known = ctx.fields is None or bare in ctx.fields or bare in ctx.new_fields
    # The empty tests are proven only on fields a user created (every stored one is): not on built-in or system ones.
    # An account field is judged by what the account says; only a field this build creates counts as the build's own.
    af = (ctx.fields or {}).get(bare)
    user_made = af.get('createdBy') == 'user' if af else bare in ctx.new_fields
    problem = unproven(ftype, keyword, test, name, mode, not user_made) if known else None
    if problem:
        ctx.err(problem)
    elif keyword in ('before period', 'after period'):
        if not isinstance(value, int) or isinstance(value, bool) or value < 1:
            ctx.err('"%s" needs a whole number of days' % test)
    elif keyword == 'is more than':
        if not is_number(value):
            ctx.err('"moreThan" on %s needs a number, e.g. 0' % name)
    elif keyword in ('is', 'is not'):
        value = typed_value(ctx, name, ftype, test, value, where)
    if keyword in ('is empty', 'is not empty'):
        value = EMPTY_VALUE.get((keyword, ftype, mode))   # None only where an error is already recorded
    return {'uuid': u, 'type': 'field', 'field': fref, 'condition': keyword, 'value': value}


def group(ctx, op, rules, mode, seed):
    rows = [row(ctx, r, mode, '%s/%d' % (seed, i)) for i, r in enumerate(rules)]
    return {'type': 'group', 'operator': 'and' if op == 'all' else 'or', 'conditions': rows, 'uuid': det_uuid(seed, 'group')}


def flatten(cond, yes, no, alloc):
    """
    Encharge conditions are one level only (api-map 6.1). Returns (entry, [checks]) where each check is
    {'key', 'op', 'rules', 'yes', 'no'}: a chain of flat checks equivalent to the nested condition.
    Keys are temporary here; name_checks() gives the entry the spec's key.
    """
    op = next(iter(cond))
    items = cond[op]
    rules = [i for i in items if isinstance(i, list)]
    groups = [i for i in items if isinstance(i, dict)]
    if not groups:
        k = alloc()
        return k, [{'key': k, 'op': op, 'rules': rules, 'yes': yes, 'no': no}]
    if op == 'all':
        nxt, tail = yes, []
        for g in reversed(groups):
            k, cs = flatten(g, nxt, no, alloc)
            tail, nxt = cs + tail, k
        if rules:
            k = alloc()
            return k, [{'key': k, 'op': 'all', 'rules': rules, 'yes': nxt, 'no': no}] + tail
        return nxt, tail
    nxt_no, tail = no, []
    for g in reversed(groups):
        k, cs = flatten(g, yes, nxt_no, alloc)
        tail, nxt_no = cs + tail, k
    if rules:
        k = alloc()
        return k, [{'key': k, 'op': 'any', 'rules': rules, 'yes': yes, 'no': nxt_no}] + tail
    return nxt_no, tail


def name_checks(entry, checks, key):
    """The entry check takes the spec's key (so links into it need no change); the rest become key__2, key__3 …"""
    names, n = {entry: key}, 1
    for c in checks:
        if c['key'] not in names:
            n += 1
            names[c['key']] = '%s__%d' % (key, n)
    for c in checks:
        c['key'] = names[c['key']]
        c['yes'] = names.get(c['yes'], c['yes'])
        c['no'] = names.get(c['no'], c['no'])
    return checks


def check_string(ctx, op, rules, seed):
    """The Check condition value: a JSON string, compact, in the app's key order, with segment refs unquoted."""
    s = json.dumps({'objectName': 'person', 'conditions': group(ctx, op, rules, 'check', seed)}, separators=(',', ':'))
    return re.sub(r'"(@@segment:[^@"]+@@)"', r'\1', s)
