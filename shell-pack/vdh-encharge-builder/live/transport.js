/*
 * transport.js -- how text reaches vdh-encharge-builder's page helper (v1.10, P20: moved out of sitting.js as it stood in
 * v1.09): a plan as JSON text with its SHA-256 (VDHSit.load), the same in n parts (VDHSit.loadPart, v1.02: each part at
 * most 24,000 bytes, under the largest single call proven live, gap A21), and the one argument of reconcile and setRefs
 * as JSON text with its SHA-256 (v1.07, P2).
 *
 * It hashes, joins and parses, and says what it found; it never decides whether a plan may run or holds a run's state:
 * what a loaded plan is checked for, and where it is kept, are sitting.js's (the session controller). A plan's parts wait
 * here until the last arrives. Made with the hash it uses (sha256, below, by default).
 *
 * Installed after storage.js and before inspect.js; sitting.js refuses to start without it, or with one of another
 * version. Works in the page (window.VDHTransport) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  const VERSION = 'v1.11';

  async function sha256(text) {
    if (root.crypto && root.crypto.subtle && typeof TextEncoder !== 'undefined') {
      const buf = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    return require('crypto').createHash('sha256').update(text, 'utf8').digest('hex');
  }

  function makeTransport(deps) {
    const hash = (deps && deps.sha256) || sha256;

    // A plan's text, as VDHSit.load takes it: hashed first, parsed only if the hash matches. Answers {mismatch, got, chars},
    // {why}, or {got, value}; sitting.js words its answer from these, as v1.09's load did.
    async function receive(text, sha) {
      const got = await hash(String(text));
      if (got !== sha) return { mismatch: true, got: got, chars: String(text).length };
      try { return { got: got, value: JSON.parse(text) }; } catch (e) { return { why: 'not JSON: ' + e.message }; }
    }

    // A plan in n parts, one call each (v1.02; review of v1.01, N5): each part is kept until all n have come, under this
    // name and hash; a part sent again replaces its copy; a new n or hash starts over. Until the last, answers {have,
    // missing}; then the parts joined, in order, as {whole}, which sitting.js loads through VDHSit.load, by its hash.
    const parts = {};
    function part(name, i, n, text, sha) {
      let p = parts[name];
      if (!p || p.n !== n || p.sha !== sha) p = parts[name] = { n: n, sha: sha, got: {} };
      p.got[i] = text;
      const have = Object.keys(p.got).length;
      if (have < n) {
        const missing = [];
        for (let k = 1; k <= n && missing.length < 10; k++) if (!Object.prototype.hasOwnProperty.call(p.got, k)) missing.push(k);
        return { have: have, missing: missing };
      }
      let whole = '';
      for (let k = 1; k <= n; k++) whole += p.got[k];
      delete parts[name];
      return { whole: whole };
    }

    // v1.07 (P2; the master template test, 2026-09-28: a pasted reconcile that had lost one tag name still answered ok).
    // reconcile and setRefs take their one argument as load takes a plan: JSON text, then its SHA-256, both as pagecmd.py
    // writes them. The page hashes the text it received and refuses a mismatch before it reads, sends or changes
    // anything; only then does it parse it. An object literal is refused: the tool transport turns a typed backslash-u
    // escape into its character, so an object's text cannot be hashed as it was typed (runbook 2.2).
    async function argIn(text, sha) {
      if (typeof text !== 'string' || typeof sha !== 'string') return { ok: false, why: 'send the call pagecmd.py writes: the argument as JSON text, then its SHA-256' };
      const got = await hash(text);
      if (got !== sha) return { ok: false, why: 'the argument changed on the way: nothing was read, sent or changed; send the call again as pagecmd.py wrote it', expected: sha, got: got, chars: text.length };
      try { return { arg: JSON.parse(text) }; } catch (e) { return { ok: false, why: 'not JSON: ' + e.message }; }
    }

    return { receive: receive, part: part, argIn: argIn };
  }

  const VDHTransport = { version: VERSION, sha256: sha256, make: makeTransport };
  if (typeof module !== 'undefined' && module.exports) module.exports = VDHTransport;
  else root.VDHTransport = VDHTransport;
})(typeof window !== 'undefined' ? window : globalThis);
