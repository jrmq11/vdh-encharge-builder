/*
 * verify.js -- vdh-encharge-builder
 *
 * Checks a built flow against its plan, value by value (api-map section 8): each step's type, every value it holds
 * against the configure call that was sent (the plan's values, and the defaults that came with the schema), its
 * editor flags, the links (source, target, conditions), the listener ids the flow's state calls for, the notes, the
 * re-entry settings both ways, and that the flow is still off. Encharge strips schema decoration when it stores a
 * step, so whole-schema comparison is never used.
 * Listener ids: Encharge registers a link's email-event listener when the flow is switched on, not when the link is
 * saved (proven 2026-09-26 on ZZ R1 Bounce, 405472; api-map section 7.4). So a flow never switched on (status
 * "deactivated") has none, and a flow that is on has one on every link that listens.
 * Also checks an objects plan after a build: new fields against a fresh read of the account's fields, new tags
 * against Encharge's answer to their create call, new segments row for row, edited segments for the rows added and
 * removed, and each new email against the body sent and against the master it was made from, re-derived here
 * (live test B4: Encharge stores an email exactly as sent).
 *
 *   VDHVerify.verifyFlow(plan.expect, runOutput.refs, readback)   -> {ok, problems}
 *   VDHVerify.verifyObjects(plan.expect, runOutput.refs)          -> {ok, problems}   (an objects plan)
 *   VDHVerify.verifySegments(plan.expect, runOutput.refs)         -> {ok, problems}   (its segments only)
 *   VDHVerify.verifyEmails(plan.expect, runOutput.refs)           -> {ok, problems}   (its emails only)
 *   VDHVerify.verifyFields / verifyTags(plan.expect, runOutput.refs) -> {ok, problems}  (its new fields, its new tags)
 *   VDHVerify.verifySegment(expectSegment, refs, readbackSegment) -> {ok, problems}
 *   VDHVerify.checkListeners(flow)                                -> {ok, problems, listening, withListener, without}
 *                                                                    (after Joe switches a flow on; ids and counts only)
 *
 * In the page it uses window.VDHRunner; in Node it requires ./runner.js. The same code checks a Make Flow
 * Reader read (pass the flow from enc-flows-all as the read-back).
 */
