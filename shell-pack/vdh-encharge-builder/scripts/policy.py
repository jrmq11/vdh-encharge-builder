#!/usr/bin/env python3
"""policy.py -- vdh-encharge-builder's policy facts, from one source each (v1.10, P20).

    python3 -B scripts/policy.py           writes the generated files again (data/guard-policy.json, live/policy.js)
    python3 -B scripts/policy.py --check   regenerates them in memory and compares: exit 1, naming the file, if one differs

Two sources, never copied by hand:

  scripts/guard.js        the wall every call goes through, pinned by check_package.py. It stays authoritative for what it
                          declares: the protected tags (PROTECTED_TAG), the router-owned fields the builder never creates
                          or sets without permission (ROUTER_FIELDS), the step types the builder makes (BUILDER_OPS) and
                          those that need permission (NEEDS_PERMISSION_OPS), and the keys of a new email (EMAIL_KEYS).
                          extract_guard() reads them from the guard's own declarations, at package time, and fails on
                          any top-level declaration it does not recognise, or a known one in another shape: never a loose
                          text search that could give partial data silently. guard.js is never changed by this.
  data/policy.json        the facts the guard does not hold: the permission-word rules (the compiler, pagecmd.py and the
                          page judge Joe's words alike), the live IDs the ledger tool never marks failed or deleted, and
                          the switch-over's segment and flow (D1). Written by hand; load() checks its shape.

Generated from them (each says so in its first line): data/guard-policy.json, which the compiler reads, and live/policy.js,
the page file VDHPolicy (installed after verify.js), which the page reads. check_package.py runs --check.

The guard and the compiler each still enforce the rules; sharing the facts removes neither check.
"""
import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
GUARD = os.path.join(ROOT, 'scripts', 'guard.js')
POLICY = os.path.join(ROOT, 'data', 'policy.json')
GUARD_POLICY = os.path.join(ROOT, 'data', 'guard-policy.json')
PAGE_POLICY = os.path.join(ROOT, 'live', 'policy.js')
VERSION = 'v1.11'   # the package version live/policy.js names (sitting.js refuses another)


class PolicyError(Exception):
    pass


# ---------------------------------------------------------------- guard.js's declarations
ITEM = r"'[A-Za-z0-9_/.-]+'"
LIST = r'\[\s*(?:' + ITEM + r'\s*,\s*)*' + ITEM + r'\s*\]'
# Every top-level declaration guard.js makes (inside its wrapper, at two spaces), by name, with the one shape it may have.
# The five the builder shares are extracted; the others are recognised and left alone. A declaration not listed here, or
# one of these in any other shape, stops the extraction: the extractor is changed on purpose, never guessed around.
SHAPES = {
    'API': ('skip', r"'https://api\.encharge\.io'"),
    'PROTECTED_TAG': ('regex', r'/([A-Za-z0-9_^$|()]+)/'),
    'ROUTER_FIELDS': ('set', r'new Set\((' + LIST + r')\)'),
    # what the guard uses for the router fields: exactly ROUTER_FIELDS, lower-cased (anything else could protect another list)
    'ROUTER_FIELDS_LC': ('skip', re.escape('new Set([...ROUTER_FIELDS].map(f => f.toLowerCase()))')),
    'NEEDS_PERMISSION_OPS': ('set', r'new Set\((' + LIST + r')\)'),
    'BUILDER_OPS': ('set', r'new Set\((' + LIST + r')\)'),
    'JOURNAL_KEY': ('skip', r"'vdh-encharge-journal'"),
    'JOURNAL_MAX': ('skip', r'\d+'),
    'EMAIL_KEYS': ('list', r'(' + LIST + r')'),
    'UUID': ('skip', r'/\^\[0-9a-f\]\{8\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{4\}-\[0-9a-f\]\{12\}\$/'),
}
# the generated file's names for the five shared declarations
OUT_NAME = {'PROTECTED_TAG': 'protectedTag', 'ROUTER_FIELDS': 'routerFields', 'BUILDER_OPS': 'builderOps',
            'NEEDS_PERMISSION_OPS': 'needsPermissionOps', 'EMAIL_KEYS': 'emailKeys'}
