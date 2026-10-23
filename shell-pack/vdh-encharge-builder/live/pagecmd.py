#!/usr/bin/env python3
"""
pagecmd.py -- the text to send to the Encharge page for one step of a live sitting (session tooling).

  python3 pagecmd.py load <name> <plan.json>      -> await VDHSit.load('<name>', "<plan as JSON text>", '<sha256>'), or,
                                                     for a plan whose command would pass 24,000 bytes, n commands
                                                     await VDHSit.loadPart('<name>', i, n, "<part i>", '<sha256>'), each
                                                     at most 24,000 bytes (v1.02; the largest single call proven live is
                                                     68,524 bytes, v1.02's sitting.js install, gap A21); --part-bytes N
                                                     sets the size. With --out <file>, one file per part: <file>.1 ... <file>.n
  python3 pagecmd.py refs <ledger.json>           -> await VDHSit.setRefs("<{refs, ledger} as JSON text>", '<sha256>')
                                                     (refs: the flow:, email:, segment: IDs, replacing the page's; entries
                                                     marked failed or deleted are left out, v1.01. ledger: what the ledger
                                                     holds, by kind: every flow, segment and email ID, and every tag and
                                                     field name not marked deleted, so the page clears each verified run
                                                     it now holds, v1.02). The page answers {refs, ledgered, unledgered,
                                                     stored}; it takes the text only if its SHA-256 matches (v1.07, P2)
  python3 pagecmd.py sizes <plan.json> ...        -> each plan's load command, in bytes and parts (v1.02)
  python3 pagecmd.py record <ledger.json> <ids.json> --run <name> [--plan <plan.json>] [--session <label>]
                 [--date YYYY-MM-DD] [--tags tags.json] [--fields fields.json] --out <refs call file>
                                                  -> after a verified run, one command (v1.10, P3): ledger add as for a
                                                     verified run (--state built-off --verify ok), ledger check, and the
                                                     refs call (with its SHA-256) written to --out. Answers add's JSON,
                                                     with "check": "ok" and the call's file and hash. Then write the ledger
                                                     back to the Project and send the call. A refused add writes nothing
  python3 pagecmd.py ledger <command> ...         -> the ledger, written by a tool, not by hand (v1.02; review of v1.01,
                                                     N10); every command checks the whole ledger before it writes:
      ledger check <ledger.json>                   -> ok, or each problem (exit 1)
      ledger add <ledger.json> <ids.json> --run <name> [--plan <plan.json>] --state built-off|failed [--verify <result>]
                 [--session <label>] [--date YYYY-MM-DD] [--tags tags.json] [--fields fields.json]
                                                     ids.json: what VDHSit.ids('<name>') answered, or what
                                                     VDHSit.unledgered() answered (after a reload), or what ledger made-ids
                                                     wrote (a run that never verified), as {"flow:<key>": id, ...}.
                                                     built-off needs --verify ok; failed says "never verified" unless told.
                                                     A flow, segment or email key the ledger holds as failed or deleted
                                                     moves first to <key>-old-<date>; a tag or field the ledger marks
                                                     deleted is replaced, the old entry kept under "replaced"; a key held
                                                     live, or a tag or field marked failed, is refused. A tag or field the
                                                     session's first reads (--tags, --fields: the reads of the session
                                                     that ran it, never a later one; a read saved after the IDs file, or
                                                     after the record's verifiedAt, is refused) held was there before the run: it
                                                     goes in as not the builder's (leftOut), off the delete list, so the
                                                     page's record of the run clears. --plan gives names and provenance;
                                                     only a VDHSit.unledgered() record, which carries its plan's
                                                     provenance, goes in without it; its date is then the record's
                                                     verifiedAt day unless --date. Answers {"added", "moved", "leftOut"?}
      ledger made-ids <plan.json> <marker.json> --run <name> [--tags tags.json] [--fields fields.json] [--out <file>]
                                                  -> the IDs a run that never verified made, as ledger add takes them,
                                                     from the run marker saved before the reconcile (VDHSit.reconcileDue())
                                                     or a waive's answer: each create Encharge answered, keyed by the
                                                     plan's names (recompile the plan from its spec if the workspace lost
                                                     it). A tag or field of the session's first reads was there before:
                                                     it is left out (a read saved after the run started is refused). What
                                                     it cannot key is listed on stderr, for Joe; {} means nothing to add.
                                                     For a marker from an earlier session, no first read of that session
                                                     is left: leave --tags and --fields out
      ledger supersede <ledger.json> <kind> <key> --joe "<Joe's words>"   a verified draft (built-off) Joe agrees is
                                                     superseded: failed, on the delete list
      ledger live-move <ledger.json> <key>         a flow Joe has switched on (handed-over), before its rebuild: moves,
                                                     state and all, to <key>-live-<date>
      ledger switched-off <ledger.json> <key>-live-<date> --joe "<Joe's words>"   Joe has switched that old flow off
                                                     after the switch-over: failed, on the delete list
      ledger handed-over <ledger.json> <key> [--listeners ok]   Joe switched the verified draft flow on
      ledger delete <ledger.json> <kinds> <key> --joe "<Joe's words>"   Joe deleted it by hand: deleted, with the date
      ledger keep <ledger.json> tags|fields <name> --joe "<Joe's words>"   a tag or field a failed run made that Joe keeps:
                                                     built-off, with his words (the build then uses it as the account's)
      ledger put <ledger.json> <kinds> <key> --entry '<JSON object>' [--joe "<Joe's words>"]   one entry the tools do
                                                     not write (an email Joe made; an unknown ZZ object reconcile listed,
                                                     by its ID, as failed: --joe then); never over a key the ledger holds,
                                                     and never failed or deleted for a live object the builder did not make
      ledger edited <ledger.json> <kind>:<id or name> --change "<what>" --joe "<Joe's words>" [--run <name>]
                 [--snapshot <file>]              an edit to an object the builder did not make, with Joe's permission;
                                                     the snapshot's content (JSON, at most 64 KB) is kept in the entry
      <kind> is flows, segments, emails, tags or fields (flow, segment, ... also do). --date YYYY-MM-DD on any
      command that writes (today by default). Every command answers in JSON what it wrote.
  python3 pagecmd.py install <file>               -> the file wrapped for the page (send as is, one file per call);
                                                     the page helper's six files (policy.js, storage.js, transport.js,
                                                     inspect.js, reconcile.js, sitting.js) go without their whole-line
                                                     comments (gap A21). Each call removes VDHSit and records its file in
                                                     the install's order; sitting.js's carries the install manifest, and
                                                     the page makes VDHSit only if all nine match it (v1.10, P20). A file
                                                     the manifest does not list as it is, is refused here
  python3 pagecmd.py fingerprint <tool dir>       -> per file (all nine), the SHA-256 VDHSit.fingerprint() must return
  python3 pagecmd.py manifest <tool dir>          -> the install manifest, from the files: build id, and each file in
                                                     order with its object and SHA-256 (v1.10, P20); --out
                                                     live/install-manifest.json writes the package's copy
  python3 pagecmd.py sha <fields.json|tags.json>  -> the SHA-256 VDHSit.fields() / VDHSit.tags() returned as .sha, if
                                                     the file holds exactly what the page read
  python3 pagecmd.py reconcile <ledger.json> [plan.json ...] [--tags tags.json] [--fields fields.json]
                                                  -> await VDHSit.reconcile("<{flows, segments, tags, fields, names, ...}
                                                     as JSON text>", '<sha256>'), which the page reads only if its
                                                     SHA-256 matches (v1.07, P2):
                                                     the ledger's flow and segment IDs and its tag and field names, and
                                                     the display names of what the plans create (a real build's drafts
                                                     carry no ZZ); with --tags and --fields (the session's reads from
                                                     before its runs), each listed tag and field says whether it was
                                                     there at the start (v1.00). Entries the ledger marks
                                                     "state": "deleted" go in deleted: the page expects them gone
                                                     (v1.01); refs leaves them out
  Add --out <file> to load, refs, install, manifest, reconcile or ledger made-ids to write the text to a file instead of printing
  it (load: <file> for a plan in one part, <file>.1 ... <file>.n for one in n parts). Every ledger command refuses an
  option it does not take, and a --date that is not a calendar day.

Output is UTF-8 with LF line endings on every platform: the hashes are of exactly that text. A copy that picks up CRLF
(a Windows console or editor) no longer matches, so the page refuses it or the fingerprint flags it; it never passes.

The plan travels as ASCII-only JSON text inside a JSON string literal, so what the page hashes is byte for byte
what was compiled here; VDHSit.load keeps it only if the SHA-256 matches, so a copying slip cannot run. Since v1.07 (P2)
the argument of reconcile and of refs travels the same way, with its SHA-256: the page refuses a mismatch before it
reads, sends or changes anything, and only then parses it. (On 2026-09-28 a reconcile pasted as an object literal lost
one tag name and still answered ok; an object literal cannot be hashed as typed, since the transport changes its
backslash-u escapes.)

A file travels wrapped in a function kept on window.__vdhSrc (then called once), after deleting the object it makes,
so the answer "installed <file>: object" shows this very call made it. A function's source text is exactly what
arrived, so VDHSit.fingerprint() hashes what the page holds, and the expected hash is the file's own text, wrapped.
The nine page files must be plain ASCII with no backslash-u escape: the tool transport turns "\\u" plus four hex
digits into the character itself (probed 2026-09-25; "\\\\u", quotes and other escapes arrive as typed), so a file
holding one would arrive changed. install and fingerprint refuse such a file. (Plans are unaffected: their escapes
travel as \\\\uXXXX inside a JSON string, which arrives as typed.)
Install all nine, in order, every time: guard.js, runner.js, verify.js, policy.js, storage.js, transport.js, inspect.js,
reconcile.js, sitting.js (v1.09: inspect.js holds the read-only checks, P19 stage 1; v1.10: the policy facts, the storage,
the transport and the reconciliation have files of their own, P20, stage 2). sitting.js's call carries the install
manifest (live/install-manifest.json), and the page makes VDHSit only if every file was installed, in that order, once,
and matches it: a missing, stale, reordered, altered or mixed-build file leaves no VDHSit.
"""
import hashlib
import tempfile
import importlib.util
import json
import re
import os
import sys
import unicodedata