(function (root) {
  'use strict';
  const R = (typeof module !== 'undefined' && module.exports) ? require('./runner.js') : root.VDHRunner;

  function valuesOf(schema) {
    const out = {};
    (function walk(props, prefix) {
      Object.keys(props || {}).forEach(k => {
        const v = props[k];
        if (v && typeof v === 'object') {
          if (Object.prototype.hasOwnProperty.call(v, 'value')) out[prefix + k] = v.value;
          if (v.properties) walk(v.properties, prefix + k + '.');
        }
      });
    })((schema || {}).properties, '');
    return out;
  }

  function same(a, b) { return canon(a) === canon(b); }
  function canon(x) {
    if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
    if (x && typeof x === 'object') return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
    return JSON.stringify(x);
  }
  function linkData(d) {
    if (!d) return null;
    const c = JSON.parse(JSON.stringify(d));
    delete c.eventListenerIds;          // Encharge adds these when the flow is switched on; judged on their own below
    return c;
  }
  // The listener ids a flow's state calls for, link by link (proven 2026-09-26, api-map section 7.4). An email link is
  // one out of a Send email step, or one whose condition is an email event (email-...), whatever its own data says;
  // it must ask Encharge to listen (registerEventListener true). It has no ids while its flow has never been on
  // (status "deactivated"), and at least one, each a positive whole number, while the flow is on. A flow switched off
  // after being on ("deactivated-user") keeps the ids it had, and a link made while it was off has none, so a read of
  // it cannot say which to expect: not judged. name(id) labels a step. Returns problem strings.
  const listens = l => !!(l && l.data && l.data.registerEventListener === true);
  const idsOf = l => (l && l.data && Array.isArray(l.data.eventListenerIds) ? l.data.eventListenerIds : []);
  const hasListener = l => idsOf(l).length > 0 && idsOf(l).every(x => Number.isInteger(x) && x > 0);
  function emailLinks(flow) {
    const sends = new Set((flow.steps || []).filter(st => st && st.data && st.data.operationKey === '/send').map(st => Number(st.id)));
    return (flow.links || []).filter(l => l && (sends.has(Number(l.source)) || listens(l) ||
      ((l.data && l.data.conditions) || []).some(c => c && /^email-/.test(String(c.condition)))));
  }
  function listenerProblems(flow, name) {
    const out = [];
    emailLinks(flow).forEach(l => {
      const where = 'link ' + name(l.source) + ' -> ' + name(l.target);
      if (!listens(l)) out.push(where + ' waits for an email event but does not ask Encharge to listen (registerEventListener is not true)');
      if (flow.status === 'on' && !hasListener(l)) out.push(where + ' has no event listener id, and the flow is on: Encharge would not move anyone on at it');
      if (flow.status === 'deactivated' && idsOf(l).length) out.push(where + ' has listener ids though the flow was never switched on (not seen before 2026-09-26: Encharge registered them at switch-on)');
    });
    return out;
  }
  // Re-entry: both settings, both ways; a setting absent, null or false is off.
  const REENTRY_KEYS = ['canEnterOnce', 'canEnterOncePerPeriod'];
  const offIfEmpty = v => (v === undefined || v === null || v === false ? null : v);

  function verifyFlow(expect, refs, readback, opts) {
    opts = opts || {};
    const problems = [];
    if (!readback) return { ok: false, problems: ['no read-back'] };
    const wantStatus = opts.status === undefined ? expect.status : opts.status;
    if (wantStatus && readback.status !== wantStatus) problems.push('status is "' + readback.status + '", expected "' + wantStatus + '"');
    if (readback.name !== expect.name && !opts.ignoreName) problems.push('name is "' + readback.name + '", expected "' + expect.name + '"');
    Object.keys(expect.data || {}).concat(REENTRY_KEYS.filter(k => !Object.prototype.hasOwnProperty.call(expect.data || {}, k))).forEach(k => {
      const got = (readback.data || {})[k], want = (expect.data || {})[k];
      if (!same(offIfEmpty(got), offIfEmpty(want))) problems.push('setting ' + k + ' is ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want === undefined ? 'off' : want));
    });
    const byId = new Map((readback.steps || []).map(s => [Number(s.id), s]));
    const keyOf = {};
    const keys = Object.keys(expect.steps);
    keys.forEach(key => {
      const want = expect.steps[key];
      const id = Number(refs['step:' + expect.flow + '/' + key]);
      keyOf[id] = key;
      const got = byId.get(id);
      if (!got) { problems.push('step ' + key + ' (' + id + ') is missing'); return; }
      if (got.data.operationKey !== want.op) problems.push('step ' + key + ' is ' + got.data.operationKey + ', expected ' + want.op);
      // The flags the configure call sent are the ones Encharge keeps (live test B5); plans before v0.4 carry none.
      if (want.mustConfig !== undefined) {
        const flags = got.data.editor ? got.data.editor.mustConfig : undefined;
        if (!same(flags, want.mustConfig)) problems.push('step ' + key + ': editor flags are ' + JSON.stringify(flags) + ', expected ' + JSON.stringify(want.mustConfig));
      }
      const have = valuesOf(got.data.inputFields);
      const wantVals = R.resolve(want.values, refs);
      const cmp = (p, a, b) => {
        if (p === 'conditions' && typeof a === 'string' && typeof b === 'string') { try { a = JSON.parse(a); b = JSON.parse(b); } catch (e) { /* compare as text */ } }
        return same(a, b);
      };
      Object.keys(wantVals).forEach(p => {
        if (!cmp(p, have[p], wantVals[p])) problems.push('step ' + key + ': ' + p + ' is ' + JSON.stringify(have[p]) + ', expected ' + JSON.stringify(wantVals[p]));
      });
      // Every other value, the schema's defaults included, as the configure call sent it (plans since v0.4 keep it):
      // a setting the plan leaves at its default (the duplicate-send switch off, a Wait's days) must stay so.
      const sentBody = want.sent ? refs[want.sent] : undefined;
      if (want.sent && !sentBody) problems.push('step ' + key + ': no record of the configure call sent');
      if (sentBody) {
        const sentVals = valuesOf(sentBody.data && sentBody.data.inputFields);
        Array.from(new Set(Object.keys(sentVals).concat(Object.keys(have)))).forEach(p => {
          if (Object.prototype.hasOwnProperty.call(wantVals, p)) return;
          if (!cmp(p, have[p], sentVals[p])) problems.push('step ' + key + ': ' + p + ' is ' + JSON.stringify(have[p]) + ', sent ' + JSON.stringify(sentVals[p]));
        });
      }
    });
    if ((readback.steps || []).length !== keys.length) problems.push('the flow has ' + (readback.steps || []).length + ' steps, expected ' + keys.length);
    // The listener ids the flow's state calls for: none on a draft never switched on, one on every listening link once
    // it is on (Encharge registers them at switch-on; see listenerProblems).
    listenerProblems(readback, id => keyOf[Number(id)] || id).forEach(p => problems.push(p));
    const gotLinks = (readback.links || []).map(l => canon([keyOf[Number(l.source)] || l.source, keyOf[Number(l.target)] || l.target, linkData(l.data)])).sort();
    const wantLinks = (expect.links || []).map(l => canon([l.source, l.target, linkData(l.data)])).sort();
    if (canon(gotLinks) !== canon(wantLinks)) problems.push('links differ: got ' + gotLinks.length + ', expected ' + wantLinks.length + ' (' + gotLinks.filter(x => wantLinks.indexOf(x) === -1).join(' ; ') + ')');
    const gotNotes = (readback.decorations || []).map(d => canon([d.type, d.text])).sort();
    const wantNotes = (expect.notes || []).map(d => canon([d.type, d.text])).sort();
    if (canon(gotNotes) !== canon(wantNotes)) problems.push('notes differ');
    return { ok: problems.length === 0, problems: problems };
  }

  function stripUuids(cond) {
    return JSON.parse(JSON.stringify(cond), (k, v) => (k === 'uuid' ? undefined : v));
  }

  function verifySegment(expect, refs, readback) {
    const problems = [];
    if (!readback) return { ok: false, problems: ['no read-back'] };
    if (readback.name !== expect.name) problems.push('name is "' + readback.name + '"');
    if (expect.objectName !== undefined && readback.objectName !== expect.objectName) problems.push('objectName is ' + JSON.stringify(readback.objectName));
    if (expect.color !== undefined && readback.color !== expect.color) problems.push('color is ' + JSON.stringify(readback.color));
    const want = R.resolve(expect.conditions, refs);
    if (!same(stripUuids(readback.conditions), stripUuids(want))) problems.push('rows differ');
    return { ok: problems.length === 0, problems: problems };
  }

  // An edited existing segment: every added row is there, every removed row is gone, and the whole segment, operator
  // and every row, is what was sent (refs[expect.sent], recorded by the runner), apart from row ids and key order.
  function verifySegmentEdit(expect, refs, readback) {
    const problems = [];
    if (!readback) return { ok: false, problems: ['no read-back'] };
    const g = readback.conditions || {};
    const rows = g.conditions || [];
    if (rows.some(r => r.type === 'group')) problems.push('the segment now has a nested group');
    const have = rows.map(R.rowSig);
    R.resolve(expect.addRows || [], refs).forEach(r => {
      if (have.indexOf(R.rowSig(r)) === -1) problems.push('added row missing: ' + R.rowSig(r));
    });
    R.resolve(expect.removeRows || [], refs).forEach(r => {
      if (have.indexOf(R.rowSig(r)) !== -1) problems.push('removed row still there: ' + R.rowSig(r));
    });
    const sent = expect.sent ? refs[expect.sent] : undefined;
    if (g.type !== 'group') problems.push('the conditions are not a group');
    if (!sent || !sent.conditions) {
      problems.push('no record of the body sent');
    } else {
      if (readback.name !== sent.name) problems.push('name is "' + readback.name + '", sent "' + sent.name + '"');
      if (g.operator !== sent.conditions.operator) problems.push('operator is "' + g.operator + '", sent "' + sent.conditions.operator + '"');
      const want = sent.conditions.conditions.map(R.rowSig).sort();
      if (R.canon(have.slice().sort()) !== R.canon(want)) problems.push('rows differ from the body sent: ' + rows.length + ' read, ' + want.length + ' sent');
    }
    return { ok: problems.length === 0, problems: problems };
  }

  // Every segment an objects plan created or edited, against the plan's closing read-back (refs['readback:segments']).
  function verifySegments(expect, refs) {
    if (!(expect.segments || []).length && !(expect.segmentEdits || []).length) return { ok: true, problems: [], note: 'no segments in this plan' };
    const list = refs['readback:segments'];
    if (!Array.isArray(list)) return { ok: false, problems: ['no read-back of the segments'] };
    const byId = new Map(list.map(s => [Number(s.id), s]));
    const problems = [];
    (expect.segments || []).forEach(sg => {
      const got = byId.get(Number(refs['segment:' + sg.key]));
      verifySegment(sg, refs, got).problems.forEach(p => problems.push('segment ' + sg.key + ': ' + p));
    });
    (expect.segmentEdits || []).forEach(ed => {
      const got = byId.get(Number(ed.segment));
      verifySegmentEdit(ed, refs, got).problems.forEach(p => problems.push('segment ' + ed.segment + ': ' + p));
    });
    return { ok: problems.length === 0, problems: problems };
  }

  // The email the master and the swaps should give, derived here from the master as it was read in the run, without
  // the runner's code: each old text must sit in the master's HTML exactly once in all, as written or as the editor
  // writes it (a non-breaking space as &nbsp;), and is replaced there; the design takes the new text.
  const NBSP = String.fromCharCode(160);
  const asEditorWrites = s => String(s).split(NBSP).join('&nbsp;');
  const count = (hay, needle) => (needle ? String(hay).split(needle).length - 1 : 0);
  function expectedEmail(master, swaps) {
    let html = String(master.html);
    const state = JSON.parse(JSON.stringify(master.editor && master.editor.state));
    for (const sw of swaps || []) {
      const old = R.getPath(state, sw.path);
      if (typeof old !== 'string' || !old) return { problem: 'the master has no text at ' + sw.path };
      const forms = [old].concat(asEditorWrites(old) === old ? [] : [asEditorWrites(old)]);
      const hits = forms.map(f => count(html, f));
      if (hits.reduce((a, b) => a + b, 0) !== 1) return { problem: 'the master\'s text at ' + sw.path + ' is in its HTML ' + hits.join(' + ') + ' times, not once' };
      const f = forms[hits.indexOf(1)], at = html.indexOf(f);
      html = html.slice(0, at) + asEditorWrites(sw.html) + html.slice(at + f.length);
      R.setPath(state, sw.path, sw.html);
    }
    return { html: html, state: state };
  }

  // Every email an objects plan created, read back after its create call (refs['readback:email:<key>']): every key
  // sent (name, subject, sender, category, compliance, template flags...) as sent, not archived, the HTML and the design
  // exactly as sent, and both equal to what the master and the swaps give. The list thumbnail (previewImage) is the
  // master's and is not compared (api-map section 5).
  function verifyEmails(expect, refs) {
    const problems = [];
    (expect.emails || []).forEach(e => {
      const p = m => problems.push('email ' + e.key + ': ' + m);
      const got = refs['readback:email:' + e.key];
      const sent = e.sent ? refs[e.sent] : undefined;
      if (!got) { p('no read-back'); return; }
      if (!sent) { p('no record of the body sent'); return; }
      if (got.name !== e.name) p('name is ' + JSON.stringify(got.name));
      if (got.subject !== e.subject) p('subject is ' + JSON.stringify(got.subject));
      if (got.archived !== false) p('archived is ' + JSON.stringify(got.archived));
      Object.keys(sent).filter(k => ['html', 'editor', 'previewImage'].indexOf(k) === -1).forEach(k => {
        if (!same(got[k], sent[k])) p(k + ' is ' + JSON.stringify(got[k]) + ', sent ' + JSON.stringify(sent[k]));
      });
      if (got.html !== sent.html) p('the stored HTML differs from the HTML sent');
      const gs = got.editor && got.editor.state, ss = sent.editor && sent.editor.state;
      if (gs === undefined || !same(gs, ss)) p('the stored design differs from the design sent');
      if (!got.editor || got.editor.type !== (sent.editor && sent.editor.type)) p('the editor type differs from the one sent');
      const master = refs['master:' + e.key];
      if (!master) { p('no record of the master it was made from'); return; }
      const want = expectedEmail(master, e.swaps);
      if (want.problem) { p(want.problem); return; }
      if (got.html !== want.html) p('the stored HTML is not the master\'s with the swaps made in place');
      if (!same(gs, want.state)) p('the stored design is not the master\'s with the swaps made');
      (e.swaps || []).forEach(sw => {
        if (R.getPath(gs, sw.path) !== sw.html) p('the design at ' + sw.path + ' does not hold the new text');
      });
    });
    return { ok: problems.length === 0, problems: problems };
  }

  // New fields, against a fresh read of the account's fields made after they were created (refs['readback:schemas']):
  // each is there, a user's field, text or a date as asked.
  function verifyFields(expect, refs) {
    const want = expect.fields || [], reused = expect.fieldsReused || [];
    if (!want.length && !reused.length) return { ok: true, problems: [] };
    const objs = refs['readback:schemas'];
    const person = Array.isArray(objs) ? objs.find(o => o && o.name === 'person') : null;
    if (!person || !Array.isArray(person.fields)) return { ok: false, problems: ['no read-back of the account\'s fields'] };
    const problems = [];
    want.forEach(w => {
      const f = person.fields.filter(x => x && x.name === w.name);
      if (f.length !== 1) { problems.push('field ' + w.name + ' is listed ' + f.length + ' times'); return; }
      const isDate = f[0].format === 'date-time';
      if (f[0].type !== 'string' || isDate !== (w.type === 'date')) problems.push('field ' + w.name + ' is stored as ' + JSON.stringify({ type: f[0].type, format: f[0].format }) + ', asked for ' + w.type);
      if (f[0].createdBy !== 'user') problems.push('field ' + w.name + ' is not a user\'s field (createdBy ' + JSON.stringify(f[0].createdBy) + ')');
      ['readOnly', 'firstClassField'].forEach(k => { if (f[0][k] !== false) problems.push('field ' + w.name + ': ' + k + ' is ' + JSON.stringify(f[0][k]) + ', sent false'); });
    });
    // v1.01 (review of v1.00, 3): a field the manifest lists that the account already held is used as it is, so it is
    // checked too: still there once, of the manifest's type, and writable
    reused.forEach(w => {
      const f = person.fields.filter(x => x && x.name === w.name);
      if (f.length !== 1) { problems.push('field ' + w.name + ' (already in the account) is listed ' + f.length + ' times'); return; }
      const isDate = f[0].format === 'date-time';
      if (f[0].type !== 'string' || isDate !== (w.type === 'date')) problems.push('field ' + w.name + ' (already in the account) is ' + JSON.stringify({ type: f[0].type, format: f[0].format }) + ', the manifest says ' + w.type);
      if (f[0].readOnly) problems.push('field ' + w.name + ' (already in the account) is read-only');
    });
    return { ok: problems.length === 0, problems: problems };
  }

  // New tags, against Encharge's answer to each create call (refs['created:tag:<name>'], the list it says it made).
  // The account's tag list is not re-read here; after the run, VDHSit.tags() must list every tag, old and new.
  function verifyTags(expect, refs) {
    const problems = [];
    (expect.tags || []).forEach(t => {
      const said = refs['created:tag:' + t];
      if (!Array.isArray(said)) problems.push('tag ' + t + ': no record of Encharge\'s answer to its create call');
      else if (said.filter(x => x && x.tag === t).length !== 1) problems.push('tag ' + t + ': Encharge\'s answer names ' + JSON.stringify(said.map(x => x && x.tag)));
    });
    return { ok: problems.length === 0, problems: problems };
  }

  // An objects plan: its fields, tags, segments and emails.
  function verifyObjects(expect, refs) {
    const parts = [verifyFields(expect, refs), verifyTags(expect, refs), verifySegments(expect, refs), verifyEmails(expect, refs)];
    return { ok: parts.every(x => x.ok), problems: [].concat(...parts.map(x => x.problems)) };
  }

  // After Joe switches a flow on (v1.00): the flow as read now is on, and every link that listens for an email event
  // has its listener id. flow = a GET /v1/integrations/{id} read (VDHSit.listeners) or a Flow Reader read. Ids and
  // counts only. ok is false when no link listens: there is nothing to check.
  function checkListeners(flow) {
    if (!flow) return { ok: false, problems: ['no read of the flow'] };
    const all = emailLinks(flow);
    const problems = [];
    if (flow.status !== 'on') problems.push('the flow is "' + flow.status + '", not on: Encharge registers listeners when a flow is switched on');
    if (!all.length) problems.push('no link in this flow waits for an email event: nothing to check');
    listenerProblems(flow, id => id).filter(p => flow.status === 'on' || !/has no event listener id/.test(p)).forEach(p => problems.push(p));
    return { ok: problems.length === 0, problems: problems, flowId: flow.id, status: flow.status, listening: all.length,
      withListener: all.filter(hasListener).length,
      without: all.filter(l => !hasListener(l) || !listens(l)).map(l => ({ link: l.id, source: l.source, target: l.target,
        conditions: ((l.data && l.data.conditions) || []).map(c => c && c.condition) })) };
  }

  const api = { verifyFlow: verifyFlow, verifySegment: verifySegment, verifySegmentEdit: verifySegmentEdit,
    verifySegments: verifySegments, verifyEmails: verifyEmails, verifyFields: verifyFields, verifyTags: verifyTags,
    verifyObjects: verifyObjects, expectedEmail: expectedEmail, valuesOf: valuesOf, checkListeners: checkListeners };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VDHVerify = api;
})(typeof window !== 'undefined' ? window : globalThis);
