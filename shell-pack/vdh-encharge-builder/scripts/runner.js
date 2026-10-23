/*
 * runner.js -- vdh-encharge-builder
 *
 * Runs a plan (compile.py's output) in the Encharge page, one call at a time, through guard.js.
 * It fills in refs from Encharge's own responses and from the ledger, does what the app does when a step is
 * configured (take the schema Encharge returned on creation, set the values, send it back), and stops at the
 * first refusal, error or unexpected status, or at a call that gets no answer at all (recorded as sent: Encharge may
 * have acted on it). It never deletes and never retries: a failed flow is rebuilt whole.
 * A call with method LOCAL is a check made in the page, and sends nothing. An objects plan that edits existing
 * segments has two: one before its first write, and one just before its first edit, which simulates every edit in
 * full. So no live segment is changed unless every edit can be made. Each edit's own read is kept under
 * out.refs['segments:before:<id>'] (v1.01): the segment as it was just before its edit, for VDHSit.segmentsBefore.
 * A read may require a state (v1.02, D1): a call with requireStatusIn (the switch-over's first calls) stops the run,
 * nothing more sent, unless Encharge's answer holds the flow's status and it is one of those listed (switched off).
 * A refusal by the guard, or by the page (a run that no longer holds its marker, v1.01), sends nothing. Before its
 * first call it checks that every ref it needs is in the seed or made by an earlier call, and (v1.01) that no ref the
 * seed gives is an Encharge ID the ledger marks deleted or failed (plan.deadIds); either stops it with nothing sent.
 *
 *   const out = await VDHRunner.runPlan(VDHGuard, plan, { refs: seedFromLedger });
 *   out.ok, out.failedAt, out.error, out.results, VDHRunner.ids(out.refs)
 *
 * Works in the page (window.VDHRunner) and in Node for the offline tests.
 */
