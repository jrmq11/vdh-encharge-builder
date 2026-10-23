/*
 * reconcile.js -- the reconciliation of vdh-encharge-builder's page helper (v1.10, P20: moved out of sitting.js as it stood
 * in v1.09, the code unchanged but for the names of what it is given): Encharge's lists read whole (listAll), compared
 * with the ledger, the run marker and the session's first reads (compare), and the recovery results a session acts on:
 * what a plan makes (planNames), what a failed run may have made (mayExist), and which emails Joe looks for by hand.
 *
 * It only reads, through the guard, and reports: whether a marker is cleared, and every other change of a run's state,
 * is sitting.js's (the session controller), which holds the builder's lock around it. Made with what it needs: the guard,
 * the fields read (inspect.js's), the policy facts (policy.js), and a reader of the ledger gate's records.
 *
 * Installed after inspect.js and before sitting.js; sitting.js refuses to start without it, or with one of another
 * version. Works in the page (window.VDHReconcile) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  const VERSION = 'v1.11';

  function makeReconcile(deps) {
    const G = deps.guard, fields = deps.fields, records = deps.records;
    const OFF = deps.policy.facts.offStatuses;   // the statuses of a flow switched off (api-map 7.5), as the switch-over's gate judges it

    // What a plan creates, by kind and display name (flows, segments, emails, tags, fields), for reconcile.
    function planNames(plan) {
      const out = { flows: [], segments: [], emails: [], tags: [], fields: [] };
      (plan.calls || []).forEach(c => {
        const b = c.body || {};
        if (c.do === 'create-flow' && typeof b.name === 'string') out.flows.push(b.name);
        if (c.do === 'create-segment' && typeof b.name === 'string') out.segments.push(b.name);
        if (c.do === 'create-email' && b.$emailFromMaster && typeof b.$emailFromMaster.name === 'string') out.emails.push(b.$emailFromMaster.name);
        if (c.do === 'create-tag') (b.tags || []).forEach(t => { if (t && typeof t.tag === 'string') out.tags.push(t.tag); });
        if (c.do === 'create-field' && Array.isArray(c.body)) c.body.forEach(f => { if (f && typeof f.name === 'string') out.fields.push(f.name); });
      });
      return out;
    }

    // Objects a failed run may have made without learning their ids: each create call that went out and either got no
    // answer, an error answer, or an answer without the id the plan saves. Flows, segments, tags and fields show up in
    // reconcile by name; an email has no list call, so Joe looks for it by name among Encharge's emails. Steps, links
    // and notes belong to their flow, which is failed and deleted whole.
    // An id counts as saved by this run only if the run's refs hold it and it is not just the ledger's own under that
    // key (a rebuild under a key the ledger holds). If the run itself threw, any create in the plan may have gone out.
    const KIND = { 'create-flow': 'flow', 'create-segment': 'segment', 'create-email': 'email', 'create-tag': 'tag', 'create-field': 'field' };
    function mayExist(plan, out, seed, all) {
      const list = [];
      const own = Object.prototype.hasOwnProperty;
      const add = c => {
        const one = planNames({ calls: [c] });
        [].concat(one.flows, one.segments, one.emails, one.tags, one.fields).forEach(n => list.push({ kind: KIND[c.do], name: n, call: c.n,
          find: KIND[c.do] === 'email' ? 'emails have no list call: Joe looks for "' + n + '" among Encharge\'s emails, by hand'
            : 'reconcile lists it by name' }));
      };
      if (all) { (plan.calls || []).filter(c => KIND[c.do]).forEach(add); return list; }
      (out.results || []).filter(x => !x.refused && x.method !== 'LOCAL').forEach(x => {
        const c = (plan.calls || []).find(k => k.n === x.n);
        if (!c || !KIND[c.do]) return;
        const answered = typeof x.status === 'number' && x.status >= 200 && x.status < 300;
        const saved = Object.keys(c.save || {}).every(k => out.refs && out.refs[k] !== undefined &&
          !(seed && own.call(seed, k) && String(seed[k]) === String(out.refs[k])));
        if (!(answered && saved)) add(c);
      });
      return list;
    }

    // Encharge's lists, read only. Probed 2026-09-26 through the guard: the flow list pages by limit and offset and
    // ends with an empty page; the segment and tag lists ignore both and give the whole list every time. A paged list is
    // read until an empty page; a page that adds nothing new, and the page cap, are failures. An unpaged list is read
    // once, and confirmed by a second read past its end that must give the same list again; if it does not, the list
    // pages after all and is read as a paged one. An answer without the list is a failure. Never a short list.
    const UNPAGED = { '/v1/segments': true, '/v1/tags-management': true };
    async function listAll(path, key) {
      const idOf = x => String(x && x.id !== undefined ? x.id : (x && x.tag !== undefined ? x.tag : x && x.name));
      const read = async offset => {
        const r = await G.call('GET', path + (path.indexOf('?') === -1 ? '?' : '&') + 'limit=100&offset=' + offset);
        if (!r.ok) return { ok: false, status: r.status };
        const j = r.json;
        const list = j && Array.isArray(j[key]) ? j[key] : (Array.isArray(j) ? j : null);
        if (!list) return { ok: false, why: 'the answer holds no ' + key + ' list', keys: j && typeof j === 'object' ? Object.keys(j).slice(0, 10) : typeof j };
        return { ok: true, list: list };
      };
      if (UNPAGED[path]) {
        const first = await read(0);
        if (!first.ok) return first;
        const again = await read(first.list.length);
        if (!again.ok) return again;
        if (again.list.length === first.list.length && again.list.every((x, i) => idOf(x) === idOf(first.list[i]))) {
          return { ok: true, list: first.list, how: 'unpaged: the whole list, given again past its end' };
        }
      }
      const out = [], seen = new Set();
      let offset = 0;
      for (let page = 0; page < 50; page++) {
        const p = await read(offset);
        if (!p.ok) return p;
        if (!p.list.length) return { ok: true, list: out, how: 'paged: ended with an empty page' };
        const before = seen.size;
        p.list.forEach(x => { const id = idOf(x); if (!seen.has(id)) { seen.add(id); out.push(x); } });
        if (seen.size === before) return { ok: false, why: 'a page added nothing new: the offset looks ignored, so the list may be incomplete', partial: out.length };
        offset += p.list.length;
      }
      return { ok: false, why: 'page cap reached (50 pages): the list may be incomplete', partial: out.length };
    }

    // After a failed or interrupted run, before any rebuild, and at the end of a sitting (v1.09's reconcileLocked, from
    // the marker on; the lock, the built-run and two-minute checks, and clearing the marker stay sitting.js's): every flow,
    // segment, tag and field Encharge lists that is the ledger's, a ZZ object, a plan's name, or the marked run's, with
    // what is missing, still there, or in doubt. d is the run marker, or null. Answers {out, names, objNames, made} for
    // sitting.js, which clears the marker only when out.resolved.
    async function compare(known, d) {
      const deleted = known.deleted && typeof known.deleted === 'object' ? known.deleted : {};
      const gone = k => new Set((Array.isArray(deleted[k]) ? deleted[k] : []).map(String));
      const goneFlows = gone('flows'), goneSegments = gone('segments'), goneTags = gone('tags'), goneFields = gone('fields');
      const left = (d && d.names) || {};
      const names = new Set([].concat(known.names || [], left.flows || [], left.segments || []).map(String));
      const objNames = new Set([].concat(known.names || [], left.tags || [], left.fields || []).map(String));
      const zzName = n => /ZZ/.test(String(n || ''));
      // matchedBy: "zz" for a test object; "name" for one listed only because its name is a plan's, which may be an
      // object that was there before (Joe checks it before it goes on any delete list)
      const flowBy = f => (zzName(f.name) || zzName(f.apiName) ? 'zz' : (names.has(String(f.name)) || names.has(String(f.apiName)) ? 'name' : null));
      const segBy = x => (zzName(x.name) ? 'zz' : (names.has(String(x.name)) ? 'name' : null));
      const objBy = n => (/^zz_/.test(n) ? 'zz' : (objNames.has(n) ? 'name' : null));
      const knownTags = new Set(known.tags.map(String)), knownFields = new Set(known.fields.map(String));
      const atStartTags = Array.isArray(known.tagsAtStart) ? new Set(known.tagsAtStart.map(String)) : null;
      const atStartFields = Array.isArray(known.fieldsAtStart) ? new Set(known.fieldsAtStart.map(String)) : null;
      // What the marked run made (each create Encharge answered, recorded in its marker as it went) must be in Encharge's
      // lists, or a list came back short (gap A19; the second review of v1.01): flows and segments by id (by name when the
      // answer held none), tags and fields by name. What it may have made (pending: the create in flight when it stopped,
      // or one answered 5xx; or one answered without its id) is settled once a list shows an object of that name that
      // nothing else accounts for: for a flow or a segment, not one the ledger knows or marks deleted (a rebuild's old
      // draft keeps its name) and not one the marker names (the fourth review). If none does, only Joe can say, by hand,
      // so it stays in doubt. Emails have no list call: one in doubt is always Joe's to find, by name.
      const made = d && Array.isArray(d.made) ? d.made : null;
      const pend = d && d.pending && Array.isArray(d.pending.names) ? d.pending : null;
      const doubt = kind => [].concat(pend && pend.kind === kind ? pend.names : [], (made || []).filter(m => m.kind === kind && m.id === null && kind !== 'tag' && kind !== 'field').map(m => m.name));
      // the names of the tags or fields the run made (with pending: or may have made); one the session's first read held
      // was there before the run, whatever Encharge's answer to a create listed (the sixth review)
      const byRun = (kind, mk, pd) => new Set([].concat((mk || []).filter(m => m.kind === kind).map(m => m.name), pd && pd.kind === kind ? pd.names : []));
      const notAtStart = (set, atStart) => new Set([...set].filter(n => !(atStart && atStart.has(n))));
      // v1.02: what verified runs made that the ledger does not hold yet (kind:id or kind:name), listed whatever its name
      const ulKeys = new Set();
      records().forEach(rec => Object.keys(rec.ids || {}).forEach(k => ulKeys.add(k.split(':')[0] + ':' + String(rec.ids[k]))));
      const out = {};
      const fl = await listAll('/v1/integrations', 'integrations');
      if (fl.ok) {
        const ids = new Set(fl.list.map(f => Number(f.id)));
        const madeFlowIds = new Set((made || []).filter(m => m.kind === 'flow' && m.id !== null).map(m => m.id));
        out.flows = fl.list.filter(f => flowBy(f) || madeFlowIds.has(Number(f.id)) || ulKeys.has('flow:' + f.id)).map(f => Object.assign({ id: f.id, name: f.name, status: f.status,
          matchedBy: flowBy(f) || (madeFlowIds.has(Number(f.id)) ? 'madeByRun' : 'verifiedRun'), known: known.flows.map(Number).indexOf(Number(f.id)) !== -1 }, madeFlowIds.has(Number(f.id)) ? { madeByRun: true } : {}));
        out.flowsMissingKnown = known.flows.filter(id => !ids.has(Number(id)));
        out.flowsStillThere = fl.list.filter(f => goneFlows.has(String(f.id))).map(f => f.id);
        if (made) out.flowsMadeMissing = made.filter(m => m.kind === 'flow' && m.id !== null && !ids.has(m.id) && !goneFlows.has(String(m.id))).map(m => m.id);
        const knownFlowIds = new Set(known.flows.map(Number));
        const flowNamedNew = n => fl.list.some(f => (String(f.name) === n || String(f.apiName) === n) && !knownFlowIds.has(Number(f.id)) &&
          !goneFlows.has(String(f.id)) && !madeFlowIds.has(Number(f.id)) && !ulKeys.has('flow:' + f.id));   // not a verified run's (v1.02)
        out.flowsInDoubt = doubt('flow').filter(n => !flowNamedNew(n));
        out.flowsListed = fl.list.length;
        // the delete list's flows Encharge lists as on (the third review of the fixes): never deleted as drafts; Joe
        // switches each off, or the ledger is wrong about it. Reported, for the end of a sitting; it clears no marker
        const failedFlows = new Set((Array.isArray(known.failedFlows) ? known.failedFlows : []).map(Number));
        // (not off: any status but the two Encharge gives a flow switched off, as the switch-over's gate judges it)
        out.failedOn = fl.list.filter(f => failedFlows.has(Number(f.id)) && OFF.indexOf(f.status) === -1)
          .map(f => ({ id: f.id, name: f.name, status: f.status }));
      } else out.flows = fl;
      const sg = await listAll('/v1/segments', 'segments');
      if (sg.ok) {
        const ids = new Set(sg.list.map(x => Number(x.id)));
        const madeSegIds = new Set((made || []).filter(m => m.kind === 'segment' && m.id !== null).map(m => m.id));
        out.segments = sg.list.filter(x => segBy(x) || madeSegIds.has(Number(x.id)) || ulKeys.has('segment:' + x.id)).map(x => Object.assign({ id: x.id, name: x.name,
          matchedBy: segBy(x) || (madeSegIds.has(Number(x.id)) ? 'madeByRun' : 'verifiedRun'), known: known.segments.map(Number).indexOf(Number(x.id)) !== -1 }, madeSegIds.has(Number(x.id)) ? { madeByRun: true } : {}));
        out.segmentsMissingKnown = known.segments.filter(id => !ids.has(Number(id)));
        out.segmentsStillThere = sg.list.filter(x => goneSegments.has(String(x.id))).map(x => x.id);
        if (made) out.segmentsMadeMissing = made.filter(m => m.kind === 'segment' && m.id !== null && !ids.has(m.id) && !goneSegments.has(String(m.id))).map(m => m.id);
        // A segment in doubt is always Joe's, as an email is: the segment list is not paged, so a list cut short (gap A19)
        // could hide the new one while an older one of its name, unknown to the ledger, shows (the fifth review)
        out.segmentsInDoubt = doubt('segment');
      } else out.segments = sg;
      const tg = await listAll('/v1/tags-management', 'tags');
      if (tg.ok) {
        const all = tg.list.map(t => t && t.tag).filter(t => typeof t === 'string'), have = new Set(all);
        const tagsMade = notAtStart(byRun('tag', made), atStartTags), tagsByRun = notAtStart(byRun('tag', made, pend), atStartTags);
        out.tags = all.filter(t => objBy(t) || tagsMade.has(t) || ulKeys.has('tag:' + t)).map(t => Object.assign({ name: t, matchedBy: objBy(t) || (tagsMade.has(t) ? 'madeByRun' : 'verifiedRun'), known: knownTags.has(t) },
          atStartTags ? { atStart: atStartTags.has(t) } : {}, tagsMade.has(t) ? { madeByRun: true } : {}));
        out.tagsMissingKnown = [...knownTags].filter(t => !have.has(t));
        // a tag the ledger marks deleted that this run made anew (or may have) is the run's, not the old one still there
        out.tagsStillThere = all.filter(t => goneTags.has(t) && !tagsByRun.has(t));
        if (made) out.tagsMadeMissing = made.filter(m => m.kind === 'tag' && !have.has(m.name) && !goneTags.has(m.name)).map(m => m.name);
        out.tagsInDoubt = doubt('tag').filter(t => !have.has(t));
        // the session's first read (pagecmd --tags): every tag it held must still be listed, unless the ledger marks it deleted
        if (atStartTags) out.tagsMissingAtStart = [...atStartTags].filter(t => !have.has(t) && !goneTags.has(t));
      } else out.tags = tg;
      const fd = await fields();
      if (fd.ok) {
        const all = fd.fields.map(f => f.name).filter(n => typeof n === 'string'), have = new Set(all);
        const fieldsMade = notAtStart(byRun('field', made), atStartFields), fieldsByRun = notAtStart(byRun('field', made, pend), atStartFields);
        out.fields = all.filter(n => objBy(n) || fieldsMade.has(n) || ulKeys.has('field:' + n)).map(n => Object.assign({ name: n, matchedBy: objBy(n) || (fieldsMade.has(n) ? 'madeByRun' : 'verifiedRun'), known: knownFields.has(n) },
          atStartFields ? { atStart: atStartFields.has(n) } : {}, fieldsMade.has(n) ? { madeByRun: true } : {}));
        out.fieldsMissingKnown = [...knownFields].filter(n => !have.has(n));
        out.fieldsStillThere = all.filter(n => goneFields.has(n) && !fieldsByRun.has(n));
        if (made) out.fieldsMadeMissing = made.filter(m => m.kind === 'field' && !have.has(m.name) && !goneFields.has(m.name)).map(m => m.name);
        out.fieldsInDoubt = doubt('field').filter(n => !have.has(n));
        if (atStartFields) out.fieldsMissingAtStart = [...atStartFields].filter(n => !have.has(n) && !goneFields.has(n));
      } else out.fields = fd;
      // v1.11 (P4; gap A17: emails have no list call): each email the ledger holds is read by its ID. One the ledger
      // holds live must be there and not archived (Encharge archives an email Joe deletes, and it still reads whole), or
      // it is missing (emailsMissingKnown; emailsArchived names those found archived): deleted by hand, so the ledger marks
      // it deleted once Joe confirms. One the ledger marks deleted must be archived or gone (404); one still live is in
      // emailsStillThere. Any other answer (a refusal, a 5xx, no answer) is in emailsUnread, and nothing is cleared.
      const goneEmails = gone('emails');
      out.emailsMissingKnown = []; out.emailsArchived = []; out.emailsStillThere = []; out.emailsUnread = [];
      const emailIds = (Array.isArray(known.emails) ? known.emails : []).map(Number).concat([...goneEmails].map(Number));
      for (const id of emailIds) {
        const r = await G.call('GET', '/v1/emails/' + id), isGone = goneEmails.has(String(id));
        const e = r && r.ok && r.json && r.json.email && typeof r.json.email === 'object' ? r.json.email : null;
        if (e) {
          if (!isGone && e.archived === true) { out.emailsMissingKnown.push(id); out.emailsArchived.push(id); }
          else if (isGone && e.archived !== true) out.emailsStillThere.push(id);
        } else if (r && r.status === 404) {
          if (!isGone) out.emailsMissingKnown.push(id);
        } else out.emailsUnread.push({ id: id, status: r && typeof r.status === 'number' ? r.status : null });
      }
      out.emailsRead = emailIds.length - out.emailsUnread.length;
      const lists = ['flows', 'segments', 'tags', 'fields'];
      // v1.02 (review of v1.01, N6): an object a verified run made, which the ledger does not hold yet, is that run's: it
      // carries verifiedRun, and goes into the ledger with that run (VDHSit.unledgered()), never on a delete list
      const ul = records();
      if (ul.length) {
        const byRun = {};
        ul.forEach(rec => Object.keys(rec.ids || {}).forEach(k => { byRun[k.split(':')[0] + ':' + String(rec.ids[k])] = rec.run; }));
        const mark = (list, kind, key) => { if (Array.isArray(list)) list.forEach(x => { const r = byRun[kind + ':' + String(x[key])]; if (r) x.verifiedRun = r; }); };
        mark(out.flows, 'flow', 'id'); mark(out.segments, 'segment', 'id'); mark(out.tags, 'tag', 'name'); mark(out.fields, 'field', 'name');
        out.unledgered = ul.map(rec => rec.run);
      }
      out.unknown = lists.reduce((a, k) => a + (Array.isArray(out[k]) ? out[k].filter(x => !x.known).length : 0), 0);
      // unknown objects matched by a plan's name only, which may have been there before; not those the run's marker says it made
      out.unknownByNameOnly = lists.reduce((a, k) => a + (Array.isArray(out[k]) ? out[k].filter(x => !x.known && x.matchedBy === 'name' && !x.madeByRun && !x.verifiedRun).length : 0), 0);
      out.listsRead = lists.every(k => Array.isArray(out[k])) && out.emailsUnread.length === 0;   // v1.11: every email read too
      out.listsHow = { flows: fl.how || null, segments: sg.how || null, tags: tg.how || null, fields: fd.ok ? 'one read of the schemas' : null };
      const count = suffix => lists.reduce((a, k) => a + (out[k + suffix] || []).length, 0);
      // (v1.11, P4: the emails read by ID count with the lists)
      const missing = count('MissingKnown') + out.emailsMissingKnown.length, still = count('StillThere') + out.emailsStillThere.length;
      const madeMissing = count('MadeMissing'), atStartMissing = count('MissingAtStart');
      out.emailsInDoubt = doubt('email');
      const inDoubt = count('InDoubt') + out.emailsInDoubt.length;
      if (made) {
        const n = kind => made.filter(m => m.kind === kind).length;
        out.madeByRun = { flows: n('flow'), segments: n('segment'), tags: n('tag'), fields: n('field'),
          emails: made.filter(m => m.kind === 'email' && m.id !== null).map(m => m.id) };
      }
      out.resolved = out.listsRead && missing === 0 && still === 0 && madeMissing === 0 && atStartMissing === 0 && inDoubt === 0;
      out.ok = out.resolved;
      if (!out.listsRead) {
        out.why = 'a list could not be read whole (' + lists.filter(k => !Array.isArray(out[k])).concat(out.emailsUnread.length ? ['emails ' +
          out.emailsUnread.map(x => x.id + ' (' + x.status + ')').join(', ')] : []).join(', ') + '; see each one\'s why): nothing is cleared. Find out why with Joe';
      } else if (!out.resolved) {
        out.why = (missing ? missing + ' object(s) the ledger knows are missing from Encharge\'s lists (the MissingKnown lists; an email read by its ID ' +
          'and found archived or gone, since v1.11: emailsMissingKnown, emailsArchived): deleted by hand, ' +
          'then the ledger marks each "state": "deleted", with the date, once Joe confirms it; or a list came back short (gap A19), which could hide ' +
          'what a run made. ' : '') + (madeMissing ? madeMissing + ' object(s) the marked run made, as its marker recorded them, are missing from the lists (the ' +
          'MadeMissing lists): a list came back short (gap A19), or Joe deleted them (the ledger then marks them deleted). ' : '') +
          (atStartMissing ? atStartMissing + ' tag(s) or field(s) of the session\'s first read are missing (the MissingAtStart lists): a list came ' +
          'back short, or they were deleted since. ' : '') + (still ? still + ' object(s) the ledger marks deleted are still listed (the StillThere ' +
          'lists): the ledger is wrong, or the deletion did not happen. ' : '') + (inDoubt ? inDoubt + ' object(s) the run may have made (a create ' +
          'with no answer, or no id) are not in the lists (the InDoubt lists; an email always, having no list call): Joe looks for each by name in ' +
          'Encharge, the ledger records what he finds, and then waiveReconcile with his words. ' : '') + 'Nothing is cleared until they agree';
      }
      return { out: out, names: names, objNames: objNames, made: made };
    }

    // With a marker: the run it names, its state, and the emails Joe looks for by name: those in doubt, and those a failed
    // run's summary named (mayExist); a marker without made (none since v1.01) names every email of its plan
    function markerFacts(out, d, made) {
      out.afterRun = d.run;
      out.markerState = d.state;
      const listed = made ? [] : (d.state === 'running' ? ((d.names && d.names.emails) || []) : []);
      out.emailsToFind = Array.from(new Set([].concat(listed, d.state === 'running' ? [] : (d.emailsToFind || []), out.emailsInDoubt)));
    }

    // What the answer lists, in words, for the session
    function listsOnly(out, names, objNames, made) {
      out.listsOnly = 'flows, segments, tags and fields named ZZ (zz_)' + (names.size || objNames.size ? ', or with one of the names given or in the marked run\'s plan (matchedBy "name")' : '') +
        (made ? '; those the marked run made, as its marker recorded Encharge\'s answers, carry madeByRun (its emails, by ID, are in madeByRun.emails)' : '') +
        '; emails have no list call' + (out.emailsToFind && out.emailsToFind.length ? ': Joe looks for the emails in emailsToFind by name' : '');
    }

    return { planNames: planNames, mayExist: mayExist, listAll: listAll, compare: compare, markerFacts: markerFacts, listsOnly: listsOnly };
  }

  const VDHReconcile = { version: VERSION, make: makeReconcile };
  if (typeof module !== 'undefined' && module.exports) module.exports = VDHReconcile;
  else root.VDHReconcile = VDHReconcile;
})(typeof window !== 'undefined' ? window : globalThis);
