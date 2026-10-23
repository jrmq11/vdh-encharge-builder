"""provenance.py -- vdh-encharge-builder's compiler (v1.10, P20: moved out of compile.py as it stood in v1.09, the code
unchanged): what a plan was made from: the compiler's version and every module's hash, the policy data, every input.

compile.py is the command line and keeps every command, option, message and exit code."""
import hashlib
import os
from .context import POLICY_FILES, load

VERSION = 'v1.11'   # v1.11: P21; v1.10: the compiler in modules (P20); v1.09 (P11): v1.08 changed no code and kept v1.07's
SCRIPTS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# v1.10 (P20): every file of the compiler, the command line first, so a plan's provenance hashes them all
COMPILER_FILES = ['compile.py'] + ['compiler/%s.py' % m for m in ('__init__', 'context', 'conditions', 'layout', 'flows', 'objects', 'provenance')]


def sha_file(path):
    with open(path, 'rb') as fh:
        return hashlib.sha256(fh.read()).hexdigest()


def compiler_files():
    """[{file, sha256}] for every compiler file (v1.10, P20), and one SHA-256 over them all: of the lines
    "<sha256>  <file>", in COMPILER_FILES' order, each ending in a newline (as sha256sum prints them)."""
    files = [{'file': f, 'sha256': sha_file(os.path.join(SCRIPTS, f))} for f in COMPILER_FILES]
    return files, hashlib.sha256(''.join('%s  %s\n' % (x['sha256'], x['file']) for x in files).encode('utf-8')).hexdigest()


def provenance(a, mode):
    """What a plan was made from (v1.02; review of v1.01, N9): the compiler's version and hash, and the SHA-256 of the
    catalogue and of each input file, by its base name. No clock time, so a plan stays byte-identical for the same inputs.
    v1.10 (P20): compilerSha256 covers every compiler module (compilerFiles lists each), not compile.py alone."""
    one = lambda p: {'file': os.path.basename(p), 'sha256': sha_file(p)} if p else None   # noqa: E731
    files, whole = compiler_files()
    out = {'compiler': 'vdh-encharge-builder %s' % VERSION, 'compilerSha256': whole, 'compilerFiles': files,
           'mode': mode, 'inputs': [one(p) for p in a.inputs],
           'catalogue': one(a.catalogue),
           # v1.10 (P20): the policy data the compiler read (guard.js's declarations, as generated; and data/policy.json)
           'policy': [one(p) for p in POLICY_FILES]}
    for k in ('ledger', 'permissions', 'fields', 'tags', 'tag_groups', 'manifest', 'new_fields'):
        v = one(getattr(a, k))
        if v:
            out[k.replace('_', '-')] = v
    flags = [f for f, on in (('--allow-parked', a.allow_parked), ('--offline-permissions', a.offline_permissions),
                             ('--switch-over', a.switch_over)) if on]
    if flags:
        out['options'] = flags
    for p in ([a.inputs[0]] if mode == 'objects' else []) + ([a.manifest] if a.manifest else []):
        man = load(p)
        if isinstance(man, dict) and isinstance(man.get('emailSet'), str):
            out['emailSet'] = man['emailSet']
            break
    return out