HERE = os.path.dirname(os.path.abspath(__file__))
# v1.10 (P20): the permission-word rules and the live IDs come from data/policy.json, the one source the compiler and the
# page (live/policy.js, generated from it) read too; scripts/policy.py checks its shape
sys.dont_write_bytecode = True   # loading scripts/policy.py leaves no __pycache__ in the package
_spec = importlib.util.spec_from_file_location('vdh_policy', os.path.join(HERE, '..', 'scripts', 'policy.py'))
_policy = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_policy)
POLICY = _policy.load()


PART_BYTES = 24000   # v1.02; well under the largest single call proven live: 68,524 bytes, v1.02's sitting.js install (A21)


def plan_text(path):
    with open(path, encoding='utf-8') as fh:
        plan = json.load(fh)
    if isinstance(plan, dict) and plan.get('dryRunOnly'):
        raise SystemExit('%s is a plan for a dry run only (%s): it is never loaded' % (path, plan['dryRunOnly']))
    if isinstance(plan, dict) and plan.get('offlineOnly'):
        raise SystemExit('%s is a plan for the offline suites only (%s): it is never loaded' % (path, plan['offlineOnly']))
    text = json.dumps(plan, separators=(',', ':'), ensure_ascii=True)
    return text, hashlib.sha256(text.encode('utf-8')).hexdigest()


def load_cmds(name, path, part_bytes=PART_BYTES):
    """The commands that load a plan: one VDHSit.load call if it fits in part_bytes, else VDHSit.loadPart calls, each at
    most part_bytes. The text is cut before it is quoted, so each part is a JSON string of its own, and the parts joined
    are the plan's text exactly; the page checks the SHA-256 of the whole."""
    text, sha = plan_text(path)
    one = "await VDHSit.load(%s, %s, '%s')" % (json.dumps(name), json.dumps(text), sha)
    if len(one.encode('utf-8')) <= part_bytes:
        return [one]
    frame = len("await VDHSit.loadPart(%s, 999, 999, \"\", '%s')" % (json.dumps(name), sha))
    room = part_bytes - frame
    if room < 1000:
        raise SystemExit('--part-bytes %d leaves no room for the plan' % part_bytes)
    chunks, cur, size = [], [], 0
    for ch in text:   # ASCII only (ensure_ascii): a quote or a backslash takes two bytes once quoted
        w = 2 if ch in '"\\' else 1
        if size + w > room:
            chunks.append(''.join(cur))
            cur, size = [], 0
        cur.append(ch)
        size += w
    if cur:
        chunks.append(''.join(cur))
    assert ''.join(chunks) == text
    n = len(chunks)
    if n > 500:
        raise SystemExit('%s would take %d parts: the page takes at most 500 (VDHSit.loadPart); raise --part-bytes, or split the plan' % (path, n))
    return ["await VDHSit.loadPart(%s, %d, %d, %s, '%s')" % (json.dumps(name), i + 1, n, json.dumps(c), sha) for i, c in enumerate(chunks)]


def load_cmd(name, path):
    """The single command (plans that fit in one part; kept for the suites)."""
    cmds = load_cmds(name, path, part_bytes=10 ** 9)
    return cmds[0]


# v1.09: inspect.js (P19, stage 1); v1.10: policy.js, storage.js, transport.js and reconcile.js (P20, stage 2). The order is
# the install's: the first three are the wall and its tools, unchanged; sitting.js, the controller, comes last
FILES = ['guard.js', 'runner.js', 'verify.js', 'policy.js', 'storage.js', 'transport.js', 'inspect.js', 'reconcile.js', 'sitting.js']
OBJECT = {'guard.js': 'VDHGuard', 'runner.js': 'VDHRunner', 'verify.js': 'VDHVerify', 'policy.js': 'VDHPolicy', 'storage.js': 'VDHStore',
          'transport.js': 'VDHTransport', 'inspect.js': 'VDHInspect', 'reconcile.js': 'VDHReconcile', 'sitting.js': 'VDHSit'}
MANIFEST = os.path.join(HERE, 'install-manifest.json')   # v1.10 (P20): generated by pagecmd.py manifest; check_package.py compares


def page_safe(path, src):
    """A page file must reach the page unchanged: LF line endings, plain ASCII, no backslash-u escape."""
    if '\r' in src:
        raise SystemExit('%s has CR characters; install needs LF line endings' % path)
    bad = sorted({c for c in src if ord(c) > 126})
    if bad:
        raise SystemExit('%s has non-ASCII characters (%s); page files are plain ASCII' % (path, ' '.join('U+%04X' % ord(c) for c in bad)))
    if '\\u' in src:
        raise SystemExit('%s holds a backslash-u escape, which the tool transport would turn into the character; '
                         'write String.fromCharCode(...) instead' % path)
    if re.search(r'\\x[0-9a-fA-F]{2}', src):
        raise SystemExit('%s holds a backslash-x escape; the tool transport was never probed with one, so write the '
                         'character plainly or use String.fromCharCode(...)' % path)
    if re.search(r'\\[pPbB]', src):
        raise SystemExit('%s holds a backslash-p or backslash-b escape; the tool transport was never probed with one '
                         '(the third review of the v1.02 fixes)' % path)


# the page helper's files go without their whole-line comments (gap A21); guard.js, runner.js and verify.js as they are
STRIP_COMMENTS = {'policy.js', 'storage.js', 'transport.js', 'inspect.js', 'reconcile.js', 'sitting.js'}


def comment_lines_out(path, src):
    """The file without its whole-line comments: lines whose text starts with //, and /* ... */ blocks that start a line
    and end one. Nothing else changes, so the code the page runs is the code the suites run. The page files hold no
    template literal and no string running over a line (page_safe), so such a line is always a comment."""
    out, block = [], False
    for n, line in enumerate(src.split('\n'), 1):
        t = line.strip()
        if block:
            if '*/' in t:
                if not t.endswith('*/'):
                    raise SystemExit('%s:%d: code after the end of a comment on one line' % (path, n))
                block = False
            continue
        if line.endswith('\\'):
            raise SystemExit('%s:%d: a line carried on by a backslash: its next line could look like a comment' % (path, n))
        if t.startswith('//'):
            continue
        if t.startswith('/*'):
            if '*/' in t[2:]:
                if t.find('*/', 2) != len(t) - 2:
                    raise SystemExit('%s:%d: code beside a comment on one line (the fourth review of the fixes)' % (path, n))
                continue
            block = True
            continue
        out.append(line)
    if block:
        raise SystemExit('%s: a comment that never ends' % path)
    return '\n'.join(out)


def page_text(path):
    """The function source text the page will hold for a page file: the file, without its whole-line comments for the
    helper's files, wrapped as 'function () {\n' + text + '\n}'. Its SHA-256 is the file's fingerprint."""
    name = os.path.basename(path)
    with open(path, encoding='utf-8', newline='') as fh:
        src = fh.read()
    page_safe(path, src)
    if name in STRIP_COMMENTS:
        if '`' in src:
            raise SystemExit('%s holds a backtick: a template literal could run over a line, so its whole-line comments '
                             'cannot be left out safely' % path)
        src = comment_lines_out(path, src)
    return 'function () {\n' + src + '\n}'