# the guard's other top-level statements (two spaces in), exactly: its wrapper's own line, its three functions' first and
# last lines, and its export. Anything else at that level stops the extraction, so a fact cannot sit in another statement.
TOP_OTHER = {"'use strict';", 'function pageJournal() {', 'function cleanPath(p) {', 'function makeGuard(opts) {', '}',
             "if (typeof module !== 'undefined' && module.exports) module.exports = { makeGuard: makeGuard };",
             'else root.VDHGuard = makeGuard();'}


def _items(text):
    return re.findall(r"'([^']+)'", text)


FRAME_OPEN = '(function (root) {'
FRAME_CLOSE = "})(typeof window !== 'undefined' ? window : globalThis);"
FUNCTION_OPEN = re.compile(r'  function (pageJournal|cleanPath|makeGuard)\((p|opts)?\) \{$')


def top_declarations(src):
    """[(name, value text, line)] for each declaration at the guard's top level, in order. guard.js is walked line by line,
    strictly (v1.10, the independent review: JavaScript does not care how a line is indented, so nothing may be skipped
    for its indentation): its header comment; its wrapper's first line; then, at two spaces in, only blank lines, //
    comments, const declarations (their continuation lines four spaces in, or a closing bracket that ends them), the lines
    of TOP_OTHER, and the three functions, whose bodies are four or more spaces in until a line that is exactly two spaces
    and a closing brace; then the wrapper's last line. A tab, a CR, a let or var, a declaration of several names other than
    the journal's pair, and any line in any other place, stop the extraction, naming the line."""
    if '\r' in src or '\t' in src:
        raise PolicyError('guard.js holds a CR or a tab: the extractor reads LF lines indented with spaces only')
    lines = src.split('\n')
    while lines and lines[-1] == '':
        lines.pop()
    out, n = [], 0
    if not lines or lines[0] != '/*':
        raise PolicyError('guard.js:1: not the header comment the extractor knows')
    while n < len(lines) and lines[n] != ' */':
        if not (lines[n] == '/*' and n == 0) and not lines[n].startswith(' *'):
            raise PolicyError('guard.js:%d: a line in the header comment that is not a comment line' % (n + 1))
        n += 1
    n += 1
    if n >= len(lines) or lines[n] != FRAME_OPEN:
        raise PolicyError('guard.js:%d: the wrapper\'s first line is not where the extractor expects it' % (n + 1))
    n += 1
    if lines[-1] != FRAME_CLOSE:
        raise PolicyError('guard.js:%d: the wrapper\'s last line is not the file\'s last' % len(lines))
    last = len(lines) - 1
    while n < last:
        line = lines[n]
        if line == '' or re.match(r'  //', line):
            n += 1
            continue
        if FUNCTION_OPEN.match(line):
            n += 1
            while n < last and lines[n] != '  }':
                if lines[n] and not lines[n].startswith('    '):
                    raise PolicyError('guard.js:%d: a line inside a function that is not four spaces in: %s' % (n + 1, lines[n].strip()[:80]))
                n += 1
            if n >= last:
                raise PolicyError('guard.js: a function that does not end with a line "  }"')
            n += 1
            continue
        if re.match(r'  (let|var) ', line):
            raise PolicyError('guard.js:%d: a top-level %s: the extractor knows const declarations only' % (n + 1, line.split()[0]))
        if line.startswith('  const '):
            start, text = n, line
            while not text.rstrip().endswith(';'):
                n += 1
                nxt = lines[n] if n < last else None
                if nxt is None or not (nxt.startswith('    ') or re.fullmatch(r'  [\]\)}][\]\)}]*;', nxt)) or n - start > 20:
                    raise PolicyError('guard.js:%d: a declaration that does not end in ";" on its own lines' % (start + 1))
                text += '\n' + nxt
            body = ' '.join(t.strip() for t in text.split('\n'))[len('const '):].rstrip(';').strip()
            if body.startswith('JOURNAL_KEY = '):
                m = re.fullmatch(r"JOURNAL_KEY = (\S+), JOURNAL_MAX = (\S+)", body)
                if not m:
                    raise PolicyError('guard.js:%d: the journal pair is not in the shape the extractor knows' % (start + 1))
                out += [('JOURNAL_KEY', m.group(1), start + 1), ('JOURNAL_MAX', m.group(2), start + 1)]
            else:
                m = re.fullmatch(r'([A-Z_]+) = (.+)', body, re.S)
                if not m:
                    raise PolicyError('guard.js:%d: a declaration the extractor cannot read: %s' % (start + 1, body[:80]))
                out.append((m.group(1), m.group(2), start + 1))
            n += 1
            continue
        if line.startswith('  ') and line[2:3] != ' ' and line.strip() in TOP_OTHER and line.strip() != '}':
            n += 1
            continue
        raise PolicyError('guard.js:%d: a top-level statement scripts/policy.py does not know: %s' % (n + 1, line.strip()[:80]))
    return out


