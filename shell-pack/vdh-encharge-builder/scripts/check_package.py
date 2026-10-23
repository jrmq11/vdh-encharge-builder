#!/usr/bin/env python3
"""check_package.py — vdh-encharge-builder packaging checks. Exits non-zero on the first failed check.

    python3 scripts/check_package.py        (run from the package root)

Runs every suite (guard, offline, the condition checks, the flow checks, the verify checks, the two live-kit rehearsals,
the reader checks and the ledger checks), and checks what the counts in SKILL.md say against what the suites print, so
the documented numbers can never drift from the tests (v0.3's said 297 while its suite ran 307).

The tools run on Linux, as Claude's workspace is. Elsewhere (D3 may move them onto Joe's laptop) they need Python's time
zone data for Europe/Paris, which Windows lacks until `python -m pip install tzdata` (review of v1.01, N7): step 0 checks.
"""
import json
import os
import re
import subprocess
import sys
import tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
JWT = re.compile(r'eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+\.')
API_KEYS = '"api' + 'Keys"'   # built at run time so this file does not match its own scan
# v1.09: inspect.js (P19, stage 1); v1.10: policy.js, storage.js, transport.js, reconcile.js (P20, stage 2), in install order
PAGE_FILES = ['scripts/guard.js', 'scripts/runner.js', 'scripts/verify.js', 'live/policy.js', 'live/storage.js', 'live/transport.js',
              'live/inspect.js', 'live/reconcile.js', 'live/sitting.js']
REQUIRED = ['SKILL.md', 'references/api-map.md', 'references/spec-format.md', 'references/gaps.md', 'data/encharge-catalogue.json',
            'evidence/capture-2026-09-23-flow-builder.json', 'evidence/capture-2026-09-23-objects.json',
            'evidence/reader-2026-09-23.json', 'evidence/reader-2026-09-23-a10.json', 'evidence/live-tests-2026-09-25.json',
            'evidence/recheck-2026-09-26.json', 'evidence/review-2026-09-26.json',
            'evidence/review-2026-09-27.json', 'CHANGELOG.md',
            'scripts/compile.py', 'scripts/compiler/__init__.py', 'scripts/compiler/context.py', 'scripts/compiler/conditions.py',
            'scripts/compiler/layout.py', 'scripts/compiler/flows.py', 'scripts/compiler/objects.py', 'scripts/compiler/provenance.py',
            'live/install-manifest.json', 'scripts/policy.py', 'data/policy.json', 'data/guard-policy.json', 'tests/test_guard.js', 'tests/test_offline.js', 'tests/test_conditions.py', 'tests/test_flows.py', 'tests/test_verify.js',
            'tests/fixtures/ledger-2026-09-26.json', 'live/test_ledger.py',
            'tests/fixtures/step-defaults.json', 'tests/fixtures/person-fields.json', 'tests/fixtures/account-tags-2026-09-25.json',
            'tests/fixtures/v50/manifest.json', 'tests/fixtures/v50/tag-groups.json',
            'tests/specs/r1-bounce.json', 'tests/specs/r2-email.json', 'tests/specs/r3-objects.json',
            'live/RUNBOOK.md', 'live/pagecmd.py', 'live/readers_check.py', 'live/Make-Encharge-Readers-validator-v0_2.py',
            'live/rehearse.js', 'live/rehearse_install.js', 'live/fake_locks.js', 'live/test_checks.py'] + PAGE_FILES