def wrapped(path):
    """(the command to send, the function source text the page will hold). v1.10 (P20): every call first removes VDHSit
    and records its file in the install's order (guard.js starts it), so a VDHSit exists only after a whole install that
    ended with sitting.js; sitting.js's call also carries the install manifest, which the page checks every file against
    before it makes VDHSit. A file this package's manifest does not list as it is (another package's, an edited one) is
    refused here, before anything is sent."""
    name = os.path.basename(path)
    if name not in OBJECT:
        raise SystemExit('%s is not one of the nine page files (%s)' % (path, ', '.join(FILES)))
    fn = page_text(path)
    man = install_manifest()
    entry = [f for f in man['files'] if f['file'] == name][0]
    if hashlib.sha256(fn.encode('utf-8')).hexdigest() != entry['sha256']:
        raise SystemExit('%s is not the %s this package\'s install manifest lists (%s): install the package\'s own page files'
                         % (path, name, 'live/install-manifest.json'))
    obj = OBJECT[name]
    order = ('window.__vdhOrder = [%s];' % json.dumps(name)) if name == FILES[0] else ('(window.__vdhOrder = window.__vdhOrder || []).push(%s);' % json.dumps(name))
    carry = ('window.__vdhManifest = %s;\n' % json.dumps(man, separators=(',', ':'))) if name == FILES[-1] else ''
    cmd = ('delete window.VDHSit;\n' + ('delete window.%s;\n' % obj if obj != 'VDHSit' else '') + order + '\n' +
           '(window.__vdhSrc = window.__vdhSrc || {})[%s] = %s;\n%swindow.__vdhSrc[%s]();\n%s + typeof window.%s'
           % (json.dumps(name), fn, carry, json.dumps(name), json.dumps('installed ' + name + ': '), obj))
    return cmd, fn


def file_paths(tool):
    return [os.path.join(tool, 'scripts', f) for f in FILES[:3]] + [os.path.join(tool, 'live', f) for f in FILES[3:]]


def page_version(tool):
    """The VERSION sitting.js names, for the build id."""
    with open(os.path.join(tool, 'live', 'sitting.js'), encoding='utf-8') as fh:
        m = re.search(r"const VERSION = '(v[0-9.]+)';", fh.read())
    if not m:
        raise SystemExit('live/sitting.js names no VERSION')
    return m.group(1)


def fresh_manifest(tool):
    """v1.10 (P20): the install manifest, from the files themselves: the build id, and each page file in install order with
    the object it makes, its path, whether it goes without its whole-line comments, and the SHA-256 of exactly what the
    page holds. The build id is the version and the first 16 hex of the SHA-256 of the lines "<sha256>  <file>"."""
    files = [{'file': os.path.basename(p), 'object': OBJECT[os.path.basename(p)], 'path': os.path.relpath(p, tool).replace(os.sep, '/'),
              'stripped': os.path.basename(p) in STRIP_COMMENTS, 'sha256': hashlib.sha256(page_text(p).encode('utf-8')).hexdigest()}
             for p in file_paths(tool)]
    build = page_version(tool) + '-' + hashlib.sha256(''.join('%s  %s\n' % (f['sha256'], f['file']) for f in files).encode('utf-8')).hexdigest()[:16]
    return {'generated': 'GENERATED by live/pagecmd.py manifest from the nine page files: do not edit. python3 -B live/pagecmd.py manifest . '
                         '--out live/install-manifest.json writes it again; check_package.py compares it',
            'build': build, 'files': files}


def install_manifest():
    """The package's install manifest (live/install-manifest.json), refused if it no longer matches the page files."""
    tool = os.path.abspath(os.path.join(HERE, '..'))
    # the generated policy files first (v1.10, the independent review): a data/policy.json or guard.js changed without
    # python3 -B scripts/policy.py run again would send a stale policy.js while this file reads the new facts
    for gen_path, make in _policy.GENERATED:
        try:
            with open(gen_path, encoding='utf-8', newline='') as fh:
                current = fh.read() == make()
        except (OSError, _policy.PolicyError):
            current = False
        if not current:
            raise SystemExit('%s is out of date with its sources (data/policy.json, scripts/guard.js): python3 -B scripts/policy.py, '
                             'then python3 -B live/pagecmd.py manifest . --out live/install-manifest.json'
                             % os.path.relpath(gen_path, tool).replace(os.sep, '/'))   # v1.11: the same on Windows (the review of v1.10)
    fresh = fresh_manifest(tool)
    try:
        with open(MANIFEST, encoding='utf-8') as fh:
            kept = json.load(fh)
    except (OSError, ValueError):
        raise SystemExit('%s is missing or not JSON: python3 -B live/pagecmd.py manifest . --out live/install-manifest.json' % MANIFEST)
    if kept != fresh:
        raise SystemExit('%s is out of date with the page files (stale): python3 -B live/pagecmd.py manifest . --out live/install-manifest.json, '
                         'then python3 -B scripts/check_package.py' % MANIFEST)
    return kept


def deleted(v):
    """A ledger entry for an object Joe has deleted by hand (v1.01): "state": "deleted", with the date."""
    return isinstance(v, dict) and v.get('state') == 'deleted'


def failed(v):
    """A ledger entry for a draft that failed (to be deleted by hand): it still exists, but nothing may name it."""
    return isinstance(v, dict) and v.get('state') == 'failed'


def hashed_call(fn, arg):
    """v1.07 (P2): a VDHSit call whose one argument travels as load's plan does, as ASCII-only JSON text inside a JSON
    string, then its SHA-256. The page hashes the string it received, refuses a mismatch with nothing read, sent or
    changed, and only then parses it."""
    text = json.dumps(arg, separators=(',', ':'), ensure_ascii=True)
    return "await VDHSit.%s(%s, '%s')" % (fn, json.dumps(text), hashlib.sha256(text.encode('utf-8')).hexdigest())


def refs_cmd(path, led=None):
    """The refs call for the ledger at path, or (v1.11, record) for the ledger given, not yet written."""
    if led is None:
        led = read_ledger(path)
    out = {}
    # v1.02: what the ledger holds, by kind, so the page clears each verified run it now holds (the review of the fixes:
    # IDs without their kind let an email's ID stand for a flow's). Every flow, segment and email ID, whatever its state
    # (an ID is one object's, for good); tags and fields by name, but not one marked deleted or failed: a name outlives
    # its object, and a run that makes the tag anew is in the ledger only once ledger add has written it. A failed one is
    # held (the second review of the fixes): it still exists, the compiler never makes it anew, and its run's record clears
    held = {k: [] for k in LEDGER_KINDS}
    for kind, prefix in (('flows', 'flow'), ('emails', 'email'), ('segments', 'segment')):
        for key, v in (led.get(kind) or {}).items():
            held[kind].append(v['id'])
            if not deleted(v) and not failed(v):   # a deleted or failed object's id is never a ref
                out['%s:%s' % (prefix, key)] = v['id']
        held[kind] = sorted(set(held[kind]))
    for kind in ('tags', 'fields'):
        held[kind] = sorted(n for n, v in (led.get(kind) or {}).items() if not deleted(v))
    return hashed_call('setRefs', {'refs': out, 'ledger': held})


# ---------------------------------------------------------------- the ledger, by a tool (v1.02; review of v1.01, N10)
LEDGER_KINDS = ('flows', 'segments', 'emails', 'tags', 'fields')
LEDGER_STATES = {None, 'built', 'built-off', 'handed-over', 'failed', 'deleted'}   # 'built': the 2026-09-25 sitting's word
DATE = re.compile(r'\d{4}-\d{2}-\d{2}')
KIND_OF = {'flow': 'flows', 'segment': 'segments', 'email': 'emails', 'tag': 'tags', 'field': 'fields'}
NOT_WORDS = re.compile(POLICY['permissionWords']['notWords'])   # as compile.py and the page, on the words' letters and digits
NOTE_OPENERS = tuple(POLICY['permissionWords']['noteOpeners'])
# live objects the builder did not make (the switch-over's flow, the seeded segments, the master emails): never failed or
# deleted by a put. 488125 is Encharge email VDH Master · Letter, the master Joe made on 2026-09-28 (v1.05; the master
# test's results, section 11); 373125 is Tester 1, the old master
LIVE_IDS = {k: set(v) for k, v in POLICY['liveIds'].items()}   # v1.10: data/policy.json
LEDGER_OPTS = {'check': set(), 'add': {'--run', '--plan', '--state', '--verify', '--session', '--date', '--tags', '--fields'},
               'made-ids': {'--run', '--tags', '--fields'}, 'supersede': {'--joe', '--date'}, 'delete': {'--joe', '--date'},
               'live-move': {'--date'}, 'switched-off': {'--joe', '--date'}, 'handed-over': {'--listeners', '--date'},
               'put': {'--entry', '--joe', '--date'}, 'edited': {'--change', '--joe', '--run', '--snapshot', '--date'},
               'keep': {'--joe', '--date'}}