(function (root) {
  'use strict';

  const TOKEN = /@@([a-z]+:[^@]+)@@/g;

  function copy(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }

  // "a.b[1].c" -> ['a', 'b', 1, 'c']
  function parts(path) {
    const out = [];
    String(path).split('.').forEach(seg => {
      const m = seg.match(/^([^\[]*)((?:\[\d+\])*)$/);
      if (!m) throw new Error('bad path ' + path);
      if (m[1]) out.push(m[1]);
      (m[2].match(/\d+/g) || []).forEach(i => out.push(Number(i)));
    });
    return out;
  }
  function getPath(obj, path) { return parts(path).reduce((o, k) => (o == null ? undefined : o[k]), obj); }
  function setPath(obj, path, value) {
    const ps = parts(path);
    let o = obj;
    for (let i = 0; i < ps.length - 1; i++) {
      if (o[ps[i]] == null) throw new Error('no ' + ps.slice(0, i + 1).join('.') + ' in ' + path);
      o = o[ps[i]];
    }
    o[ps[ps.length - 1]] = value;
  }

  function need(refs, key) {
    if (!Object.prototype.hasOwnProperty.call(refs, key)) throw new Error('unresolved ref ' + key);
    return refs[key];
  }

  function resolveString(s, refs) { return s.replace(TOKEN, (m, key) => String(need(refs, key))); }

  // Set a value on a step schema the way the app does: schema.properties.a.properties.b.value = v
  function setValue(schema, dotted, value) {
    let node = schema;
    for (const p of dotted.split('.')) {
      if (!node.properties || !node.properties[p]) throw new Error('no setting "' + dotted + '" in the schema Encharge returned');
      node = node.properties[p];
    }
    node.value = value;
  }

  // How a design text is written in the email's HTML. Live test B4 (2026-09-25): the editor keeps a non-breaking
  // space as the character in the design and writes it as &nbsp; in the HTML. (Written as fromCharCode: these files
  // travel to the page as typed text, and the tool transport turns a backslash-u escape into the character itself.)
  const NBSP = String.fromCharCode(160);
  function htmlText(text) { return String(text).split(NBSP).join('&nbsp;'); }
  function occurrences(hay, needle) { return needle ? String(hay).split(needle).length - 1 : 0; }

  // Where a design text sits in the HTML: exactly once in all, as written and as the editor writes it counted
  // together. Anything else throws, so an email is never created from a guess (a text written plainly once, in a
  // comment say, and once more with &nbsp; in the block itself, would otherwise swap the wrong one).
  function locateInHtml(html, text, what) {
    const raw = occurrences(html, text);
    const enc = htmlText(text);
    const encoded = enc === text ? null : occurrences(html, enc);
    if (raw === 1 && !encoded) return text;
    if (raw === 0 && encoded === 1) return enc;
    throw new Error((what || 'the text') + ' appears ' + raw + ' times in the HTML as written' +
      (encoded === null ? '' : ' and ' + encoded + ' times as the editor writes it (&nbsp;)') + '; exactly once in all is needed');
  }

  function emailFromMaster(d, refs) {
    const master = need(refs, d.from);
    const e = copy(master);
    const out = {
      type: e.type, name: resolveString(d.name, refs), isStandalone: e.isStandalone, accountId: e.accountId,
      subject: resolveString(d.subject, refs), fromEmail: e.fromEmail, fromName: e.fromName, html: e.html,
      editor: e.editor, previewImage: e.previewImage, archived: false, canSpamCompliance: e.canSpamCompliance,
      communicationCategoryId: e.communicationCategoryId, isDefaultTemplate: false
    };
    for (const sw of d.swaps || []) {
      const oldText = getPath(out.editor.state, sw.path);
      if (typeof oldText !== 'string') throw new Error('the master has no text at ' + sw.path);
      const inHtml = locateInHtml(out.html, oldText, 'the master\'s text at ' + sw.path);
      setPath(out.editor.state, sw.path, sw.html);
      out.html = out.html.replace(inHtml, () => htmlText(sw.html));
    }
    return out;
  }

  function canon(x) {
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
    return JSON.stringify(x);
  }

  // What a row tests: the whole row without its uuid, keys in any order. "is empty" and "is not empty" carry no
  // real value (Encharge has stored "", 0 and no value at all for them), so the value is left out of theirs.
  function rowSig(r) {
    const c = copy(r);
    delete c.uuid;
    if (c.condition === 'is empty' || c.condition === 'is not empty') delete c.value;
    return canon(c);
  }

  function findSegment(list, id) {
    const found = list.find(s => Number(s.id) === id);
    if (!found) throw new Error('segment ' + id + ' not found; nothing sent');
    if (!found.conditions || found.conditions.type !== 'group' || !Array.isArray(found.conditions.conditions)) {
      throw new Error('segment ' + id + ' has no condition group; nothing sent');
    }
    return found;
  }

  // Each row to remove must match exactly one row of the segment.
  function matchOne(rows, r, id) {
    const hits = rows.map((x, i) => (rowSig(x) === rowSig(r) ? i : -1)).filter(i => i !== -1);
    if (hits.length !== 1) {
      throw new Error('segment ' + id + ' has ' + hits.length + ' rows matching ' + rowSig(r) + ' (removing one needs exactly one); nothing sent');
    }
    return hits[0];
  }

  // A path from segment `start` back to itself through segment rows (in or not in), or null.
  function findLoop(byId, start) {
    const rowsOf = id => (((byId.get(id) || {}).conditions || {}).conditions || []);
    const stack = [[start, [start]]];
    const seen = new Set();
    while (stack.length) {
      const [n, path] = stack.pop();
      for (const r of rowsOf(n)) {
        if (!r || r.type !== 'segment') continue;
        const m = Number(r.value);
        if (m === start) return path.concat([m]);
        if (!seen.has(m)) { seen.add(m); stack.push([m, path.concat([m])]); }
      }
    }
    return null;
  }

  // Checks made in the page before any segment is changed; nothing is sent. mode "early" (before the plan's first
  // write): each segment exists and is one flat group, each row to remove matches exactly one row, none is left
  // empty. mode "full" (just before the first edit, when the plan's new segments exist): every edit is simulated
  // in full against one read, and no edited segment may name itself through other segments' rows.
  function segmentCheck(d, refs) {
    const all = need(refs, d.from);
    const list = all.segments || all;
    const byId = new Map(list.map(s => [Number(s.id), s]));
    const edited = [];
    for (const ed of d.edits || []) {
      const id = Number(resolve(ed.id, refs));
      const found = findSegment(list, id);
      if (found.conditions.conditions.some(r => !r || r.type === 'group')) throw new Error('segment ' + id + ' is not one flat group; nothing sent');
      if (d.mode === 'early') {
        const rows = found.conditions.conditions.slice();
        for (const r of resolve(ed.remove || [], refs)) rows.splice(matchOne(rows, r, id), 1);
        if (!rows.length && !ed.adds) throw new Error('segment ' + id + ' would have no rows left; nothing sent');
      } else {
        byId.set(id, segmentEdit({ from: d.from, id: id, remove: ed.remove, add: ed.add }, refs));
        edited.push(id);
      }
    }
    for (const id of edited) {
      const loop = findLoop(byId, id);
      if (loop) throw new Error('segment ' + id + ' would name itself through segments ' + loop.join(' -> ') + '; nothing sent');
    }
    return true;
  }

  // An existing segment, as Encharge listed it, with rows removed and then rows added (existing rows are kept).
  function segmentEdit(d, refs) {
    const all = need(refs, d.from);
    const list = all.segments || all;
    const id = Number(resolve(d.id, refs));
    const found = findSegment(list, id);
    // Send exactly the fields the app sends (capture 2): a listed segment may carry others, e.g. autoSegment.
    const seg = {};
    ['id', 'name', 'accountId', 'version', 'color', 'objectName', 'conditions'].forEach(k => {
      if (found[k] !== undefined) seg[k] = copy(found[k]);
    });
    const rows = seg.conditions.conditions;
    for (const r of resolve(d.remove || [], refs)) rows.splice(matchOne(rows, r, id), 1);
    const have = new Set(rows.map(rowSig));
    for (const r of resolve(d.add || [], refs)) {
      if (!have.has(rowSig(r))) { rows.push(r); have.add(rowSig(r)); }
    }
    if (!rows.length) throw new Error('segment ' + id + ' would have no rows left; nothing sent');
    return seg;
  }

  // A fresh random UUID (v4), made when the call is sent: a note's own id, never reused by a rebuild of the same flow.
  function newUuid() {
    const c = root.crypto || (typeof require !== 'undefined' ? require('crypto').webcrypto : null);
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  function resolve(v, refs) {
    if (typeof v === 'string') return resolveString(v, refs);
    if (Array.isArray(v)) return v.map(x => resolve(x, refs));
    if (v && typeof v === 'object') {
      const keys = Object.keys(v);
      if (keys.length === 1 && keys[0] === '$ref') return copy(need(refs, v.$ref));
      if (keys.length === 1 && keys[0] === '$merge') {
        const schema = copy(need(refs, v.$merge.schema));
        const vals = resolve(v.$merge.values || {}, refs);
        Object.keys(vals).forEach(p => setValue(schema, p, vals[p]));
        return schema;
      }
      if (keys.length === 1 && keys[0] === '$uuid') return newUuid();
      if (keys.length === 1 && keys[0] === '$emailFromMaster') return emailFromMaster(v.$emailFromMaster, refs);
      if (keys.length === 1 && keys[0] === '$segmentEdit') return segmentEdit(v.$segmentEdit, refs);
      if (keys.length === 1 && keys[0] === '$segmentCheck') return segmentCheck(v.$segmentCheck, refs);
      if (keys.indexOf('$spread') !== -1) {
        const out = copy(need(refs, v.$spread));
        keys.filter(k => k !== '$spread').forEach(k => { out[k] = resolve(v[k], refs); });
        return out;
      }
      const out = {};
      keys.forEach(k => { out[k] = resolve(v[k], refs); });
      return out;
    }
    return v;
  }

  // Every ref a value will need when it is resolved: $ref, @@key@@ in any text, and the refs the $-forms read.
  function refsNeeded(v, out) {
    out = out || new Set();
    if (typeof v === 'string') { let m; const re = new RegExp(TOKEN.source, 'g'); while ((m = re.exec(v))) out.add(m[1]); }
    else if (Array.isArray(v)) v.forEach(x => refsNeeded(x, out));
    else if (v && typeof v === 'object') {
      Object.keys(v).forEach(k => {
        const x = v[k];
        if (k === '$ref' || k === '$spread') { if (typeof x === 'string') out.add(x); }
        else if (k === '$merge') { if (x && typeof x.schema === 'string') out.add(x.schema); refsNeeded(x && x.values, out); }
        else if (k === '$uuid') { /* made at send time; needs nothing */ }
        else if (k === '$emailFromMaster') {   // only these are resolved: the swaps' text goes in as written
          if (x && typeof x.from === 'string') out.add(x.from);
          refsNeeded([x && x.name, x && x.subject], out);
        } else if (k === '$segmentEdit' || k === '$segmentCheck') {
          if (x && typeof x.from === 'string') out.add(x.from);
          refsNeeded(Object.assign({}, x, { from: undefined }), out);
        } else refsNeeded(x, out);
      });
    }
    return out;
  }

  // Before the first call, nothing sent: every ref each call needs comes from the seed (the ledger) or from a call
  // before it. A ref nothing provides (a segment only in the manifest's later block, an email not built yet) would
  // otherwise stop the run half-way, after its first objects exist.
  function missingRefs(plan, seed) {
    const have = new Set(Object.keys(seed || {}));
    for (const c of plan.calls || []) {
      const need = refsNeeded(c.path);
      refsNeeded(c.body, need);
      const missing = [...need].filter(k => !have.has(k));
      if (missing.length) return { call: c, missing: missing };
      Object.keys(c.save || {}).forEach(k => have.add(k));
      if (c.saveBody) have.add(c.saveBody);
    }
    return null;
  }

  // Before the first call, nothing sent: a ref the seed gives (the page's refs, from the ledger) that is an Encharge ID
  // the ledger marks deleted or failed (plan.deadIds, from the compiler) means the page's refs are older than the
  // ledger: a rebuild's key would still name its old object (the fourth review of v1.01). A ref made by an earlier call
  // of the plan is its own, and is not judged.
  function deadRefs(plan, seed) {
    const dead = plan.deadIds || {};
    const have = new Set();
    for (const c of plan.calls || []) {
      const need = refsNeeded(c.path);
      refsNeeded(c.body, need);
      for (const k of need) {
        if (have.has(k) || !Object.prototype.hasOwnProperty.call(seed || {}, k)) continue;
        const list = dead[k.split(':')[0] + 's'];
        if (Array.isArray(list) && list.map(String).indexOf(String(seed[k])) !== -1) return { call: c, ref: k, id: seed[k] };
      }
      Object.keys(c.save || {}).forEach(k => have.add(k));
      if (c.saveBody) have.add(c.saveBody);
    }
    return null;
  }

  async function runPlan(guard, plan, opts) {
    opts = opts || {};
    const refs = Object.assign({}, opts.refs || {});
    const results = [];
    const fail = (c, error) => ({ ok: false, failedAt: c.n, do: c.do, step: c.step || c.key, error: error, refs: refs, results: results });
    const gap = missingRefs(plan, refs);
    if (gap) return fail(gap.call, 'plan: nothing provides ' + gap.missing.join(', ') + ' (not in the ledger, and no call before it makes it); nothing sent');
    const stale = deadRefs(plan, refs);
    if (stale) return fail(stale.call, 'plan: the page\'s refs give ' + stale.ref + ' as ' + stale.id + ', which the ledger marks deleted or failed: ' +
      'send python3 -B live/pagecmd.py refs ledger.json again; nothing sent');
    for (const c of plan.calls) {
      if (c.method === 'LOCAL') {           // a check made in the page; nothing is sent
        try { resolve(c.body, refs); } catch (e) { return fail(c, 'plan: ' + e.message); }
        results.push({ n: c.n, do: c.do, step: c.step || c.key, method: 'LOCAL', status: 'ok' });
        continue;
      }
      let path, body;
      try {
        path = resolveString(c.path, refs);
        body = c.body === undefined ? undefined : resolve(c.body, refs);
      } catch (e) { return fail(c, 'plan: ' + e.message); }
      let r;
      try {
        r = await guard.call(c.method, path, body);
      } catch (e) {
        // No answer came (the network dropped, or the answer was lost): Encharge may have acted on the call, so it
        // is recorded as sent, and the run stops here (v1.00; before, the whole run's record was lost with it).
        const why = String(e && e.message || e);
        results.push({ n: c.n, do: c.do, step: c.step || c.key, method: c.method, path: path, status: null, threw: why });
        return fail(c, 'threw: ' + why + ' (no answer came; Encharge may have acted on the call)');
      }
      results.push({ n: c.n, do: c.do, step: c.step || c.key, method: c.method, path: path, status: r.status, refused: r.refused || undefined });
      if (!r.ok) return fail(c, r.refused ? 'refused by ' + (r.by || 'the guard') + ': ' + r.reason : 'Encharge answered ' + r.status);
      if (c.saveBody) refs[c.saveBody] = copy(body);
      if (c.expectStatus && r.status !== c.expectStatus) return fail(c, 'expected ' + c.expectStatus + ', got ' + r.status);
      if (c.requireStatusIn !== undefined) {
        // v1.02 (D1): the switch-over's edit runs only while each flow its segment starts is switched off. Only the
        // statuses listed pass: an unknown word, another spelling or no status at all stops the run as surely as "on"
        // (the review of the fixes: "On", "active" or "" passed a check against the one word "on")
        const st = getPath(r.json, 'integration.status');
        const allowed = Array.isArray(c.requireStatusIn) ? c.requireStatusIn : [];
        if (typeof st !== 'string') return fail(c, (c.what || 'the flow') + ': Encharge\'s answer holds no status, so it cannot be shown to be off; nothing more sent');
        if (allowed.indexOf(st) === -1) return fail(c, (c.what || 'the flow') + ' is ' + JSON.stringify(st) + ', not switched off (' + allowed.join(' or ') + '): this plan runs only once Joe has switched it off; nothing more sent');
      }
      for (const ref of Object.keys(c.save || {})) {
        const v = getPath(r.json, c.save[ref]);
        if (v === undefined) return fail(c, 'the response had no ' + c.save[ref]);
        refs[ref] = v;
      }
      if (opts.delayMs) await new Promise(res => setTimeout(res, opts.delayMs));
    }
    return { ok: true, refs: refs, results: results };
  }

  // Only the IDs, for the ledger: drops schemas, read-backs, masters and segment objects.
  function ids(refs) {
    const out = {};
    Object.keys(refs || {}).forEach(k => {
      if (/^(flow|step|email|segment|position):/.test(k)) out[k] = refs[k];
    });
    return out;
  }

  const api = { runPlan: runPlan, missingRefs: missingRefs, deadRefs: deadRefs, resolve: resolve, resolveString: resolveString, getPath: getPath, setPath: setPath, ids: ids,
    rowSig: rowSig, canon: canon, htmlText: htmlText, occurrences: occurrences, locateInHtml: locateInHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VDHRunner = api;
})(typeof window !== 'undefined' ? window : globalThis);
