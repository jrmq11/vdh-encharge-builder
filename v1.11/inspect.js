delete window.VDHSit;
delete window.VDHInspect;
(window.__vdhOrder = window.__vdhOrder || []).push("inspect.js");
(window.__vdhSrc = window.__vdhSrc || {})["inspect.js"] = function () {
(function (root) {
  'use strict';

  const VERSION = 'v1.11';
  const EMSP = String.fromCharCode(0x2003), ZWSP = String.fromCharCode(0x200b);
  function fold(s) { return String(s).split('&emsp;').join(EMSP).split('&#8203;').join(ZWSP); }

  function makeInspect(deps) {
    const G = deps.guard, R = deps.runner, V = deps.verify, sha256 = deps.sha256, need = deps.need, listAll = deps.listAll;

    function codepoints(s) {
      return Array.from(String(s)).filter(ch => ch.codePointAt(0) > 126 || ch === '+')
        .map(ch => ch + ' U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
    }

    function names(name) {
      const r = need(name), p = r.plan, rb = r.out.refs['readback:' + p.flow] || {};
      return {
        sent: p.name, stored: rb.name, apiName: rb.apiName, status: rb.status,
        nameKept: rb.name === p.name, apiNameKept: rb.apiName === p.name,
        sentChars: codepoints(p.name), storedChars: codepoints(rb.name), apiNameChars: codepoints(rb.apiName)
      };
    }

    function flags(name) {
      const r = need(name), p = r.plan, o = r.out;
      const rb = o.refs['readback:' + p.flow] || {};
      const byId = new Map((rb.steps || []).map(s => [Number(s.id), s]));
      return p.calls.filter(c => c.do === 'configure-step').map(c => {
        const created = p.calls.find(x => x.do === 'create-step' && x.step === c.step);
        const stored = byId.get(Number(o.refs['step:' + p.flow + '/' + c.step]));
        const storedFlags = stored && stored.data && stored.data.editor ? stored.data.editor.mustConfig : undefined;
        return {
          step: c.step, op: c.body.data.operationKey,
          createdWith: created ? created.body.data.editor.mustConfig : undefined,
          configuredWith: c.body.data.editor.mustConfig,
          stored: storedFlags,
          storedEqualsConfigure: R.canon(storedFlags) === R.canon(c.body.data.editor.mustConfig)
        };
      });
    }

    async function emailCheck(name, key) {
      const r = need(name), o = r.out;
      const id = o.refs['email:' + key];
      const want = ((r.plan.expect || {}).emails || []).find(e => e.key === key);
      if (!id || !want) return { ok: false, problem: 'no email ' + key + ' in run ' + name };
      const got = await G.call('GET', '/v1/emails/' + id);
      if (!got.ok) return { ok: false, status: got.status };
      const e = got.json.email || got.json;
      const master = o.refs['master:' + key];
      const checks = {
        name: e.name === want.name, subject: e.subject === want.subject, archived: e.archived,
        swaps: want.swaps.map(sw => {
          const old = master ? R.getPath(master.editor.state, sw.path) : null;
          const stored = R.getPath(e.editor.state, sw.path);
          return {
            path: sw.path,
            designHasNew: stored === sw.html,
            designHasNewFolded: typeof stored === 'string' && fold(stored) === fold(sw.html),
            htmlHasNew: R.occurrences(e.html, R.htmlText(sw.html)) === 1,
            htmlHasNewFolded: R.occurrences(fold(e.html), fold(R.htmlText(sw.html))) === 1,
            htmlLostOld: typeof old === 'string' ? R.occurrences(fold(e.html), fold(old)) === 0 && R.occurrences(fold(e.html), fold(R.htmlText(old))) === 0 : null
          };
        })
      };
      if (master) {
        const sent = R.resolve({ $emailFromMaster: { from: 'm', name: want.name, subject: want.subject, swaps: want.swaps } }, { m: master });
        const firstDiff = (a, b) => { a = String(a); b = String(b); let i = 0; while (i < a.length && a[i] === b[i]) i++; return i === a.length && i === b.length ? null : { at: i, stored: a.slice(Math.max(0, i - 30), i + 30), sent: b.slice(Math.max(0, i - 30), i + 30) }; };
        const firstPath = (a, b, path) => {
          if (R.canon(a) === R.canon(b)) return null;
          if (a && b && typeof a === 'object' && typeof b === 'object') {
            const keys = Array.from(new Set(Object.keys(a).concat(Object.keys(b)))).sort();
            for (const k of keys) { const p = firstPath(a[k], b[k], path + (Array.isArray(a) ? '[' + k + ']' : '.' + k)); if (p) return p; }
          }
          return path || '(root)';
        };
        checks.exact = { html: e.html === sent.html, design: R.canon(e.editor && e.editor.state) === R.canon(sent.editor && sent.editor.state) };
        if (!checks.exact.html) checks.exact.htmlFirstDiff = firstDiff(e.html, sent.html);
        if (!checks.exact.design) checks.exact.designFirstDiff = firstPath(e.editor && e.editor.state, sent.editor && sent.editor.state, 'state');
        if (!checks.exact.html || !checks.exact.design) {
          checks.exact.foldedOnly = fold(e.html) === fold(sent.html) && fold(R.canon(e.editor && e.editor.state)) === fold(R.canon(sent.editor && sent.editor.state));
        }
      }
      const ok = checks.name && checks.subject && checks.swaps.every(s => s.designHasNewFolded && s.htmlHasNewFolded && s.htmlLostOld !== false);
      return { ok: ok, emailId: id, checks: checks };
    }

    async function masterCheck(emailId, paths) {
      const got = await G.call('GET', '/v1/emails/' + Number(emailId));
      if (!got.ok) return { ok: false, status: got.status };
      const e = got.json.email || got.json;
      const rows = paths.map(p => {
        const t = R.getPath(e.editor && e.editor.state, p);
        if (typeof t !== 'string') return { path: p, hasText: false, inHtml: null, asEditorWrites: null, placeable: false };
        let placeable = true;
        try { R.locateInHtml(e.html, t); } catch (err) { placeable = false; }
        return { path: p, hasText: true, inHtml: R.occurrences(e.html, t), asEditorWrites: R.occurrences(e.html, R.htmlText(t)), placeable: placeable };
      });
      return { ok: rows.every(r => r.placeable), emailId: Number(emailId), name: e.name, paths: rows };
    }

    async function fields() {
      const got = await G.call('GET', '/v1/schemas');
      if (!got.ok) return { ok: false, status: got.status };
      const objs = (got.json && got.json.objects) || [];
      const person = objs.find(o => o && o.name === 'person');
      if (!person || !Array.isArray(person.fields)) return { ok: false, keys: Object.keys(got.json || {}) };
      const list = person.fields.map(f => {
        const o = { name: f.name };
        ['type', 'format', 'firstClassField', 'createdBy', 'readOnly'].forEach(k => { if (f[k] !== undefined) o[k] = f[k]; });
        return o;
      });
      return { ok: true, fields: list, sha: await sha256(JSON.stringify(list)) };
    }

    async function tags() {
      const tg = await listAll('/v1/tags-management', 'tags');
      if (!tg.ok) return tg;
      const list = tg.list.map(t => t && t.tag).filter(t => typeof t === 'string').sort();
      return { ok: true, tags: list, sha: await sha256(JSON.stringify(list)), how: tg.how };
    }

    async function pagePeople(segmentId, opts, onPerson) {
      opts = opts || {};
      const limit = opts.limit || 100, maxPages = opts.maxPages || 50, seen = new Set();
      let offset = 0, pages = 0, firstPage = null;
      const numbers = {};
      const base = () => ({ segmentId: Number(segmentId), pages: pages, limit: limit, firstPage: firstPage });
      while (true) {
        if (pages >= maxPages) return Object.assign({ ok: false, why: 'page cap reached', partial: seen.size }, base());
        const res = await G.call('GET', '/v1/segments/' + Number(segmentId) + '/people?limit=' + limit + '&offset=' + offset);
        if (!res.ok) return { ok: false, status: res.status, refused: res.refused || undefined };
        const j = res.json;
        const list = Array.isArray(j) ? j : (j && Array.isArray(j.people) ? j.people : (j && Array.isArray(j.items) ? j.items : null));
        if (!list) return { ok: false, status: res.status, keys: j && typeof j === 'object' ? Object.keys(j) : typeof j };
        if (j && !Array.isArray(j)) Object.keys(j).forEach(k => { if (typeof j[k] === 'number') numbers[k] = j[k]; });
        pages++;
        if (firstPage === null) firstPage = list.length;
        if (!list.length) break;
        const before = seen.size;
        for (let i = 0; i < list.length; i++) {
          const person = list[i];
          const key = person && (person.id !== undefined ? 'id:' + person.id : (person.email !== undefined ? 'e:' + person.email : 'row:' + (offset + i)));
          if (!seen.has(key)) { seen.add(key); if (onPerson) await onPerson(person); }
        }
        if (seen.size === before) return Object.assign({ ok: false, why: 'a page added nobody new: the offset looks ignored', partial: seen.size }, base());
        offset += list.length;
      }
      return Object.assign({ ok: true, count: seen.size, numbers: numbers }, base());
    }

    async function countPeople(segmentId, opts) { return pagePeople(segmentId, opts); }

    async function matchPeople(segmentId, want, opts) {
      const pairs = (want && want.pairs) || [];
      const byE = new Map(), byI = new Map();
      pairs.forEach((p, n) => { byE.set(p.e, n); byI.set(p.i, n); });
      const found = new Map();
      let unexpected = 0, noKey = 0, byId = 0;
      const paging = await pagePeople(segmentId, opts, async person => {
        let n;
        if (person && typeof person.email === 'string' && person.email.trim()) n = byE.get(await sha256(person.email.trim().toLowerCase()));
        else if (person && person.id !== undefined && person.id !== null) { n = byI.get(await sha256(String(person.id).trim())); byId++; }
        else { noKey++; return; }
        if (n === undefined) unexpected++; else found.set(n, (found.get(n) || 0) + 1);
      });
      const twice = [...found.values()].filter(c => c > 1).length;
      return { ok: paging.ok === true && pairs.length > 0 && found.size === pairs.length && unexpected === 0 && noKey === 0 && twice === 0,
        segmentId: Number(segmentId), paging: paging.ok === true ? 'ok' : (paging.why || 'failed'),
        expected: pairs.length, found: found.size, missing: pairs.length - found.size, unexpected: unexpected,
        foundTwice: twice, matchedById: byId, withoutEmailOrId: noKey };
    }

    async function previewNumbers(segmentId) {
      const got = await G.call('GET', '/v1/segments/' + Number(segmentId) + '/preview');
      if (!got.ok) return { ok: false, status: got.status };
      const j = got.json || {}, numbers = {};
      Object.keys(j).forEach(k => {
        if (typeof j[k] === 'number') numbers[k] = j[k];
        else if (j[k] && typeof j[k] === 'object' && !Array.isArray(j[k])) {
          Object.keys(j[k]).forEach(k2 => { if (typeof j[k][k2] === 'number') numbers[k + '.' + k2] = j[k][k2]; });
        }
      });
      return { ok: true, segmentId: Number(segmentId), numbers: numbers, keys: Object.keys(j) };
    }

    async function tagCounts(tags) {
      const got = await G.call('GET', '/v1/tags-management/counts');
      if (!got.ok) return { ok: false, status: got.status };
      const list = (got.json && got.json.tagCounts) || [];
      const out = {};
      tags.forEach(t => { const hit = list.find(x => x && x.tag === t); out[t] = hit ? hit.count : 0; });
      return { ok: true, counts: out };
    }

    async function listeners(flowId) {
      const got = await G.call('GET', '/v1/integrations/' + Number(flowId));
      if (!got.ok) return { ok: false, status: got.status, refused: got.refused || undefined };
      const flow = (got.json && got.json.integration) || got.json || null;
      return Object.assign({ name: flow && flow.name }, V.checkListeners(flow));
    }

    async function b7() {
      const before = G.log().length;
      const r = await G.call('DELETE', '/v1/segments/1');
      const entry = G.log()[before];
      return { refused: r.refused === true, reason: r.reason, status: r.status, logged: entry, sent: !!(entry && entry.status !== undefined) };
    }

    function guardSelfTest() {
      const cond = { type: 'group', operator: 'or', conditions: [{ type: 'tag', condition: 'has', value: 'zz_x' }] };
      const cases = [
        ['DELETE', '/v1/segments/1', undefined, false],
        ['GET', '/v1/integrations/310308/share-token', undefined, false],
        ['GET', '/v1/accounts', undefined, false],
        ['GET', '/v1/people/all', undefined, false],
        ['POST', '/v1/broadcasts/1/send', {}, false],
        ['PATCH', '/v1/integrations/310308', { id: 310308, name: 'x', status: 'deactivated', data: {} }, false],
        ['PATCH', '/v1/segments/1257090', { id: 1257090, conditions: cond }, false],
        ['PATCH', '/v1/segments/1059368', { id: 1059368, conditions: cond }, false],
        ['POST', '/v1/steps/', { integrationId: 310308, serviceId: 'encharge', data: {} }, false],
        ['PATCH', '/v1/steps/1382208', { integrationId: 310308, serviceId: 'encharge', data: {} }, false],
        ['POST', '/v1/links/', { source: 1382208, target: 1382218 }, false],
        ['PATCH', '/v1/emails/373117', { id: 373117 }, false],
        ['POST', '/v1/tags-management', { tags: [{ tag: 'product_canva_hacks_library' }] }, false],
        ['PATCH', '/v1/tags-management/abandoned_active', { tag: 'x' }, false],
        ['POST', '/v1/integrations/', { name: 'x', status: 'on' }, false],
        ['PATCH', '/v1/folders/0051d41e-0605-4170-a917-2af72a0c2bef', { childrenIds: [] }, false],
        ['GET', '/v1/segments', undefined, true],
        ['GET', '/v1/integrations/404885', undefined, true],
        ['GET', '/v1/x/../accounts', undefined, false],
        ['GET', '/v1/accounts#', undefined, false],
        ['GET', '/v1/Accounts', undefined, false],
        ['GET', '/v1/x/%2e%2e/people/all', undefined, false],
        ['POST', '/v1/segments/', { id: 1257090, name: 'x', color: '#00805e', objectName: 'person' }, false],
        ['POST', '/v1/schemas/person/fields', [{ name: 'first_channel', type: 'string', createdBy: 'user' }], false],
        ['POST', '/v1/tags-management', { tags: [{ tag: ' product_x' }] }, false],
        ['POST', '/v1/integrations/', { name: 'x' }, true],
        ['POST', '/v1/tags-management', { tags: [{ tag: 'zz_x' }] }, true],
        ['GET', '/v1/segments/1257212/people?limit=100&offset=0', undefined, true]
      ];
      const results = cases.map(c => ({ method: c[0], path: c[1], allowed: c[3], got: G.check(c[0], c[1], c[2]).ok }));
      const bad = results.filter(x => x.got !== x.allowed);
      return { ok: bad.length === 0, cases: results.length, refusedAsExpected: results.filter(x => !x.allowed && !x.got).length, bad: bad };
    }

    return { names: names, flags: flags, emailCheck: emailCheck, masterCheck: masterCheck, fields: fields, tags: tags,
      countPeople: countPeople, matchPeople: matchPeople, previewNumbers: previewNumbers, tagCounts: tagCounts,
      listeners: listeners, b7: b7, guardSelfTest: guardSelfTest };
  }

  const VDHInspect = { version: VERSION, make: makeInspect, fold: fold };
  if (typeof module !== 'undefined' && module.exports) module.exports = VDHInspect;
  else root.VDHInspect = VDHInspect;
})(typeof window !== 'undefined' ? window : globalThis);

};
window.__vdhSrc["inspect.js"]();
"installed inspect.js: " + typeof window.VDHInspect