def real_day(d):
    """A calendar day (not 2026-99-99)."""
    import datetime
    try:
        return bool(DATE.fullmatch(d)) and datetime.date.fromisoformat(d) is not None
    except ValueError:
        return False


def kind_of(k):
    k = KIND_OF.get(k, k)
    if k not in LEDGER_KINDS:
        raise SystemExit('%s: the kinds are %s' % (k, ', '.join(LEDGER_KINDS)))
    return k


def joe_words(joe, what):
    """Joe's own words, as the permission checks take them: not empty, not a note in brackets, not a test's label."""
    w = ''.join(c for c in (joe or '') if unicodedata.category(c) not in ('Cf', 'Cc')).strip()   # invisible characters out, as compile.py
    if not w or w[:1] in NOTE_OPENERS or NOT_WORDS.search(re.sub(r'[^a-z0-9]', '', w.lower())):
        raise SystemExit('%s needs Joe\'s own words (--joe "..."), as he wrote them in the chat' % what)
    return w


def ledger_problems(led):
    """Why a ledger is not in the shape the builder reads, or []: kinds are objects keyed by key (tags and fields by name);
    flows, segments and emails carry a whole-number id, one ID per key; states are the builder's."""
    out = []
    if not isinstance(led, dict):
        return ['the ledger is not an object of kinds']
    for kind in LEDGER_KINDS:
        entries = led.get(kind)
        if entries is None:
            continue
        if not isinstance(entries, dict):
            out.append('%s: an object keyed by %s' % (kind, 'name' if kind in ('tags', 'fields') else 'key'))
            continue
        seen = {}
        for key, v in entries.items():
            if not isinstance(v, dict):
                out.append('%s.%s: an entry is an object' % (kind, key))
                continue
            if v.get('state') not in LEDGER_STATES:
                out.append('%s.%s: state %s is not one of %s' % (kind, key, json.dumps(v.get('state')), ', '.join(sorted(s for s in LEDGER_STATES if s))))
            if kind in ('flows', 'segments', 'emails'):
                if type(v.get('id')) is not int:
                    out.append('%s.%s: no whole-number id' % (kind, key))
                    continue
                seen.setdefault(v['id'], []).append(key)
                if v['id'] in LIVE_IDS.get(kind, set()) and v.get('state') not in (None, 'deleted'):
                    out.append('%s.%s: Encharge %s %d is a live object the builder did not make: no state but deleted, never on '
                               'the delete list' % (kind, key, kind[:-1], v['id']))
        for i, keys in sorted(seen.items()):
            if len(keys) > 1:
                out.append('%s: Encharge id %d is under %s: one object, one entry' % (kind, i, ' and '.join(keys)))
    for k in led:
        if k not in LEDGER_KINDS and k != 'edited' and not k.startswith('_'):
            out.append('%s: not a kind the ledger holds (%s, edited, or a note under a key starting with _)' % (k, ', '.join(LEDGER_KINDS)))
    return out


def read_ledger(path):
    with open(path, encoding='utf-8') as fh:
        led = json.load(fh)
    bad = ledger_problems(led)
    if bad:
        raise SystemExit('the ledger needs settling first:\n  - ' + '\n  - '.join(bad))
    return led


def ledger_text(led):
    """The ledger as every command writes it: checked, then JSON, indent 1, UTF-8 as is, ending in LF."""
    bad = ledger_problems(led)
    if bad:
        raise SystemExit('refused: the ledger would not be in shape:\n  - ' + '\n  - '.join(bad))
    return json.dumps(led, indent=1, ensure_ascii=False) + '\n'


def write_ledger(path, led):
    text = ledger_text(led)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(text)
    os.replace(tmp, path)


def iso_ts(s, what):
    import datetime
    try:
        return datetime.datetime.fromisoformat(str(s).replace('Z', '+00:00')).timestamp()
    except ValueError:
        raise SystemExit('%s is not a time: %s' % (what, s))


def read_before(fp, when, what):
    """A session's first read: saved before `when` (a timestamp), or refused as a later read."""
    if fp is None:
        return
    if not os.path.exists(fp):
        raise SystemExit('%s: no such file (the session\'s first read)' % fp)
    if os.path.getmtime(fp) > when:
        raise SystemExit('%s was saved after %s: it is a later read, which may hold what the run made, not the session\'s first '
                         'read of the session that ran it. Leave --tags and --fields out, or give that session\'s first reads' % (fp, what))


def free_key(entries, key, tag, date):
    k = '%s-%s-%s' % (key, tag, date)
    n = 2
    while k in entries:
        k = '%s-%s-%s-%d' % (key, tag, date, n)
        n += 1
    return k


def plan_objects(plan):
    """From a plan: each flow's display name, each email's and segment's name, and each field's type, by key."""
    out = {'flows': {}, 'emails': {}, 'segments': {}, 'fields': {}}
    for c in plan.get('calls') or []:
        b = c.get('body')
        save = c.get('save') or {}
        if c.get('do') == 'create-flow' and isinstance(b, dict):
            for k in save:
                if k.startswith('flow:'):
                    out['flows'][k[5:]] = b.get('name')
        elif c.get('do') == 'create-segment' and isinstance(b, dict):
            out['segments'][c.get('key')] = b.get('name')
        elif c.get('do') == 'create-email' and isinstance(b, dict):
            out['emails'][c.get('key')] = (b.get('$emailFromMaster') or {}).get('name')
        elif c.get('do') == 'create-field' and isinstance(b, list):
            for f in b:
                if isinstance(f, dict):
                    out['fields'][f.get('name')] = 'date' if f.get('format') == 'date-time' else 'text'
    return out


def first_read(path, kind):
    """The names in the session's first read of tags or fields (tags.json, fields.json), or an empty set."""
    if not path:
        return set()
    try:
        with open(path, encoding='utf-8') as fh:
            d = json.load(fh)
    except (OSError, ValueError) as err:
        raise SystemExit('%s: the session\'s first read of the %s cannot be read (%s)' % (path, kind, err))
    d = d.get(kind, d) if isinstance(d, dict) else d
    if isinstance(d, dict):
        return set(d)
    return {x if isinstance(x, str) else (x.get('tag') or x.get('name')) for x in d if isinstance(x, (str, dict))}