# (label in SKILL.md, command, pattern that finds the count in its output)
SUITES = [('guard', ['node', 'tests/test_guard.js'], r'guard tests passed: (\d+)'),
          ('offline', ['node', 'tests/test_offline.js'], r'offline tests passed: (\d+)'),
          ('condition', ['python3', '-B', 'tests/test_conditions.py'], r'condition checks passed: (\d+)'),
          ('flow', ['python3', '-B', 'tests/test_flows.py'], r'flow checks passed: (\d+)'),
          ('verify', ['node', 'tests/test_verify.js'], r'verify checks passed: (\d+)'),
          ('rehearsal', ['node', 'live/rehearse.js'], r'rehearsal checks passed: (\d+)'),
          ('install rehearsal', ['node', 'live/rehearse_install.js'], r'install rehearsal checks passed: (\d+)'),
          ('reader', ['python3', '-B', 'live/test_checks.py'], r'readers_check tests passed: (\d+)'),
          ('ledger', ['python3', '-B', 'live/test_ledger.py'], r'ledger checks passed: (\d+)')]
# guard.js is pinned: a change to the guard is a change to the wall every call goes through, and moves this pin on
# purpose. fc29ad53 (v0.4 to v1.03) ran the live tests, the re-check, build sitting 1 and the master template test
# (2026-09-25, 26 and 28). 7e7cbddb is v1.04's, which changed only its router-field list (attribution): not yet
# installed live, so not live-proven until sitting 2's install
GUARD_PIN = '7e7cbddb'
# a contact address, in any case; Joe's own, at visualdesignhacks.com, pass (v1.07: upper-case addresses too)
ADDRESS = re.compile(r'[A-Za-z0-9._%+-]+@(?!visualdesignhacks\.com)[A-Za-z0-9.-]+\.[a-z]{2,}', re.IGNORECASE)
TEXT_FILES = ('.json', '.md', '.js', '.py')


def evidence(rel):
    """A file whose contact addresses step 5 refuses (rel: its path from the package root): every file of evidence/,
    whatever its name or extension (v1.07, P9: until v1.06 only files named live-tests*, recheck* or review*, so the
    master template test's evidence was not scanned), and, as before, a file so named anywhere."""
    rel = rel.replace(os.sep, '/')
    return rel.startswith('evidence/') or os.path.basename(rel).startswith(('live-tests', 'recheck', 'review'))


def scanned(rel):
    """A file step 5 reads: every text file (.json, .md, .js, .py), and every evidence file whatever its extension."""
    return rel.endswith(TEXT_FILES) or evidence(rel)


def leak(rel, text):
    """What step 5 finds in one file it reads: a token or an API key, in any; a contact address, in an evidence file."""
    if JWT.search(text) or API_KEYS in text:
        return 'secret-like content in ' + rel
    if evidence(rel) and ADDRESS.search(text):
        return 'a contact address in the evidence file ' + rel
    return None


def scan(root):
    """Step 5 over a tree: the first thing it finds, or None. Its control runs this same walk over trees made for it."""
    for dirpath, _, files in os.walk(root):
        if '/.git' in dirpath or 'node_modules' in dirpath:
            continue
        for f in sorted(files):
            rel = os.path.relpath(os.path.join(dirpath, f), root)
            if scanned(rel):
                why = leak(rel, open(os.path.join(dirpath, f), encoding='utf-8', errors='replace').read())
                if why:
                    return why
    return None


def scan_control():
    """P9's control (v1.07): the walk must read an evidence file whatever its extension and find an address in it in any
    case; find one in a file named review* elsewhere, as v1.06 did; and pass Joe's own address and the made-up ones in
    the other folders' tests (they hash contacts). Each tree is made here and removed."""
    trees = [({'evidence/zz-control.txt': 'to: SOMEONE@EXAMPLE.ORG'}, True),
             ({'references/review-zz.json': '{"to": "someone@example.org"}'}, True),
             ({'evidence/zz-control.json': '{"to": "joe@visualdesignhacks.com", "cc": "JOE@VISUALDESIGNHACKS.COM"}',
               'tests/zz-control.json': '{"to": "someone@example.org"}'}, False)]
    for files, found in trees:
        with tempfile.TemporaryDirectory(prefix='vdh-scan-') as t:
            for rel, text in files.items():
                os.makedirs(os.path.dirname(os.path.join(t, rel)), exist_ok=True)
                with open(os.path.join(t, rel), 'w', encoding='utf-8') as fh:
                    fh.write(text)
            if bool(scan(t)) != found:
                return False
    return True