def extract_guard(path=GUARD):
    """The five shared facts, read from guard.js's own declarations. Fails, naming the line, on a declaration it does not
    recognise, a known one in another shape, one declared twice, or one missing."""
    with open(path, encoding='utf-8', newline='') as fh:
        src = fh.read()
    seen, got = set(), {}
    for name, value, line in top_declarations(src):
        if name not in SHAPES:
            raise PolicyError('guard.js:%d declares %s, which scripts/policy.py does not know: add it to SHAPES (as shared, or '
                              'as left alone) before packaging, so a new policy fact is never missed' % (line, name))
        if name in seen:
            raise PolicyError('guard.js:%d declares %s a second time' % (line, name))
        seen.add(name)
        kind, shape = SHAPES[name]
        m = re.fullmatch(shape, value, re.S)
        if not m:
            raise PolicyError('guard.js:%d: %s is not in the shape scripts/policy.py knows (%s): change the extractor on purpose'
                              % (line, name, value[:80]))
        if kind == 'regex':
            got[name] = m.group(1)
        elif kind in ('set', 'list'):
            items = _items(m.group(1))
            if len(items) != len(set(items)):
                raise PolicyError('guard.js:%d: %s names an entry twice' % (line, name))
            got[name] = items
    missing = sorted(set(SHAPES) - seen)
    if missing:
        raise PolicyError('guard.js no longer declares %s at its top level' % ', '.join(missing))
    with open(path, 'rb') as fh:
        digest = hashlib.sha256(fh.read()).hexdigest()
    out = {'generated': 'GENERATED by scripts/policy.py from scripts/guard.js: do not edit. Run python3 -B scripts/policy.py '
                        'to write it again; check_package.py compares it with a fresh extraction',
           'source': {'file': 'scripts/guard.js', 'sha256': digest}}
    for name in ('PROTECTED_TAG', 'ROUTER_FIELDS', 'BUILDER_OPS', 'NEEDS_PERMISSION_OPS', 'EMAIL_KEYS'):
        out[OUT_NAME[name]] = got[name]
    return out