def ledger_add(path, ids_path, run, plan_path, state, verify, session=None, date=None, tags_path=None, fields_path=None, writer=None):
    """Writes what one run made into the ledger (SKILL.md, The ledger): each flow, email and segment by key with its ID,
    each tag and field by name, with state, made (date, session, run), spec (the plan's provenance) and verify. A key the
    ledger holds as failed or deleted moves first, with its state, to <key>-old-<date>; a key it holds live is refused (a
    rebuild takes the old entry off the key before the compile). writer (v1.11, record): what is done with the new ledger
    instead of writing it at once."""
    if state not in ('built-off', 'failed'):
        raise SystemExit('--state is built-off (verified) or failed (never verified, on the delete list)')
    if verify is None and state == 'failed':
        verify = 'never verified'
    if state == 'built-off' and verify != 'ok':
        raise SystemExit('built-off is for a run whose plain verify passed: --verify ok')
    date_given = date is not None
    date = date or __import__('datetime').date.today().isoformat()
    if not DATE.fullmatch(date):
        raise SystemExit('--date is YYYY-MM-DD')
    led = read_ledger(path)
    with open(ids_path, encoding='utf-8') as fh:
        got = json.load(fh)
    if isinstance(got, dict) and isinstance(got.get('runs'), list):   # VDHSit.unledgered()
        got = [r for r in got['runs'] if isinstance(r, dict) and r.get('run') == run]
        if len(got) != 1:
            raise SystemExit('VDHSit.unledgered() holds no run named %s' % run)
        got = got[0]
    rec_pv, rec_at, rec_start = None, None, None
    if isinstance(got, dict) and isinstance(got.get('ids'), dict) and got.get('run') is not None:   # one unledgered record
        if got['run'] != run:
            raise SystemExit('the record is run %s, not %s' % (got['run'], run))
        rec_pv, rec_at, rec_start = got.get('provenance'), got.get('verifiedAt'), got.get('startedAt')
        got = got['ids']
    # made-ids's answer carries when the run started, from its marker (the third review of the fixes: the file itself is
    # always written after any read)
    made_meta = got.pop('_marker', None) if isinstance(got, dict) else None
    if made_meta is not None and (not isinstance(made_meta, dict) or made_meta.get('run') != run):
        raise SystemExit('%s was written by made-ids for run %s, not %s' % (ids_path, (made_meta or {}).get('run'), run))
    # a first read taken after the run is a later one: it may hold what the run made (the reviews of the fixes). Saved after
    # the run started (a made-ids answer), after it was verified (a record), or after the IDs file (VDHSit.ids), it is refused
    if made_meta is not None and made_meta.get('startedAt'):
        when, what = iso_ts(made_meta['startedAt'], 'the marker\'s start'), 'run %s started (%s)' % (run, made_meta['startedAt'])
    elif isinstance(rec_start, str):
        when, what = iso_ts(rec_start, 'the record\'s startedAt'), 'run %s started (%s)' % (run, rec_start)
    elif isinstance(rec_at, str):
        when, what = iso_ts(rec_at, 'the record\'s verifiedAt'), 'run %s was verified (%s)' % (run, rec_at)
    else:
        when, what = os.path.getmtime(ids_path), ids_path
    for fp in (tags_path, fields_path):
        read_before(fp, when, what)
    if isinstance(rec_at, str) and not date_given:
        date = rec_at[:10] if DATE.fullmatch(rec_at[:10]) else date
    if not isinstance(got, dict) or not got:
        raise SystemExit('%s holds no IDs ({"flow:<key>": id, ...})' % ids_path)
    if plan_path:
        with open(plan_path, encoding='utf-8') as fh:
            plan = json.load(fh)
        pv = plan.get('provenance') or {}
        spec = {'compiler': pv.get('compiler'), 'inputs': ['%s@%s' % (x.get('file'), str(x.get('sha256'))[:12]) for x in pv.get('inputs') or [] if isinstance(x, dict)]}
        if pv.get('emailSet'):
            spec['emailSet'] = pv['emailSet']
        names = plan_objects(plan)
    elif isinstance(rec_pv, dict):
        # after a reload, in a later session: the page's record carries the plan's provenance, short; no names
        spec = {k: rec_pv[k] for k in ('compiler', 'emailSet', 'inputs') if rec_pv.get(k)}
        names = {'flows': {}, 'emails': {}, 'segments': {}, 'fields': {}}
    else:
        raise SystemExit('--plan <plan.json>: the plan the run ran (only a record from VDHSit.unledgered() can go in without it)')
    made = {'date': date, 'run': run}
    if session:
        made['session'] = session
    new = {k: {} for k in LEDGER_KINDS}
    steps, before = {}, {'tag': first_read(tags_path, 'tags'), 'field': first_read(fields_path, 'fields')}
    left_out = []
    for k, v in got.items():
        kind, _, key = k.partition(':')
        if kind == 'position':
            continue
        if kind in before and key in before[kind]:
            left_out.append(k)   # there at the start of the session: not the run's (SKILL.md, session protocol, step 9)
            continue
        if kind == 'step':
            fk, _, sk = key.partition('/')
            steps.setdefault(fk, {})[sk] = v
            continue
        plural = {'flow': 'flows', 'segment': 'segments', 'email': 'emails', 'tag': 'tags', 'field': 'fields'}.get(kind)
        if not plural or not key:
            raise SystemExit('%s: not a key VDHSit.ids gives' % k)
        if plural in ('flows', 'segments', 'emails') and type(v) is not int:
            raise SystemExit('%s: the ID is not a whole number' % k)
        e = {'state': state, 'made': dict(made), 'spec': spec, 'verify': verify}
        if plural in ('flows', 'segments', 'emails'):
            e = dict({'id': v}, **e)
            if names[plural].get(key):
                e['name'] = names[plural][key]
        if plural == 'fields' and names['fields'].get(key):
            e['type'] = names['fields'][key]
        new[plural][key] = e
    for fk, st in steps.items():
        if fk not in new['flows']:
            raise SystemExit('steps of flow %s, but not the flow' % fk)
        new['flows'][fk]['steps'] = st
    moved = []
    for kind in LEDGER_KINDS:
        entries = led.setdefault(kind, {}) if new[kind] else led.get(kind) or {}
        for key, e in new[kind].items():
            old = entries.get(key)
            if old is not None:
                st = old.get('state') if isinstance(old, dict) else None
                if isinstance(old, dict) and isinstance(old.get('made'), dict) and old['made'].get('run') == run:
                    raise SystemExit('%s.%s is in the ledger already, from this very run %s: send pagecmd.py refs ledger.json '
                                     '(never ledger supersede)' % (kind, key, run))
                if kind in ('tags', 'fields') and st == 'deleted':
                    # one per name in Encharge: the new one takes the name, the old entry kept in it (a key of its own
                    # would be a name no tag has)
                    e['replaced'] = old
                    moved.append('%s.%s: the deleted entry kept under "replaced"' % (kind, key))
                elif kind in ('tags', 'fields') and st == 'failed':
                    raise SystemExit('%s.%s is marked failed (on the delete list): a run reusing it would keep it there; Joe deletes it first' % (kind, key))
                elif st in ('failed', 'deleted'):
                    nk = free_key(entries, key, 'old', date)
                    entries[nk] = old
                    moved.append('%s.%s -> %s' % (kind, key, nk))
                else:
                    if kind in ('tags', 'fields'):
                        raise SystemExit('%s.%s is in the ledger live (%s): a tag or field is one per name, and the compiler never makes one '
                                         'the ledger holds, so this run cannot have made it. Compare with VDHSit.unledgered() and settle it '
                                         'with Joe; never answer this with ledger supersede' % (kind, key, st or 'no state'))
                    raise SystemExit('%s.%s is in the ledger live (%s): if this run is already in the ledger, send pagecmd.py refs ledger.json '
                                     'instead; a rebuild takes the old entry off the key before its compile (ledger supersede, or live-move '
                                     'for a flow Joe has switched on)' % (kind, key, st or 'no state'))
            if 'id' in e:
                for k2, v2 in entries.items():
                    if isinstance(v2, dict) and v2.get('id') == e['id']:
                        raise SystemExit('%s: Encharge id %d is already in the ledger under %s' % (kind, e['id'], k2))
            entries[key] = e
    # a tag or field left out was there before the run: the ledger holds it as not the builder's (off the delete list),
    # so the page, which recorded it as the run's, sees the run in the ledger (the review of the fixes: else no run
    # would ever start again)
    for k in left_out:
        kind, _, key = k.partition(':')
        entries = led.setdefault(KIND_OF[kind], {})
        if key not in entries:
            entries[key] = {'made': 'before run %s: in the first read of its session, so not the builder\'s' % run, 'date': date,
                            'note': 'not on the delete list'}
    (writer or write_ledger)(path, led)
    out = {'added': {k: sorted(v) for k, v in new.items() if v}, 'moved': moved}
    if left_out:
        out['leftOut'] = sorted(left_out)
    return out


def ledger_set(path, kind, key, action, date=None, joe=None, listeners=None):
    date = date or __import__('datetime').date.today().isoformat()
    if not DATE.fullmatch(date):
        raise SystemExit('--date is YYYY-MM-DD')
    kind = kind_of(kind)
    led = read_ledger(path)
    entries = led.get(kind)
    if not isinstance(entries, dict) or key not in entries:
        raise SystemExit('%s.%s is not in the ledger' % (kind, key))
    e = entries[key]
    st = e.get('state')
    if action == 'supersede':
        joe = joe_words(joe, 'supersede')
        if st == 'handed-over':
            raise SystemExit('%s.%s is switched on (handed-over): it is never marked failed while it is on; ledger live-move it first' % (kind, key))
        if st not in ('built-off', 'built'):
            # no state: an object the builder did not make (a live segment, Joe's own); failed or deleted: already off
            raise SystemExit('%s.%s is %s: supersede is for a draft the builder made and verified (built-off)' % (kind, key, st or 'not the builder\'s (no state)'))
        e['state'] = 'failed'
        e['superseded'] = {'date': date, 'joeSaid': joe}
    elif action == 'live-move':
        if kind != 'flows' or st != 'handed-over':
            raise SystemExit('live-move is for a flow Joe has switched on (handed-over); %s.%s is %s' % (kind, key, st or 'no state'))
        nk = free_key(entries, key, 'live', date)
        entries[nk] = entries.pop(key)
        write_ledger(path, led)
        return {'moved': '%s.%s -> %s' % (kind, key, nk)}
    elif action == 'switched-off':
        joe = joe_words(joe, 'switched-off')
        if kind != 'flows' or not re.search(r'-live-\d{4}-\d{2}-\d{2}(-\d+)?$', key) or st != 'handed-over':
            raise SystemExit('switched-off is for the old flow a rebuild replaced (<key>-live-<date>, handed-over), once Joe has switched it '
                             'off after the switch-over; %s.%s is %s' % (kind, key, st or 'no state'))
        e['state'] = 'failed'
        e['switchedOff'] = {'date': date, 'joeSaid': joe}
    elif action == 'keep':
        joe = joe_words(joe, 'keep')
        if kind not in ('tags', 'fields') or st != 'failed':
            raise SystemExit('keep is for a tag or field a failed run made that Joe keeps (failed); %s.%s is %s' % (kind, key, st or 'no state'))
        e['state'] = 'built-off'
        e['kept'] = {'date': date, 'joeSaid': joe, 'note': 'made by a run that failed; Joe keeps it (never verified by that run)'}
    elif action == 'delete':
        joe = joe_words(joe, 'delete')
        if st == 'deleted':
            raise SystemExit('%s.%s is deleted already' % (kind, key))
        e['state'] = 'deleted'
        e['deleted'] = date
        e['deletedJoeSaid'] = joe
    elif action == 'handed-over':
        if kind != 'flows' or st not in ('built-off', 'built'):
            raise SystemExit('handed-over is for a verified draft flow (built-off); %s.%s is %s' % (kind, key, st or 'no state'))
        e['state'] = 'handed-over'
        e['handedOver'] = {'date': date}
        if listeners:
            e['handedOver']['listeners'] = listeners
    write_ledger(path, led)
    return {kind + '.' + key: e.get('state')}