def fail(msg):
    print('FAIL: ' + msg)
    sys.exit(1)


def main():
    try:
        from zoneinfo import ZoneInfo
        ZoneInfo('Europe/Paris')
    except Exception:   # noqa: BLE001 - any failure here means the reader checks cannot run
        fail('no time zone data for Europe/Paris in this Python: the reader checks stamp times in Paris. Install it with '
             'python3 -m pip install tzdata (Windows has none by default), then run this again')
    print('[0] Python has time zone data for Europe/Paris')
    for f in REQUIRED:
        if not os.path.isfile(os.path.join(ROOT, f)):
            fail('missing ' + f)
    print('[1] required files present (%d)' % len(REQUIRED))
    skill = open(os.path.join(ROOT, 'SKILL.md'), encoding='utf-8').read()
    m = re.match(r'^---\nname: (.+)\ndescription: (.+)\n---\n', skill)
    if not m or m.group(1).strip() != 'vdh-encharge-builder':
        fail('SKILL.md frontmatter: name must be vdh-encharge-builder')
    if len(m.group(2)) > 1024 or '<' in m.group(2):
        fail('SKILL.md description too long or has angle brackets')
    ver = re.search(r'\*\*v(\d+\.\d+) · ', skill)
    if not ver:
        fail('SKILL.md has no version line')
    if '§' in skill:
        fail('SKILL.md uses a section sign')
    print('[2] SKILL.md frontmatter ok, version v' + ver.group(1))
    cat = json.load(open(os.path.join(ROOT, 'data/encharge-catalogue.json'), encoding='utf-8'))
    if len(cat.get('operations', {})) != 44:
        fail('catalogue must hold 44 step types')
    if cat['links'].get('fromSendOnBounced') != {'conditions': [{'label': 'On bounced', 'condition': 'email-bounce'}], 'registerEventListener': True}:
        fail('catalogue: links.fromSendOnBounced must be the link Encharge stored for gap A13')
    if 'on save' in cat['links'].get('note', '') or 'switched on' not in cat['links'].get('note', ''):
        fail('catalogue: links.note must say Encharge adds listener ids when a flow is switched on (gap A14), not on save')
    print('[3] catalogue: 44 step types, the On bounced link, listener ids at switch-on')
    # v1.10 (P20): the policy facts' generated files match their sources (guard.js's declarations; data/policy.json)
    r = subprocess.run([sys.executable, '-B', 'scripts/policy.py', '--check'], cwd=ROOT, capture_output=True, text=True,
                       env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
    if r.returncode != 0:
        fail('scripts/policy.py --check: ' + (r.stderr or r.stdout).strip()[-400:])
    print('[3] policy: the generated files match guard.js\'s declarations and data/policy.json (scripts/policy.py --check)')
    for f in PAGE_FILES:
        t = open(os.path.join(ROOT, f), encoding='utf-8', newline='').read()
        if '\r' in t or any(ord(c) > 126 for c in t) or '\\u' in t or re.search(r'\\x[0-9a-fA-F]{2}', t):
            fail(f + ': page files must be LF-only plain ASCII with no backslash-u or backslash-x escape (the tool transport changes the first and was never probed with the second)')
    sys.path.insert(0, os.path.join(ROOT, 'live'))
    import pagecmd   # noqa: E402
    fp = pagecmd.fingerprint(ROOT)
    if not fp['guard.js'].startswith(GUARD_PIN):
        fail('guard.js fingerprint %s is not the pinned %s…: a change to the guard moves GUARD_PIN on purpose' % (fp['guard.js'][:8], GUARD_PIN))
    # v1.09 (P19, stage 1): sitting.js refuses an inspect.js of another version; v1.10 (P20): every helper's, so each of the
    # six must name this package's (policy.js, generated, carries scripts/policy.py's VERSION)
    for f in ('live/storage.js', 'live/transport.js', 'live/inspect.js', 'live/reconcile.js', 'live/sitting.js', 'live/policy.js'):
        m = re.search(r"const VERSION = 'v([0-9.]+)';|version: 'v([0-9.]+)'", open(os.path.join(ROOT, f), encoding='utf-8').read())
        if not m or (m.group(1) or m.group(2)) != ver.group(1):
            fail('%s: its VERSION must be v%s, the package version in SKILL.md' % (f, ver.group(1)))
    # v1.10 (P20): the install manifest the page checks every file against is the one the files give now
    kept = json.load(open(os.path.join(ROOT, 'live', 'install-manifest.json'), encoding='utf-8'))
    if kept != pagecmd.fresh_manifest(ROOT):
        fail('live/install-manifest.json is out of date with the page files: python3 -B live/pagecmd.py manifest . --out live/install-manifest.json')
    if [f['file'] for f in kept['files']] != [os.path.basename(f) for f in PAGE_FILES] or kept['files'][0]['sha256'] != fp['guard.js']:
        fail('live/install-manifest.json does not list the nine page files in install order')
    pin = re.search(r"const GUARD_SHA256 = '([0-9a-f]{64})';", open(os.path.join(ROOT, 'live', 'sitting.js'), encoding='utf-8').read())
    if not pin or pin.group(1) != fp['guard.js']:
        fail('live/sitting.js must pin guard.js\'s fingerprint (GUARD_SHA256) as this check pins it')
    print('[4] page files: plain ASCII, LF, no backslash-u or backslash-x; guard.js is the pinned one (%s…); '
          'the six helper files name v%s; the install manifest (%s) matches the files' % (GUARD_PIN, ver.group(1), kept['build']))
    if not scan_control():
        fail('step 5 cannot tell a contact address in an evidence file (its control failed)')
    why = scan(ROOT)
    if why:
        fail(why)
    print('[5] no tokens or API keys anywhere in the package; no contact addresses in any evidence file (the scan\'s control sees one)')
    counts = {}
    for label, cmd, pat in SUITES:
        # PYTHONDONTWRITEBYTECODE reaches every Python the suites start, so the run leaves no __pycache__ for step 8
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=dict(os.environ, PYTHONDONTWRITEBYTECODE='1'))
        if r.returncode != 0:
            fail(' '.join(cmd) + ': ' + (r.stderr or r.stdout).strip()[-600:])
        found = re.search(pat, r.stdout)
        if not found:
            fail(' '.join(cmd) + ': no count in its output')
        counts[label] = int(found.group(1))
        print('[6] %s: %d checks pass' % (' '.join(cmd), counts[label]))
    stated = re.search(r'All (\d+) guard tests, (\d+) offline tests, (\d+) condition checks, (\d+) flow checks, (\d+) verify checks, (\d+) rehearsal checks, '
                       r'(\d+) install rehearsal checks, (\d+) reader checks and (\d+) ledger checks pass', skill)
    if not stated:
        fail('SKILL.md must state the counts as "All N guard tests, N offline tests, N condition checks, N flow checks, N verify checks, '
             'N rehearsal checks, N install rehearsal checks, N reader checks and N ledger checks pass"')
    want = [counts['guard'], counts['offline'], counts['condition'], counts['flow'], counts['verify'], counts['rehearsal'], counts['install rehearsal'],
            counts['reader'], counts['ledger']]
    if [int(x) for x in stated.groups()] != want:
        fail('SKILL.md states %s; the suites ran %s' % (list(stated.groups()), want))
    print('[7] SKILL.md states the counts the suites ran')
    for dirpath, dirs, files in os.walk(ROOT):
        if '__pycache__' in dirs or any(f.endswith('.pyc') for f in files):
            fail('compiled Python left in ' + os.path.relpath(dirpath, ROOT) + ' (delete __pycache__)')
    print('[8] no compiled Python left in the package')
    print('PASS')


if __name__ == '__main__':
    main()