# ---------------------------------------------------------------- data/policy.json
def _check_policy(p):
    def need(cond, what):
        if not cond:
            raise PolicyError('data/policy.json: ' + what)
    need(isinstance(p, dict) and p.get('format') == 1, 'not format 1')
    w = p.get('permissionWords')
    need(isinstance(w, dict), 'no permissionWords')
    need(isinstance(w.get('notWords'), str) and re.fullmatch(r'[a-z0-9]+(\|[a-z0-9]+)*', w['notWords']),
         'permissionWords.notWords is words of letters and digits joined by |')
    need(w.get('noteOpeners') == ['(', '['], 'permissionWords.noteOpeners is ["(", "["] (the page checks it as a character class)')
    need(isinstance(w.get('firstDate'), str) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', w['firstDate']), 'permissionWords.firstDate is YYYY-MM-DD')
    ids = p.get('liveIds')
    need(isinstance(ids, dict) and set(ids) == {'flows', 'segments', 'emails'} and
         all(isinstance(v, list) and v and all(type(x) is int and x > 0 for x in v) and len(v) == len(set(v)) for v in ids.values()),
         'liveIds is {flows, segments, emails}, each a list of whole-number IDs, each once')
    so = p.get('switchOver')
    need(isinstance(so, dict) and list(so) == ['segment', 'segmentId', 'segmentName', 'flowId', 'flowName'] and
         type(so['segmentId']) is int and type(so['flowId']) is int and all(isinstance(so[k], str) and so[k] for k in ('segment', 'segmentName', 'flowName')),
         'switchOver is {segment, segmentId, segmentName, flowId, flowName}, in that order')
    need(re.fullmatch(r'[A-Za-z0-9 ()_-]+', so['segmentName'] + so['flowName']), 'switchOver names are plain ASCII (the page file holds them)')
    need(p.get('offStatuses') == ['deactivated', 'deactivated-user'], 'offStatuses is ["deactivated", "deactivated-user"]')
    return p


def load(path=POLICY):
    """data/policy.json, its shape checked."""
    with open(path, encoding='utf-8') as fh:
        return _check_policy(json.load(fh))


def load_guard(path=GUARD_POLICY):
    """data/guard-policy.json, as generated."""
    with open(path, encoding='utf-8') as fh:
        g = json.load(fh)
    if not isinstance(g, dict) or not all(k in g for k in OUT_NAME.values()):
        raise PolicyError('%s is not what scripts/policy.py writes: run python3 -B scripts/policy.py' % path)
    return g


# ---------------------------------------------------------------- the generated files
def guard_policy_text():
    return json.dumps(extract_guard(), indent=1, ensure_ascii=True) + '\n'


def page_policy_text():
    """live/policy.js: the facts the page needs, from data/policy.json and guard.js's declarations. Plain ASCII, no
    backslash escapes (pagecmd.py's page rules): every value is checked before it is written."""
    p, g = load(), extract_guard()
    with open(POLICY, 'rb') as fh:
        psha = hashlib.sha256(fh.read()).hexdigest()
    facts = {'notWords': p['permissionWords']['notWords'], 'noteOpeners': p['permissionWords']['noteOpeners'],
             'firstDate': p['permissionWords']['firstDate'], 'liveIds': p['liveIds'], 'switchOver': p['switchOver'],
             'offStatuses': p['offStatuses'], 'protectedTag': g['protectedTag'], 'routerFields': g['routerFields'],
             'builderOps': g['builderOps'], 'needsPermissionOps': g['needsPermissionOps']}
    body = json.dumps(facts, indent=1, ensure_ascii=True)
    if '\\' in body or '`' in body:
        raise PolicyError('a policy value holds a backslash or a backtick, which a page file may not carry')
    return ('// GENERATED by scripts/policy.py from data/policy.json (sha256 %s) and scripts/guard.js (sha256 %s): do not edit.\n'
            '// Run python3 -B scripts/policy.py to write it again; check_package.py compares it with a fresh one.\n'
            '/*\n'
            ' * policy.js -- the policy facts the page helper reads (v1.10, P20): the permission-word rules, the live IDs, the\n'
            ' * switch-over\'s segment and flow, and, read only, what guard.js declares. Installed after verify.js. It holds data\n'
            ' * only: the guard still enforces its own declarations, and sitting.js its own checks.\n'
            ' */\n'
            '(function (root) {\n'
            "  'use strict';\n"
            "  // frozen all the way down: no page script can change a fact after the install\n"
            "  const freeze = o => { Object.keys(o).forEach(k => { if (o[k] && typeof o[k] === 'object') freeze(o[k]); }); return Object.freeze(o); };\n"
            "  const VDHPolicy = freeze({ version: '%s', facts: %s });\n"
            "  if (typeof module !== 'undefined' && module.exports) module.exports = VDHPolicy;\n"
            '  else root.VDHPolicy = VDHPolicy;\n'
            "})(typeof window !== 'undefined' ? window : globalThis);\n") % (psha, g['source']['sha256'], VERSION, body.replace('\n', '\n  '))


GENERATED = [(GUARD_POLICY, guard_policy_text), (PAGE_POLICY, page_policy_text)]


def main(argv):
    check = argv[1:] == ['--check']
    if argv[1:] not in ([], ['--check']):
        raise SystemExit(__doc__)
    try:
        bad = []
        for path, make in GENERATED:
            text = make()
            rel = os.path.relpath(path, ROOT).replace(os.sep, '/')
            if check:
                try:
                    with open(path, encoding='utf-8', newline='') as fh:
                        if fh.read() != text:
                            bad.append(rel)
                except OSError:
                    bad.append(rel + ' (missing)')
            else:
                with open(path, 'w', encoding='utf-8', newline='\n') as fh:
                    fh.write(text)
                print('wrote ' + rel)
        load()
    except PolicyError as e:
        print('FAIL: ' + str(e), file=sys.stderr)
        return 1
    if bad:
        print('FAIL: generated file(s) out of date: %s; run python3 -B scripts/policy.py' % ', '.join(bad), file=sys.stderr)
        return 1
    if check:
        print('ok: the generated policy files match their sources')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