def ledger_put(path, kind, key, entry_text, date=None, joe=None):
    """One entry the tools do not write: an object Joe made by hand, or an unknown ZZ object reconcile listed (by its
    ID, "state": "failed"). Never over a key the ledger holds: the other commands change an entry."""
    kind = kind_of(kind)
    led = read_ledger(path)
    try:
        entry = json.loads(entry_text)
    except ValueError as err:
        raise SystemExit('--entry is a JSON object: %s' % err)
    if not isinstance(entry, dict) or not entry:
        raise SystemExit('--entry is a JSON object, e.g. {"id": 1234, "state": "failed", "note": "..."}')
    if entry.get('state') in ('failed', 'deleted'):
        # the delete list: never an object the builder did not make, and only on Joe's words (the second review of the fixes)
        if entry.get('id') in LIVE_IDS.get(kind, set()):
            raise SystemExit('%s %s is a live object the builder did not make: never failed or deleted by a put' % (kind[:-1], entry.get('id')))
        entry['putJoeSaid'] = joe_words(joe, 'a put of a %s entry' % entry['state'])
    elif joe is not None:
        entry['putJoeSaid'] = joe_words(joe, 'put')   # given, they are judged too
    entries = led.setdefault(kind, {})
    if key in entries:
        raise SystemExit('%s.%s is in the ledger: put never writes over an entry (supersede, delete, live-move, handed-over change one)' % (kind, key))
    entry.setdefault('put', date or __import__('datetime').date.today().isoformat())
    entries[key] = entry
    write_ledger(path, led)
    return {kind + '.' + key: entry}


def ledger_edited(path, obj, change, joe, date=None, run=None, snapshot=None):
    """An edit to an object the builder did not make, under Joe's permission, as the ledger's "edited" list keeps them."""
    kind, _, ident = (obj or '').partition(':')
    if kind not in KIND_OF or not ident:
        raise SystemExit('the object is <kind>:<id or name>, e.g. segment:1059368')
    if not change or not change.strip():
        raise SystemExit('--change says what the edit changed')
    joe = joe_words(joe, 'edited')
    date = date or __import__('datetime').date.today().isoformat()
    led = read_ledger(path)
    ed = led.setdefault('edited', {})
    key, n = obj, 2
    while key in ed:
        key = '%s#%d' % (obj, n)
        n += 1
    ed[key] = {'change': change.strip(), 'permission': joe, 'made': dict({'date': date}, **({'run': run} if run else {}))}
    if snapshot:
        # the rows Joe restores by hand, kept in the ledger, which carries over between sessions (the workspace does not)
        with open(snapshot, 'rb') as fh:
            raw = fh.read()
        if len(raw) > 65536:
            raise SystemExit('%s is over 64 KB: keep the snapshot of this segment alone' % snapshot)
        try:
            content = json.loads(raw.decode('utf-8'))
        except ValueError as err:
            raise SystemExit('%s is not JSON (what VDHSit.snapshotSegments answered): %s' % (snapshot, err))
        ed[key]['snapshot'] = {'file': os.path.basename(snapshot), 'sha256': hashlib.sha256(raw).hexdigest(), 'content': content}
    write_ledger(path, led)
    return {'edited.' + key: ed[key]}


def made_ids(plan_path, marker_path, run, tags_path=None, fields_path=None):
    """The IDs a run that never verified made, keyed as ledger add takes them, from the run's marker (what
    VDHSit.reconcileDue() answered before the reconcile, or what the waive answered): each create Encharge answered,
    by the plan's names. Returns (ids, unkeyed)."""
    with open(plan_path, encoding='utf-8') as fh:
        plan = json.load(fh)
    with open(marker_path, encoding='utf-8') as fh:
        mk = json.load(fh)
    if not isinstance(mk, dict) or not isinstance(mk.get('made'), list):
        raise SystemExit('%s holds no marker: save what VDHSit.reconcileDue() answers before the reconcile (or the waive\'s answer)' % marker_path)
    if mk.get('run') != run:
        raise SystemExit('the marker is run %s, not %s' % (mk.get('run'), run))
    started = mk.get('at') if isinstance(mk.get('at'), str) else None
    if (tags_path or fields_path) and not started:
        raise SystemExit('%s carries no start (at): the first reads cannot be judged against it; save what VDHSit.reconcileDue() '
                         'answers, or leave --tags and --fields out' % marker_path)
    for fp in (tags_path, fields_path):
        read_before(fp, iso_ts(started, 'the marker\'s start') if started else 0, 'run %s started (%s)' % (run, started))
    before = {'tag': first_read(tags_path, 'tags'), 'field': first_read(fields_path, 'fields')}
    names = plan_objects(plan)
    by_name = {}
    for plural in ('flows', 'segments', 'emails'):
        seen = {}
        for key, nm in names[plural].items():
            if nm in seen:
                raise SystemExit('the plan names two %s %s (%s and %s): made-ids cannot tell them apart' % (plural, json.dumps(nm), seen[nm], key))
            seen[nm] = key
        by_name[plural] = seen
    ids, unkeyed = {}, []
    for m in mk['made']:
        if not isinstance(m, dict) or m.get('kind') not in KIND_OF:
            unkeyed.append(m)
            continue
        kind, nm = m['kind'], m.get('name')
        if kind in ('tag', 'field'):
            if isinstance(nm, str) and nm and nm in before[kind]:
                continue   # there before the run (the session's first read): never the run's, never on the delete list
            if isinstance(nm, str) and nm:
                ids['%s:%s' % (kind, nm)] = nm
            else:
                unkeyed.append(m)
            continue
        key = by_name[KIND_OF[kind]].get(nm)
        if key is None or type(m.get('id')) is not int:
            unkeyed.append(m)   # made, but not by a name the plan gives, or answered without its ID: Joe finds it
            continue
        ids['%s:%s' % (kind, key)] = m['id']
    if ids:
        ids['_marker'] = {'run': run, 'startedAt': started}
    return ids, unkeyed


def plan_names(plan):
    """The display names a plan creates: flows, segments and emails by name, tags and fields by name (as sitting.js)."""
    out = []
    for c in plan.get('calls') or []:
        b = c.get('body')
        if c.get('do') in ('create-flow', 'create-segment') and isinstance(b, dict) and isinstance(b.get('name'), str):
            out.append(b['name'])
        elif c.get('do') == 'create-email' and isinstance(b, dict) and isinstance((b.get('$emailFromMaster') or {}).get('name'), str):
            out.append(b['$emailFromMaster']['name'])
        elif c.get('do') == 'create-tag' and isinstance(b, dict):
            out.extend(t['tag'] for t in b.get('tags') or [] if isinstance(t, dict) and isinstance(t.get('tag'), str))
        elif c.get('do') == 'create-field' and isinstance(b, list):
            out.extend(f['name'] for f in b if isinstance(f, dict) and isinstance(f.get('name'), str))
    return out


