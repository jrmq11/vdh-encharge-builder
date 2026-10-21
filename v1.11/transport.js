delete window.VDHSit;
delete window.VDHTransport;
(window.__vdhOrder = window.__vdhOrder || []).push("transport.js");
(window.__vdhSrc = window.__vdhSrc || {})["transport.js"] = function () {
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

    async function receive(text, sha) {
      const got = await hash(String(text));
      if (got !== sha) return { mismatch: true, got: got, chars: String(text).length };
      try { return { got: got, value: JSON.parse(text) }; } catch (e) { return { why: 'not JSON: ' + e.message }; }
    }

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

};
window.__vdhSrc["transport.js"]();
"installed transport.js: " + typeof window.VDHTransport