def reconcile_cmd(ledger_path, plan_paths, tags_path=None, fields_path=None):
    """The reconcile call, derived from the ledger (and the plans, and the session's first reads) at check time."""
    with open(ledger_path, encoding='utf-8') as fh:
        led = json.load(fh)
    if not isinstance(led, dict):
        raise SystemExit('the ledger is not an object of kinds')
    known = {'flows': [], 'segments': [], 'emails': [], 'tags': [], 'fields': [], 'names': []}
    # v1.01: an entry the ledger marks "state": "deleted" is expected to be gone from Encharge's lists (the page reports
    # it if it is still there), and one it knows otherwise to be listed (the page reports it if it is missing); the page
    # clears a marker only when both hold
    gone = {'flows': [], 'segments': [], 'emails': [], 'tags': [], 'fields': []}
    # v1.11 (P4): emails too, by ID: the page reads each one (emails have no list call, gap A17)
    for kind in ('flows', 'segments', 'emails'):
        entries = led.get(kind) or {}
        if not isinstance(entries, dict):
            raise SystemExit('ledger %s must be an object of key: {"id": ...}' % kind)
        for key, v in entries.items():
            if not isinstance(v, dict) or type(v.get('id')) is not int:
                raise SystemExit('ledger %s.%s has no numeric id' % (kind, key))
            (gone if deleted(v) else known)[kind].append(v['id'])
    for kind in ('tags', 'fields'):
        entries = led.get(kind) or {}
        names = list(entries.keys()) if isinstance(entries, dict) else entries
        if not isinstance(names, list) or not all(isinstance(n, str) for n in names):
            raise SystemExit('ledger %s must be an object keyed by name, or a list of names' % kind)
        for n in names:
            (gone if isinstance(entries, dict) and deleted(entries[n]) else known)[kind].append(n)
        known[kind] = sorted(known[kind])
        gone[kind] = sorted(gone[kind])
    if any(gone.values()):
        known['deleted'] = gone
    # the flows on the delete list (failed): the page answers failedOn for any that Encharge lists as on (the third
    # review of the fixes: a flow switched on without the ledger knowing must never be deleted as a draft)
    failed_flows = sorted(v['id'] for v in (led.get('flows') or {}).values() if isinstance(v, dict) and failed(v) and type(v.get('id')) is int)
    if failed_flows:
        known['failedFlows'] = failed_flows
    for p in plan_paths:
        with open(p, encoding='utf-8') as fh:
            for n in plan_names(json.load(fh)):
                if n not in known['names']:
                    known['names'].append(n)
    if tags_path:
        with open(tags_path, encoding='utf-8') as fh:
            t = json.load(fh)
        t = t.get('tags', t) if isinstance(t, dict) else t
        known['tagsAtStart'] = sorted(x if isinstance(x, str) else x.get('tag') for x in t if isinstance(x, str) or (isinstance(x, dict) and isinstance(x.get('tag'), str)))
    if fields_path:
        with open(fields_path, encoding='utf-8') as fh:
            f = json.load(fh)
        f = f.get('fields', f) if isinstance(f, dict) else f
        known['fieldsAtStart'] = sorted(f.keys()) if isinstance(f, dict) else sorted(x['name'] for x in f if isinstance(x, dict) and isinstance(x.get('name'), str))
    return hashed_call('reconcile', known)


RECORD_OPTS = {'--run', '--plan', '--session', '--date', '--tags', '--fields'}


def same_file(a, b):
    """Whether two paths name one file: the same path once resolved (case folded where the platform folds it, links
    followed), or, for files that exist, one file by its identity (a hard link, another spelling)."""
    if os.path.normcase(os.path.realpath(a)) == os.path.normcase(os.path.realpath(b)):
        return True
    try:
        return os.path.exists(a) and os.path.exists(b) and os.path.samefile(a, b)
    except OSError:
        return False


def temp_beside(path):
    """A new file of its own beside path, made with O_EXCL under a name no one chose (tempfile.mkstemp), so an existing
    file, link or hard link of any name is never written through (the independent review of v1.11)."""
    fd, tmp = tempfile.mkstemp(prefix='.' + os.path.basename(path) + '.', suffix='.record-tmp', dir=os.path.dirname(os.path.abspath(path)))
    return fd, tmp


def keep_mode(tmp, path):
    """A temporary file takes the mode of the file it replaces, or a new file's usual mode (mkstemp makes it 0600)."""
    try:
        mode = os.stat(path).st_mode & 0o7777
    except FileNotFoundError:
        mask = os.umask(0)
        os.umask(mask)
        mode = 0o666 & ~mask
    os.chmod(tmp, mode)


def commit_together(writes):
    """v1.11 (the review of v1.10, R2): write each (path, text) or none. Each text goes first to a new file of its own
    beside its path; only when all are written are they moved into place, in order (the ledger last: it is the commit),
    and if a move fails, every file already moved gets its earlier content back (or goes, if it was not there). A failure
    answers what was and was not written, and leaves no temporary file."""
    temps, made = [], []
    try:
        try:
            before = {}
            for path, text in writes:
                try:
                    with open(path, 'rb') as fh:
                        before[path] = fh.read()
                except FileNotFoundError:
                    before[path] = None
                fd, tmp = temp_beside(path)
                made.append(tmp)
                with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as fh:
                    fh.write(text)
                keep_mode(tmp, path)
                temps.append((tmp, path))
        except OSError as e:
            raise SystemExit('record could not prepare %s (%s): nothing written' % (path, e))
        moved = []
        for tmp, path in temps:
            try:
                os.replace(tmp, path)
                moved.append(path)
            except OSError as e:
                lost = []
                for done in reversed(moved):
                    try:
                        if before[done] is None:
                            os.remove(done)
                        else:
                            fd, back = temp_beside(done)
                            made.append(back)
                            with os.fdopen(fd, 'wb') as fh:
                                fh.write(before[done])
                            keep_mode(back, done)
                            os.replace(back, done)
                    except OSError:
                        lost.append(done)
                if lost:
                    unchanged = [q for _, q in temps if q not in moved]
                    raise SystemExit('record could not write %s (%s), and could not put back %s, which now holds the new text; %s %s '
                                     'unchanged. Delete or restore %s by hand, then run the same command again'
                                     % (path, e, ', '.join(lost), ', '.join(unchanged), 'is' if len(unchanged) == 1 else 'are', ', '.join(lost)))
                raise SystemExit('record could not write %s (%s): nothing written (%s put back as it was)'
                                 % (path, e, ', '.join(moved) if moved else 'no file changed'))
    finally:
        for t in made:
            try:
                os.remove(t)
            except OSError:
                pass


def record(ledger_path, ids_path, run, out_path, plan_path=None, session=None, date=None, tags_path=None, fields_path=None):
    """v1.10 (P3): one command after a verified run. It adds the run to the ledger as ledger add does for a verified run
    (--state built-off --verify ok: the same entries, moves and refusals), checks the whole ledger, and writes the refs
    call (refs, with the SHA-256 of its argument, as pagecmd.py refs writes it) to out_path. It replaces ledger add, then
    ledger check, then refs; the session still writes the ledger back to the Project, then sends the refs call. Both are
    written together or not at all (v1.11): a refused add, an --out that is one of its inputs, and a write that fails, each
    leave the ledger and the refs file as they were. ledger add, ledger check and refs still work as before."""
    if not out_path:
        raise SystemExit('record writes the refs call to a file: give --out <file>')
    # v1.11 (the review of v1.10, R1): the refs file is never one of the inputs (--out ledger.json replaced the ledger with
    # the call and answered ok), however it is spelt or linked
    for what, p in (('the ledger', ledger_path), ('the IDs file', ids_path), ('the plan', plan_path), ('the tags read (--tags)', tags_path),
                    ('the fields read (--fields)', fields_path)):
        if p and same_file(out_path, p):
            raise SystemExit('record: --out %s is %s: the refs call is never written over an input. Nothing written' % (out_path, what))
    # where the call goes is checked before anything else (the independent review of v1.10)
    out_dir = os.path.dirname(os.path.abspath(out_path))
    if os.path.isdir(out_path) or not os.path.isdir(out_dir) or not os.access(out_dir, os.W_OK):
        raise SystemExit('record cannot write the refs call to %s (no such folder, not writable, or a folder): nothing written' % out_path)
    # v1.11 (R2): the new ledger and its refs call are made in memory first, then written together (commit_together)
    held = {}
    answer = ledger_add(ledger_path, ids_path, run, plan_path, 'built-off', 'ok', session, date, tags_path, fields_path,
                        writer=lambda path, led: held.update(led=led, text=ledger_text(led)))
    call = refs_cmd(ledger_path, held['led'])
    commit_together([(out_path, call + '\n'), (ledger_path, held['text'])])
    answer = dict(answer)
    answer['check'] = 'ok'
    answer['refs'] = {'file': out_path, 'sha256': re.search(r"'([0-9a-f]{64})'\)$", call).group(1)}
    return answer


def sha_of(path):
    """The SHA-256 of a saved read (fields.json, tags.json) as the page's JSON.stringify writes it: compact, keys in
    their order, non-ASCII as is. VDHSit.fields() and VDHSit.tags() return the same hash of what they read."""
    with open(path, encoding='utf-8') as fh:
        data = json.load(fh)
    if isinstance(data, dict) and ('fields' in data or 'tags' in data) and len(data) <= 3:
        data = data.get('fields', data.get('tags'))
    return hashlib.sha256(json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode('utf-8')).hexdigest()


def fingerprint(tool):
    out = {}
    for path in file_paths(tool):
        out[os.path.basename(path)] = hashlib.sha256(page_text(path).encode('utf-8')).hexdigest()
    return out


def refuse_input_out(out, inputs):
    """The independent review of v1.11: no command writes its --out over one of its inputs (refs --out ledger.json
    replaced the ledger; reconcile --out plan.json the plan), however the path is spelt or linked."""
    for p in inputs:
        if p and out and same_file(out, p):
            raise SystemExit('--out %s is %s, one of the inputs: nothing is ever written over an input. Nothing written' % (out, p))


def emit(text, out):
    if out:
        with open(out, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(text + '\n')
    else:
        sys.stdout.write(text + '\n')


if __name__ == '__main__':
    for stream in (sys.stdout, sys.stderr):   # UTF-8 with LF on every platform (review of v1.01, N7), messages too
        try:
            stream.reconfigure(encoding='utf-8', newline='\n')
        except (AttributeError, ValueError):
            pass
    a = sys.argv[1:]
    out = None
    if '--out' in a:
        i = a.index('--out')
        out = a[i + 1]
        a = a[:i] + a[i + 2:]
    if out and a[:1] != ['record']:   # record checks its own inputs, by name (R1)
        # every file the command reads: the files it names, and for a package folder its page files (and the install manifest,
        # which install and the policy facts read)
        ins = [x for x in a[1:] if os.path.isfile(x)]
        for x in a[1:]:
            if os.path.isdir(x):
                ins += file_paths(x)
        refuse_input_out(out, ins + ([MANIFEST] if a[:1] == ['install'] else []))
    part_bytes = PART_BYTES
    if '--part-bytes' in a:
        i = a.index('--part-bytes')
        part_bytes = int(a[i + 1])
        a = a[:i] + a[i + 2:]
    if a[:1] == ['load'] and len(a) == 3:
        cmds = load_cmds(a[1], a[2], part_bytes)
        if len(cmds) == 1:
            emit(cmds[0], out)
        elif out:
            for i in range(len(cmds)):
                refuse_input_out('%s.%d' % (out, i + 1), [a[2]])
            for i, c in enumerate(cmds):
                emit(c, '%s.%d' % (out, i + 1))
            sys.stderr.write('%d parts: %s.1 ... %s.%d; send each in its own call, in any order; the last answers loaded\n' % (len(cmds), out, out, len(cmds)))
        else:
            for i, c in enumerate(cmds):
                emit('// ---- part %d of %d: send this line alone ----' % (i + 1, len(cmds)), None)
                emit(c, None)
    elif a[:1] == ['refs'] and len(a) == 2:
        emit(refs_cmd(a[1]), out)
    elif a[:1] == ['install'] and len(a) == 2:
        emit(wrapped(a[1])[0], out)
    elif a[:1] == ['fingerprint'] and len(a) == 2:
        emit(json.dumps(fingerprint(a[1]), indent=1), out)
    elif a[:1] == ['manifest'] and len(a) == 2:
        emit(json.dumps(fresh_manifest(a[1]), indent=1), out)
    elif a[:1] == ['sha'] and len(a) == 2:
        emit(sha_of(a[1]), out)
    elif a[:1] == ['sizes'] and len(a) >= 2:
        for p in a[1:]:
            cmds = load_cmds('r', p)
            emit('%-40s %8d bytes  %d part(s)' % (os.path.basename(p), sum(len(c.encode('utf-8')) for c in cmds), len(cmds)), None)
    elif a[:1] == ['ledger'] and len(a) >= 3:
        opts, rest, i = {}, [], 2
        while i < len(a):
            if a[i].startswith('--'):
                if i + 1 >= len(a):
                    raise SystemExit('%s needs a value' % a[i])
                opts[a[i]] = a[i + 1]
                i += 2
            else:
                rest.append(a[i])
                i += 1
        cmd = a[1]
        if cmd in LEDGER_OPTS:
            extra = sorted(set(opts) - LEDGER_OPTS[cmd])
            if extra:
                raise SystemExit('ledger %s does not take %s (it takes %s)' % (cmd, ', '.join(extra), ', '.join(sorted(LEDGER_OPTS[cmd])) or 'no option'))
        if '--date' in opts and not real_day(opts['--date']):
            raise SystemExit('--date is a calendar day, YYYY-MM-DD')
        if cmd == 'check' and len(rest) == 1:
            bad = ledger_problems(json.load(open(rest[0], encoding='utf-8')))
            emit('ok' if not bad else 'problems:\n  - ' + '\n  - '.join(bad), None)
            sys.exit(1 if bad else 0)
        elif cmd == 'add' and len(rest) == 2 and all(k in opts for k in ('--run', '--state')):
            emit(json.dumps(ledger_add(rest[0], rest[1], opts['--run'], opts.get('--plan'), opts['--state'], opts.get('--verify'),
                                       opts.get('--session'), opts.get('--date'), opts.get('--tags'), opts.get('--fields')), indent=1, ensure_ascii=False), None)
        elif cmd in ('supersede', 'delete', 'keep') and len(rest) == 3:
            emit(json.dumps(ledger_set(rest[0], rest[1], rest[2], cmd, opts.get('--date'), opts.get('--joe')), ensure_ascii=False), None)
        elif cmd in ('live-move', 'handed-over', 'switched-off') and len(rest) == 2:
            emit(json.dumps(ledger_set(rest[0], 'flows', rest[1], cmd, opts.get('--date'), joe=opts.get('--joe'), listeners=opts.get('--listeners')), ensure_ascii=False), None)
        elif cmd == 'put' and len(rest) == 3 and '--entry' in opts:
            emit(json.dumps(ledger_put(rest[0], rest[1], rest[2], opts['--entry'], opts.get('--date'), opts.get('--joe')), ensure_ascii=False), None)
        elif cmd == 'edited' and len(rest) == 2 and '--change' in opts:
            emit(json.dumps(ledger_edited(rest[0], rest[1], opts['--change'], opts.get('--joe'), opts.get('--date'), opts.get('--run'), opts.get('--snapshot')), ensure_ascii=False), None)
        elif cmd == 'made-ids' and len(rest) == 2 and '--run' in opts:
            got, unkeyed = made_ids(rest[0], rest[1], opts['--run'], opts.get('--tags'), opts.get('--fields'))
            emit(json.dumps(got, indent=1, ensure_ascii=False), out)
            if unkeyed:
                sys.stderr.write('not keyed (made, but not by a name the plan gives, or without an ID): Joe looks for each by name, and '
                                 'ledger put records what he finds:\n' + json.dumps(unkeyed, ensure_ascii=False) + '\n')
        else:
            raise SystemExit(__doc__)
    elif a[:1] == ['record'] and len(a) >= 3:
        opts, rest, i = {}, [], 1
        while i < len(a):
            if a[i].startswith('--'):
                if a[i] not in RECORD_OPTS:
                    raise SystemExit('record does not take %s (it takes %s and --out)' % (a[i], ', '.join(sorted(RECORD_OPTS))))
                if i + 1 >= len(a):
                    raise SystemExit('%s needs a value' % a[i])
                opts[a[i]] = a[i + 1]
                i += 2
            else:
                rest.append(a[i])
                i += 1
        if len(rest) != 2 or '--run' not in opts:
            raise SystemExit('record <ledger.json> <ids.json> --run <name> [--plan <plan.json>] [--session <label>] [--date YYYY-MM-DD] '
                             '[--tags tags.json] [--fields fields.json] --out <refs call file>')
        if '--date' in opts and not real_day(opts['--date']):
            raise SystemExit('--date is a calendar day, YYYY-MM-DD')
        emit(json.dumps(record(rest[0], rest[1], opts['--run'], out, opts.get('--plan'), opts.get('--session'), opts.get('--date'),
                               opts.get('--tags'), opts.get('--fields')), indent=1, ensure_ascii=False), None)
    elif a[:1] == ['reconcile'] and len(a) >= 2:
        rest, opts = [], {}
        i = 2
        while i < len(a):
            if a[i] in ('--tags', '--fields'):
                if i + 1 >= len(a) or a[i + 1].startswith('--'):
                    raise SystemExit('%s needs a file: the session\'s first read (%s.json)' % (a[i], a[i][2:]))
                opts[a[i]] = a[i + 1]
                i += 2
            elif a[i].startswith('--'):
                raise SystemExit('reconcile takes a ledger, plans, --tags <file> and --fields <file>; not %s' % a[i])
            else:
                rest.append(a[i])
                i += 1
        emit(reconcile_cmd(a[1], rest, opts.get('--tags'), opts.get('--fields')), out)
    else:
        raise SystemExit(__doc__)
