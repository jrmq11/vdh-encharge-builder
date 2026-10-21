delete window.VDHSit;
(window.__vdhOrder = window.__vdhOrder || []).push("sitting.js");
(window.__vdhSrc = window.__vdhSrc || {})["sitting.js"] = function () {
(function (root) {
  'use strict';


  const VERSION = 'v1.11';
  const PAGE_FILES = ['guard.js', 'runner.js', 'verify.js', 'policy.js', 'storage.js', 'transport.js', 'inspect.js', 'reconcile.js', 'sitting.js'];
  const GUARD_SHA256 = '7e7cbddb001426f18fc7d7f80b735fde907e6b5724c0b48442326554f004c4df';
  const PAGE_OBJECTS = ['VDHGuard', 'VDHRunner', 'VDHVerify', 'VDHPolicy', 'VDHStore', 'VDHTransport', 'VDHInspect', 'VDHReconcile', 'VDHSit'];
  const HELPERS = [['policy.js', 'VDHPolicy', 'policy'], ['storage.js', 'VDHStore', 'store'], ['transport.js', 'VDHTransport', 'transport'],
    ['inspect.js', 'VDHInspect', 'inspect'], ['reconcile.js', 'VDHReconcile', 'reconcile']];
  function helper(deps, h) {
    const x = (deps && deps[h[2]]) || root[h[1]];
    if (!x || typeof x !== 'object') throw new Error(h[0] + ' is not installed: install the nine page files (' + PAGE_FILES.join(', ') + '), in that order, from one package');
    if (x.version !== VERSION) throw new Error(h[0] + ' is ' + x.version + ' and sitting.js is ' + VERSION + ': install all nine page files from one package');
    return x;
  }

  function makeSit(deps) {
    const G = deps.guard, R = deps.runner, V = deps.verify;
    const P = helper(deps, HELPERS[0]), S = helper(deps, HELPERS[1]), T = helper(deps, HELPERS[2]), I = helper(deps, HELPERS[3]), C = helper(deps, HELPERS[4]);
    const runs = {}, loaded = {}, pending = {}, errors = {}, lost = {}, unstored = {};
    const due = deps.due || S.dueStore();
    const ledgerGate = deps.unledgered || S.listStore();   // v1.02: verified runs the ledger does not hold yet
    const UNLEDGERED_KEY = S.UNLEDGERED_KEY;
    const sha256 = T.sha256;
    const transport = T.make({ sha256: sha256 });   // a plan's hash and parts; the hashed argument of reconcile and setRefs
    const loadedSha = {};   // the SHA-256 each loaded plan was checked against, for the run's record
    const now = deps.now || (() => Date.now());   // a clock the rehearsals can move
    const locks = deps.locks !== undefined ? deps.locks : ((root.navigator && root.navigator.locks) || null);
    const LOCK = 'vdh-encharge-builder';
    const SETTLE_MS = 120000;
    const insp = I.make({ guard: G, runner: R, verify: V, sha256: sha256, need: name => need(name), listAll: (p, k) => listAll(p, k) });
    const rc = C.make({ guard: G, fields: () => insp.fields(), policy: P, records: () => ledgerGate.get() });
    const planNames = rc.planNames, mayExist = rc.mayExist, listAll = rc.listAll;
    let inFlight = null;      // the run in progress in this page: one at a time
    let current = null;       // its marker
    let lastReconcile = null; // {run, at, owner, resolved} of this page's last reconcile of a marker, for waiveReconcile

    async function exclusive(what, fn) {
      if (!locks || typeof locks.request !== 'function') {
        return { held: false, why: 'this page has no Web Locks (navigator.locks), so ' + what + ' cannot be sure that no other copy of the builder is running in this browser: nothing starts' };
      }
      let got = false, out;
      await locks.request(LOCK, { ifAvailable: true }, async lock => {
        if (!lock) return;
        got = true;
        out = await fn();
      });
      return got ? { held: true, out: out } : { held: false, why: 'another copy of the builder holds its lock in this browser (a run, a reconcile or a waive, in another tab or in an install replaced mid-run, which may still wake up and send): wait until it ends; if it hangs, reload the tab it runs in, on Joe\'s go' };
    }

    function newOwner() {
      const c = root.crypto;
      if (c && typeof c.randomUUID === 'function') return c.randomUUID();
      return String(now()) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
    }

    function markerLost(mark) {
      const s = due.peek();
      if (s === undefined) return 'the page\'s storage cannot be read';
      if (s === null) return 'the run marker is gone from the page\'s storage (cleared by something else)';
      if (s.run !== mark.run || s.at !== mark.at || s.owner !== mark.owner) return 'the page\'s storage now holds another run\'s marker (' + s.run + ')';
      return null;
    }

    function errorText(j) {
      if (!j) return null;
      const m = (j.error && (j.error.message || j.error)) || j.message || j.errors || j;
      return (typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 300);
    }
    function createOf(method, path, body) {
      if (method !== 'POST') return null;
      const b = body || {};
      if (path === '/v1/integrations/') return { kind: 'flow', names: [String(b.name)] };
      if (path === '/v1/segments/' || path === '/v1/segments') return { kind: 'segment', names: [String(b.name)] };
      if (path === '/v1/emails') return { kind: 'email', names: [String(b.name)] };
      if (path === '/v1/tags-management') return { kind: 'tag', names: (b.tags || []).map(t => String(t && t.tag)) };
      if (path === '/v1/schemas/person/fields') return { kind: 'field', names: (Array.isArray(body) ? body : []).map(f => String(f && f.name)) };
      return null;
    }
    function madeFrom(c, json) {
      const j = json || {};
      const one = obj => [{ kind: c.kind, id: obj && Number.isFinite(Number(obj.id)) ? Number(obj.id) : null, name: c.names[0] }];
      if (c.kind === 'flow') return one(j.integration);
      if (c.kind === 'segment') return one(j.segment);
      if (c.kind === 'email') return one(j.email);
      const listed = c.kind === 'tag' ? (Array.isArray(j.tags) ? j.tags.map(t => t && t.tag) : null) : (Array.isArray(j.fields) ? j.fields.map(f => f && f.name) : null);
      return (listed || c.names).filter(n => typeof n === 'string').map(n => ({ kind: c.kind, name: n }));
    }
    function recording(name, mark) {
      return { call: async (method, path, body) => {
        const c = createOf(method, path, body);
        let why = markerLost(mark);
        if (!why) {
          mark.beat = now(); mark.pending = c;
          if (!due.set(mark)) { mark.pending = null; why = 'its heartbeat could not be stored'; }
        }
        if (why) {
          lost[name] = why;
          return { ok: false, refused: true, by: 'the page', reason: 'this run no longer holds its marker (' + why + '): stopped, nothing sent' };
        }
        const r = await G.call(method, path, body);   // a throw leaves pending set: that call may have been acted on
        if (!r.ok && !r.refused) errors[name] = { method: method, path: path, status: r.status, encharge: errorText(r.json) };
        const settled = r.refused === true || (typeof r.status === 'number' && !mayHaveActed(r.status));
        if (c && settled) {
          mark.pending = null;
          if (r.ok) mark.made = (mark.made || []).concat(madeFrom(c, r.json));
          if (!markerLost(mark) && !due.set(mark)) due.hold(mark);
        }
        return r;
      } };
    }
    const refs = Object.assign({}, deps.refs || {});   // flow:, email:, segment: IDs gathered so far (ledger + runs)

    function summary(name, out) {
      const results = out.results || [];
      const byStatus = {};
      results.forEach(r => { const k = r.refused ? 'refused' : (r.threw ? 'no answer' : String(r.status)); byStatus[k] = (byStatus[k] || 0) + 1; });
      const s = { run: name, ok: !!out.ok, calls: results.length, byStatus: byStatus };
      const d = due.get();
      const r = runs[name];
      const ours = !!(d && r && d.run === name && d.owner === r.owner);
      if (out.ok && ours && d.state === 'built') {
        s.state = 'built';
        s.next = 'VDHSit.verify(\'' + name + '\'): no run starts until it passes';
      }
      if (unstored[name]) {
        s.markerStored = false;
        s.next = 'the page\'s storage refused this run\'s end marker: this page holds it in memory only, and the storage still says running. ' +
          (out.ok ? 'VDHSit.verify(\'' + name + '\') now, before anything could reload the page; ' : 'Reconcile next; ') + 'free the storage before any other run';
      }
      if (!out.ok) {
        Object.assign(s, { failedAt: out.failedAt, do: out.do, step: out.step, error: out.error, encharge: errors[name] || null });
        const may = r ? mayExist(r.plan, out, r.seed, !!r.threw) : [];
        if (may.length) s.mayExist = may;
        if (lost[name]) s.lostMarker = lost[name];
        if (ours || lost[name]) s.next = 'reconcile before anything else: python3 -B live/pagecmd.py reconcile ledger.json <this plan>; no run starts until it has';
      }
      return s;
    }

    const NAME = /^[A-Za-z0-9_.-]{1,64}$/;
    async function load(name, text, sha) {
      if (typeof name !== 'string' || !NAME.test(name)) return { loaded: false, run: name, why: 'a run name is 1 to 64 letters, digits, _ . or -' };
      delete loaded[name];   // whatever happens next, an earlier plan under this name can no longer run
      const t = await transport.receive(text, sha);   // hashed, then parsed only if the hash matches (transport.js)
      if (t.mismatch) return { loaded: false, run: name, expected: sha, got: t.got, chars: t.chars };
      if (t.why) return { loaded: false, run: name, why: t.why };
      const got = t.got, plan = t.value;
      if (!plan || !Array.isArray(plan.calls)) return { loaded: false, run: name, why: 'not a plan (no calls)' };
      if (plan.dryRunOnly) return { loaded: false, run: name, why: 'a plan for a dry run only, never run: ' + String(plan.dryRunOnly).slice(0, 200) };
      if (plan.offlineOnly && !deps.allowOfflinePlans) return { loaded: false, run: name, why: 'a plan for the offline suites only (--offline-permissions), never run: ' + String(plan.offlineOnly).slice(0, 200) };
      const permWhy = planPermissionsWhy(plan);
      if (permWhy && !(plan.offlineOnly && deps.allowOfflinePlans)) return { loaded: false, run: name, why: permWhy };
      const planWhy = planShapeWhy(plan);
      if (planWhy) return { loaded: false, run: name, why: planWhy };
      loaded[name] = plan;
      loadedSha[name] = got;
      const used = ((plan.report || {}).permissionsUsed) || [];
      return { loaded: true, run: name, calls: plan.calls.length, sha: got, permissions: new Set(used.map(x => String(x && x.object) + ' ' + String(x && x.action))).size };
    }

    async function loadPart(name, i, n, text, sha) {
      if (typeof name !== 'string' || !NAME.test(name)) return { loaded: false, run: name, why: 'a run name is 1 to 64 letters, digits, _ . or -' };
      if (!Number.isInteger(i) || !Number.isInteger(n) || n < 1 || n > 500 || i < 1 || i > n || typeof text !== 'string' || typeof sha !== 'string') {
        return { loaded: false, run: name, why: 'a part is (name, i, n, text, sha), 1 <= i <= n <= 500' };
      }
      delete loaded[name];   // whatever happens next, an earlier plan under this name can no longer run
      const p = transport.part(name, i, n, text, sha);
      if (p.whole === undefined) return { loaded: false, run: name, part: i, of: n, have: p.have, missing: p.missing };
      const out = await load(name, p.whole, sha);
      return Object.assign({ parts: n }, out);
    }

    const RECONCILE_CALL = 'reconcile first (python3 -B live/pagecmd.py reconcile ledger.json <its plan>, then send that call); no run starts until it has';
    const dueWhy = d => {
      if (d.state === 'built') return 'run ' + d.run + ' was built' + (d.ended ? ' at ' + d.ended : '') + ' and has not been verified: VDHSit.verify(\'' + d.run +
        '\') first (after a reload, which loses the run\'s record, reconcile instead); no run starts until then';
      if (d.state === 'unverified') return 'run ' + d.run + ' was built but did not verify (' + (d.problems || 0) + ' problem(s)): ' + RECONCILE_CALL;
      return 'run ' + d.run + (d.state === 'running' ? ' started at ' + d.at + ' and has not ended: it may still be going (another tab, or an ' +
        'install replaced mid-run), or a reload or a crash cut it short' : ' failed' + (d.failedAt ? ' at call ' + d.failedAt : '') + ' (started ' + d.at + ')') + ': ' + RECONCILE_CALL;
    };
    function settleCheck(d) {
      if (!d) return null;
      let from, what;
      if (d.state === 'running') {
        if (typeof d.quietSince !== 'number') {
          const q = Object.assign({}, d, { quietSince: now() });
          if (!due.set(q)) due.hold(q);
          d = q;
        }
        from = d.quietSince;
        what = ' was cut short while a call may have been out';
      } else if (d.state === 'failed' && d.noAnswer === true) {
        from = Date.parse(d.ended) || (typeof d.beat === 'number' ? d.beat : 0);
        what = '\'s last call got no answer';
      } else return null;
      const age = now() - from;
      if (age >= SETTLE_MS) return null;
      return 'run ' + d.run + what + ', and this page stopped waiting for it ' + Math.round(age / 1000) + ' s ago: Encharge may still be acting on it. ' +
        'Reconcile again in ' + Math.ceil((SETTLE_MS - age) / 1000) + ' s, so its lists show what that call did';
    }
    const NO_ANSWER = { 408: true, 502: true, 503: true, 504: true, 520: true, 521: true, 522: true, 523: true, 524: true };
    const mayHaveActed = st => typeof st === 'number' && (st >= 500 || NO_ANSWER[st] === true);

    function editedSegments(plan) {
      return (plan.calls || []).filter(c => c.do === 'segment-edit').map(c => Number(String(c.path).split('/').pop())).filter(id => id > 0);
    }
    const snapWhy = ids => 'this plan edits segment(s) ' + ids.join(', ') + ': first VDHSit.snapshotSegments([' + ids.join(', ') +
      ']), and save its answer in the workspace, so their rows as they were can be restored by hand';

    const dropPermissions = () => { if (typeof G.setPermissions === 'function') G.setPermissions([]); };
    const refused = why => { dropPermissions(); return new Error(why); };
    const PW = P.facts, NOT_WORDS = new RegExp(PW.notWords);
    const INVISIBLE = [[0x0, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x600, 0x605], [0x61c, 0x61c], [0x6dd, 0x6dd], [0x70f, 0x70f], [0x890, 0x891],
      [0x8e2, 0x8e2], [0x180e, 0x180e], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f], [0xfeff, 0xfeff],
      [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd], [0x13430, 0x13438], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a], [0xe0001, 0xe0001], [0xe0020, 0xe007f]];
    const visible = s => Array.from(s).filter(ch => { const c = ch.codePointAt(0); return !INVISIBLE.some(r => c >= r[0] && c <= r[1]); }).join('');
    const realDate = s => { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < PW.firstDate) return false; const d = new Date(s + 'T00:00:00Z');
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getTime() <= now() + 86400000; };
    function planPermissionsWhy(plan) {
      const list = ((plan.report || {}).permissionsUsed) || [];
      if (!Array.isArray(list)) return 'the plan\'s permissionsUsed is not a list';
      for (const p of list) {
        if (!p || typeof p.object !== 'string' || typeof p.action !== 'string') return 'a permission in the plan names no object or action';
        const bare = typeof p.joeSaid === 'string' ? visible(p.joeSaid).trim() : '';
        if (!bare || PW.noteOpeners.indexOf(bare.charAt(0)) !== -1 || NOT_WORDS.test(bare.toLowerCase().replace(/[^a-z0-9]/g, ''))) return 'permission ' + p.object + ' in the plan carries no words of Joe\'s';
        if (!realDate(p.date)) return 'permission ' + p.object + ' in the plan carries no date';
      }
      return null;
    }
    function planShapeWhy(plan) {
      if (!deps.allowOfflinePlans && (!plan.provenance || typeof plan.provenance !== 'object' || typeof plan.provenance.compiler !== 'string' || !plan.provenance.compiler)) {
        return 'the plan carries no provenance: it was compiled by a builder older than v1.02, or by hand; compile it again with this version';
      }
      const SO = PW.switchOver, OFF = PW.offStatuses;   // D1, from data/policy.json (through policy.js)
      const calls = plan.calls, ab = calls.findIndex(c => c && c.do === 'segment-edit' && String(c.path).endsWith('/' + SO.segmentId));
      if (ab === -1) return null;
      const first = calls[0] || {};
      const gate = first.do === 'require-off' && first.method === 'GET' && first.path === '/v1/integrations/' + SO.flowId && Array.isArray(first.requireStatusIn) &&
        first.requireStatusIn.length > 0 && first.requireStatusIn.every(s => OFF.indexOf(s) !== -1);
      return gate ? null : 'the plan edits Encharge segment ' + SO.segmentName + ' (' + SO.segmentId + ') without first requiring Encharge flow ' + SO.flowName +
        ' (' + SO.flowId + ') to be off: that edit runs only in the switch-over\'s plan (compile.py objects --switch-over; D1)';
    }
    const unledgeredWhy = () => {
      const l = ledgerGate.get();
      if (!l.length) return null;
      if (l.some(x => x.foreign)) return 'the page\'s local storage holds something under ' + UNLEDGERED_KEY + ' that is not the builder\'s record of verified runs, so no run starts: ' +
        'on Joe\'s go, save localStorage.getItem(\'' + UNLEDGERED_KEY + '\') in the workspace, find out what it is, and remove it only once the ledger holds whatever it names';
      return 'run ' + l.map(x => x.run).join(', ') + ' verified, but the ledger does not hold what it made yet: write VDHSit.ids(\'' + l[0].run +
        '\') (after a reload, VDHSit.unledgered()) into ledger.json with pagecmd.py ledger add, write it back to the Project, then send ' +
        'python3 -B live/pagecmd.py refs ledger.json; no run starts until then';
    };

    async function run(name, plan, opts) {
      opts = opts || {};
      if (inFlight) throw new Error('run ' + inFlight + ' is still running: one run at a time');
      if (runs[name]) throw refused('a run named ' + name + ' exists already; load the plan under a new name');
      if (plan !== undefined && plan !== null) throw refused('a plan comes in only through VDHSit.load, which checks its hash');
      plan = loaded[name];
      if (!plan) throw refused('no plan loaded for ' + name);
      const unsnapped = editedSegments(plan).filter(id => !snapshots[id]);
      if (unsnapped.length) throw refused(snapWhy(unsnapped));
      const ul = unledgeredWhy();
      if (ul) throw refused(ul);
      inFlight = name;   // this page is taken at once, while the lock is asked for
      try {
        const got = await exclusive('a run', () => runLocked(name, plan, opts));
        if (!got.held) throw new Error(got.why);
        return got.out;
      } finally {
        inFlight = null;
        current = null;
        dropPermissions();
      }
    }

    async function runLocked(name, plan, opts) {
      const d = due.get();
      if (d) throw new Error(dueWhy(d));
      const ul = unledgeredWhy();
      if (ul) throw new Error(ul);
      const permWhy = planPermissionsWhy(plan);
      if (permWhy && !(plan.offlineOnly && deps.allowOfflinePlans)) throw new Error(permWhy);
      const seed = Object.assign({}, refs);
      const mark = { run: name, state: 'running', owner: newOwner(), at: new Date(now()).toISOString(), beat: now(), names: planNames(plan),
        made: [], pending: null, planSha: loadedSha[name] || null, provenance: provenanceOf(plan) };
      if (!due.set(mark)) {
        due.clearIf(mark);
        throw new Error('the page cannot keep its run marker in local storage (blocked or full), so a reload mid-run would go unnoticed: no run starts. ' +
          'Save and clear the journal (VDHSit.journal(), then VDHGuard.clearJournal()) or free the storage, and load the plan again');
      }
      runs[name] = { plan: plan, seed: Object.assign({}, seed), owner: mark.owner, out: { ok: false, error: 'running', results: [], refs: {} } };
      current = mark;
      if (typeof G.setPermissions === 'function') G.setPermissions((((plan.report || {}).permissionsUsed) || []).slice());
      let out, threw = false;
      try {
        out = await R.runPlan(recording(name, mark), plan, { refs: seed, delayMs: opts.delayMs === undefined ? 300 : opts.delayMs });
      } catch (e) {
        threw = true;
        out = { ok: false, error: 'threw: ' + String(e && e.message || e) + ' (IDs: VDHSit.created(); then reconcile)', results: [], refs: {} };
      }
      runs[name] = { plan: plan, seed: Object.assign({}, seed), owner: mark.owner, out: out, threw: threw, planSha: mark.planSha };
      const wrote = threw || (out.results || []).some(x => !x.refused && x.method !== 'LOCAL' && x.method !== 'GET');
      const ended = new Date(now()).toISOString();
      let endMark = null;
      if (wrote && out.ok) endMark = Object.assign({}, mark, { state: 'built', ended: ended });
      else if (wrote) {
        const may = mayExist(plan, out, seed, threw);
        endMark = Object.assign({}, mark, { state: 'failed', failedAt: out.failedAt || null, do: out.do || null, ended: ended,
          noAnswer: threw || (out.results || []).some(x => x.method !== 'GET' && x.method !== 'LOCAL' && (x.threw !== undefined || mayHaveActed(x.status))),
          emailsToFind: may.filter(m => m.kind === 'email').map(m => m.name) });
      }
      const gone = markerLost(mark);
      let stored = true;
      if (!endMark) { if (!gone) due.clearIf(mark); }
      else if (!gone || due.peek() === null) { if (!due.set(endMark)) { due.hold(endMark); stored = false; } }
      else { due.hold(endMark); stored = false; }
      if (!stored) unstored[name] = true;
      return summary(name, out);
    }

    function start(name, plan, opts) {
      const no = why => { dropPermissions(); return { started: false, why: why }; };
      if (pending[name] && pending[name].state === 'running') return { started: false, why: name + ' is running' };
      if (inFlight) return { started: false, why: 'run ' + inFlight + ' is still running: one run at a time' };
      if (runs[name]) return no('a run named ' + name + ' exists already; load the plan under a new name');
      if (plan !== undefined && plan !== null) return no('a plan comes in only through VDHSit.load, which checks its hash');
      if (!loaded[name]) return no('no plan loaded for ' + name);
      const unsnapped = editedSegments(loaded[name]).filter(id => !snapshots[id]);
      if (unsnapped.length) return no(snapWhy(unsnapped));
      const d = due.get();
      if (d) return no(dueWhy(d));
      const ul = unledgeredWhy();
      if (ul) return no(ul);
      pending[name] = { state: 'running' };
      run(name, plan, opts).then(s => { pending[name] = { state: 'done', summary: s }; },
        e => { pending[name] = { state: 'error', error: String(e && e.message || e) }; });
      return { started: name };
    }
    function status(name) { return pending[name] || { state: 'unknown' }; }

    function need(name) {
      const r = runs[name];
      if (!r) throw new Error('no run named ' + name);
      return r;
    }

    function verify(name, opts) {
      const r = need(name), p = r.plan, o = r.out;
      if (!o.ok) {
        const dn = due.get();
        return { ok: false, problems: ['the run did not finish: ' + o.error], counted: false, markerState: dn && dn.run === name && dn.owner === r.owner ? dn.state : null };
      }
      let res;
      if (p.kind === 'flow') res = V.verifyFlow(p.expect, o.refs, o.refs['readback:' + p.flow], opts);
      else if (p.kind === 'group') {
        const problems = [];
        Object.keys(p.expect).forEach(k => {
          V.verifyFlow(p.expect[k], o.refs, o.refs['readback:' + k], opts).problems.forEach(x => problems.push(k + ': ' + x));
        });
        res = { ok: problems.length === 0, problems: problems };
      } else res = V.verifyObjects ? V.verifyObjects(p.expect, o.refs) : V.verifySegments(p.expect, o.refs);
      const d = due.get();
      const relaxed = !!opts && Object.keys(opts).some(k => opts[k] !== undefined);
      if (d && d.run === name && d.owner === r.owner && d.state === 'built') {
        if (res.ok && !relaxed) {
          const made = ids(name);
          let recordKept = true;
          if (Object.keys(made).some(k => !/^position:/.test(k))) {
            const rec = { run: name, startedAt: d.at || null, verifiedAt: new Date(now()).toISOString(), planSha: r.planSha || null, provenance: provenanceOf(p), ids: made };
            const list = ledgerGate.get().filter(x => x.run !== name).concat([rec]);
            res.unledgered = true;
            if (!ledgerGate.set(list)) {
              recordKept = false;
              res.unledgeredStored = false;
              res.unledgeredNote = 'the page\'s storage refused the record of what this run made, so the run stays built (a reload must not lose both): ' +
                'free the storage (save VDHSit.journal(), then VDHGuard.clearJournal()) and verify again; write the ledger now either way';
            }
            res.next = 'write VDHSit.ids(\'' + name + '\') into the ledger (pagecmd.py ledger add), write it back to the Project, then send pagecmd.py refs ledger.json: no run starts until the ledger holds this run';
          }
          res.markerCleared = recordKept ? due.clearIf(d) : false;
          if (res.markerCleared) {
            const seed = r.seed || {};
            Object.keys(o.refs || {}).forEach(k => {
              if (/^(flow|email|segment):/.test(k) && !(Object.prototype.hasOwnProperty.call(seed, k) && String(seed[k]) === String(o.refs[k]))) refs[k] = o.refs[k];
            });
          }
        }
        else if (!res.ok) {
          const u = Object.assign({}, d, { state: 'unverified', problems: res.problems.length });
          if (!due.set(u)) due.hold(u);
          res.next = 'reconcile first (python3 -B live/pagecmd.py reconcile ledger.json <this plan>), and mark what this run made as failed in the ledger; no run starts until then';
        } else res.markerCleared = false;
      }
      const after = due.get();
      res.counted = res.markerCleared === true;
      res.markerState = after && after.run === name && after.owner === r.owner ? after.state : null;
      if (relaxed) res.note = 'a verify with options (' + Object.keys(opts).filter(k => opts[k] !== undefined).join(', ') + ') never counts as the run\'s verify';
      return res;
    }

    function provenanceOf(plan) {
      const pv = plan && plan.provenance;
      if (!pv || typeof pv !== 'object') return null;
      const short = x => (x && typeof x === 'object' ? String(x.file) + '@' + String(x.sha256).slice(0, 12) : null);
      return { compiler: pv.compiler || null, compilerSha: String(pv.compilerSha256 || '').slice(0, 12) || null, mode: pv.mode || null,
        emailSet: pv.emailSet || null, inputs: (pv.inputs || []).map(short), manifest: short(pv.manifest), ledger: short(pv.ledger),
        permissions: short(pv.permissions) };
    }

    function unledgered() {
      const l = ledgerGate.get();
      const out = { durable: ledgerGate.durable(), runs: l.filter(x => !x.foreign).map(x => Object.assign({}, x)) };
      if (ledgerGate.foreign()) out.foreign = 'the storage holds something under ' + UNLEDGERED_KEY + ' that is not the builder\'s list: no run starts until Joe has it removed';
      return out;
    }

    function putRefs(m, ledger) {
      Object.keys(refs).forEach(k => { delete refs[k]; });
      Object.assign(refs, m || {});
      if (ledger === undefined) return Object.keys(refs).length;
      const set = k => new Set((((ledger || {})[k]) || []).map(String));
      const has = { flow: set('flows'), segment: set('segments'), email: set('emails'), tag: set('tags'), field: set('fields') };
      const held = rec => !rec.foreign && Object.keys(rec.ids || {}).every(k => {
        const kind = k.split(':')[0];
        return has[kind] ? has[kind].has(String(rec.ids[k])) : true;   // steps and positions belong to their flow
      });
      const before = ledgerGate.get(), still = before.filter(rec => !held(rec));
      const cleared = before.filter(rec => held(rec)).map(rec => rec.run);
      const stored = cleared.length ? ledgerGate.set(still) : true;
      const after = ledgerGate.get().map(rec => rec.run);
      return { refs: Object.keys(refs).length, ledgered: cleared.filter(n => after.indexOf(n) === -1), unledgered: after, stored: stored };
    }

    const argIn = transport.argIn;

    async function setRefs(text, sha) {
      const a = await argIn(text, sha), m = a.arg, obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
      if (a.why) return a;
      if (!obj(m) || !obj(m.refs) || (m.ledger !== undefined && !(obj(m.ledger) && Object.keys(m.ledger).every(k => Array.isArray(m.ledger[k]))))) {
        return { ok: false, why: 'not {refs, ledger} as pagecmd.py refs writes it: nothing changed' };
      }
      return putRefs(m.refs, m.ledger);
    }

    function ids(name) {
      const r = need(name), c = G.created();
      const made = { flow: c.flows, step: c.steps, email: c.emails, segment: c.segments };
      const out = {}, all = R.ids(r.out.refs), seed = r.seed || {};
      Object.keys(all).forEach(k => {
        if (Object.prototype.hasOwnProperty.call(seed, k) && String(seed[k]) === String(all[k])) return;
        const kind = k.split(':')[0];
        if (kind === 'position' || (made[kind] || []).indexOf(Number(all[k])) !== -1) out[k] = all[k];
      });
      const sentOk = new Set((r.out.results || []).filter(x => x.status >= 200 && x.status < 300).map(x => x.n));
      (r.plan.calls || []).forEach(call => {
        if (!sentOk.has(call.n)) return;
        if (call.do === 'create-tag') ((call.body && call.body.tags) || []).forEach(t => { if (t && (c.tags || []).indexOf(t.tag) !== -1) out['tag:' + t.tag] = t.tag; });
        if (call.do === 'create-field') (Array.isArray(call.body) ? call.body : []).forEach(f => { if (f && (c.fields || []).indexOf(f.name) !== -1) out['field:' + f.name] = f.name; });
      });
      return out;
    }

    async function reconcile(text, sha) {
      const a = await argIn(text, sha);
      if (a.why) return a;
      const known = a.arg || {};
      if (inFlight) return { ok: false, why: 'run ' + inFlight + ' is still running: reconcile when it has ended' };
      const miss = ['flows', 'segments', 'emails', 'tags', 'fields'].filter(k => !Array.isArray(known[k]));   // v1.11 (P4): emails too
      if (miss.length) return { ok: false, why: 'pass the ledger\'s ' + miss.join(', ') + ': send what python3 -B live/pagecmd.py reconcile ledger.json [plans] writes' };
      const got = await exclusive('reconcile', () => reconcileLocked(known));
      return got.held ? got.out : { ok: false, why: got.why };
    }

    async function reconcileLocked(known) {
      let d = due.get();
      if (d && d.state === 'built' && runs[d.run] && runs[d.run].owner === d.owner) {
        return { ok: false, why: 'run ' + d.run + ' is built and this page holds its record: VDHSit.verify(\'' + d.run + '\') settles it. Reconcile is for a run this page no longer holds (after a reload), or one that failed' };
      }
      const wait = settleCheck(d);
      if (wait) return { ok: false, why: wait };
      d = due.get();
      const cmp = await rc.compare(known, d);
      const out = cmp.out, names = cmp.names, objNames = cmp.objNames, made = cmp.made;
      if (d) {
        rc.markerFacts(out, d, made);   // the run, its state, and the emails Joe looks for by name
        out.markerCleared = out.resolved ? due.clearIf(d) : false;
        if (out.markerCleared && (d.state === 'built' || d.state === 'unverified')) {
          out.unverifiedRun = d.run;
          out.unverifiedNote = 'run ' + d.run + ' was never verified: mark what it made failed in the ledger (nothing stands in for its verify), and rebuild it if it is needed';
        }
        lastReconcile = { run: d.run, at: d.at, owner: d.owner, resolved: out.resolved };
      }
      rc.listsOnly(out, names, objNames, made);
      return out;
    }

    function reconcileDue() { const d = due.get(); return d ? Object.assign({}, d, { durable: due.durable() }) : null; }

    async function waiveReconcile(runName, joeSaid) {
      if (inFlight) return { cleared: false, why: 'run ' + inFlight + ' is still running' };
      const got = await exclusive('a waive', () => {
        const d = due.get();
        if (!d) return { cleared: false, why: 'no marker is set' };
        const wait = settleCheck(d);
        if (wait) return { cleared: false, why: wait };
        if (runName !== d.run || typeof joeSaid !== 'string' || !joeSaid.trim()) return { cleared: false, why: 'name the marked run (' + d.run + ') and give Joe\'s own words' };
        if (!lastReconcile || lastReconcile.run !== d.run || lastReconcile.at !== d.at || lastReconcile.owner !== d.owner || lastReconcile.resolved !== false) {
          return { cleared: false, why: 'reconcile first: a waive is only for a marker this page\'s reconcile could not resolve' };
        }
        const pendEmails = d.pending && d.pending.kind === 'email' && Array.isArray(d.pending.names) ? d.pending.names : [];
        return { cleared: due.clearIf(d), run: d.run, at: d.at || null, state: d.state, joeSaid: joeSaid, names: d.names || null, made: d.made || null,
          emailsToFind: Array.from(new Set([].concat(Array.isArray(d.made) ? [] : (d.state === 'running' ? ((d.names && d.names.emails) || []) : []),
            d.state === 'running' ? [] : (d.emailsToFind || []), pendEmails))) };
      });
      return got.held ? got.out : { cleared: false, why: got.why };
    }

    function created() { return G.created(); }

    const snapshots = {};
    async function snapshotSegments(ids) {
      const got = await G.call('GET', '/v1/segments');
      if (!got.ok) return { ok: false, status: got.status };
      const list = (got.json && got.json.segments) || got.json || [];
      const kept = [];
      ids.forEach(id => {
        const sg = list.find(x => Number(x.id) === Number(id));
        if (sg) {
          snapshots[Number(id)] = JSON.parse(JSON.stringify(sg));
          const d = {};
          ['id', 'name', 'accountId', 'version', 'color', 'objectName', 'conditions'].forEach(k => { if (sg[k] !== undefined) d[k] = sg[k]; });
          kept.push(d);
        }
      });
      return { ok: kept.length === ids.length, segments: kept };
    }

    function segmentsBefore(name, segmentId) {
      const id = Number(segmentId);
      const read = runs[name] && runs[name].out.refs['segments:before:' + id];
      const list = read && (read.segments || read);
      const atEdit = Array.isArray(list) ? list.find(x => Number(x.id) === id) : null;
      const snap = snapshots[id] || null;
      const shape = (sg, from) => (sg ? { from: from, name: sg.name, operator: sg.conditions && sg.conditions.operator, rows: sg.conditions && sg.conditions.conditions } : null);
      const beforeEdit = shape(atEdit, 'the run\'s read just before this segment\'s edit');
      const beforeRun = shape(snap, 'the snapshot taken before the run');
      const best = beforeEdit || beforeRun;
      if (!best) return { found: false };
      const out = { found: true, id: id, name: best.name, from: best.from, operator: best.operator, rows: best.rows, beforeEdit: beforeEdit, beforeRun: beforeRun };
      if (beforeEdit && beforeRun) out.sameAsSnapshot = R.canon([beforeEdit.operator, beforeEdit.rows]) === R.canon([beforeRun.operator, beforeRun.rows]);
      return out;
    }

    const api = { load: load, loadPart: loadPart, unledgered: unledgered, run: run, start: start, status: status, verify: verify, ids: ids, names: insp.names, flags: insp.flags,
      emailCheck: insp.emailCheck, masterCheck: insp.masterCheck, countPeople: insp.countPeople, fields: insp.fields, tags: insp.tags, b7: insp.b7,
      guardSelfTest: insp.guardSelfTest, fingerprint: fingerprint, created: created, segmentsBefore: segmentsBefore,
      snapshotSegments: snapshotSegments, matchPeople: insp.matchPeople, previewNumbers: insp.previewNumbers, tagCounts: insp.tagCounts,
      reconcile: reconcile, reconcileDue: reconcileDue, waiveReconcile: waiveReconcile, listeners: insp.listeners, journal: () => (G.journal ? G.journal() : []),
      version: () => VERSION,
      refs: () => Object.assign({}, refs), runs: () => Object.keys(runs),
      setRefs: setRefs,
      summary: n => summary(n, need(n).out) };

    async function fingerprint(expected) {
      const src = root.__vdhSrc || {};
      const files = {};
      for (const f of PAGE_FILES) {
        files[f] = typeof src[f] === 'function' ? await sha256(src[f].toString()) : null;
      }
      const current = root.VDHGuard === G && root.VDHRunner === R && root.VDHVerify === V && root.VDHPolicy === P && root.VDHStore === S &&
        root.VDHTransport === T && root.VDHInspect === I && root.VDHReconcile === C;
      const out = { files: files, current: current, build: (root.__vdhManifest && root.__vdhManifest.build) || null };
      if (expected) {
        out.differ = Object.keys(files).filter(f => !expected[f] || files[f] !== expected[f]);
        out.match = out.differ.length === 0 && current;
      }
      return out;
    }

    return api;
  }

  function sha256sync(text) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be,
      0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc,
      0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
      0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585,
      0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814,
      0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    const bytes = [];   // UTF-8
    for (const ch of String(text)) {
      const c = ch.codePointAt(0);
      if (c < 0x80) bytes.push(c);
      else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    const bits = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Array(64);
    const rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < bytes.length; o += 64) {
      for (let t = 0; t < 16; t++) w[t] = (bytes[o + 4 * t] << 24) | (bytes[o + 4 * t + 1] << 16) | (bytes[o + 4 * t + 2] << 8) | bytes[o + 4 * t + 3];
      for (let t = 16; t < 64; t++) {
        const s0 = rot(w[t - 15], 7) ^ rot(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = rot(w[t - 2], 17) ^ rot(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0;
        const t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  const buildOf = files => VERSION + '-' + sha256sync(files.map(f => f.sha256 + '  ' + f.file + '\n').join('')).slice(0, 16);
  function installWhy() {
    const again = ': install all nine page files again, in order (' + PAGE_FILES.join(', ') + '), from one package, with pagecmd.py install';
    const m = root.__vdhManifest;
    if (!m || typeof m !== 'object' || !Array.isArray(m.files)) return 'no install manifest came with sitting.js' + again;
    const listed = m.files.map(f => f && f.file);
    if (JSON.stringify(listed) !== JSON.stringify(PAGE_FILES)) return 'the install manifest lists ' + listed.join(', ') + ', not this sitting.js\'s nine files' + again;
    const objects = m.files.map(f => f.object);
    if (JSON.stringify(objects) !== JSON.stringify(PAGE_OBJECTS)) return 'the install manifest names the objects ' + objects.join(', ') + ', not ' + PAGE_OBJECTS.join(', ') + again;
    if (m.files[0].sha256 !== GUARD_SHA256) return 'the install manifest names a guard.js (' + String(m.files[0].sha256).slice(0, 8) + '...) that is not the pinned one (' + GUARD_SHA256.slice(0, 8) + '...)' + again;
    if (m.build !== buildOf(m.files)) return 'the install manifest\'s build id (' + m.build + ') does not match the files it lists' + again;
    const order = Array.isArray(root.__vdhOrder) ? root.__vdhOrder : [];
    if (JSON.stringify(order) !== JSON.stringify(PAGE_FILES)) {
      const missing = PAGE_FILES.filter(f => order.indexOf(f) === -1);
      return 'the page files came in as ' + (order.join(', ') || 'nothing') + (missing.length ? ' (missing ' + missing.join(', ') + ')' : ' (not in order, or one twice)') + again;
    }
    const src = root.__vdhSrc || {};
    for (const f of m.files) {
      if (typeof src[f.file] !== 'function') return f.file + ' is not installed' + again;
      if (f.object !== 'VDHSit' && (!root[f.object] || typeof root[f.object] !== 'object')) return f.file + ' made no ' + f.object + again;
      if (sha256sync(src[f.file].toString()) !== f.sha256) return f.file + ' is not the file build ' + m.build + ' lists (stale, altered, or from another package)' + again;
    }
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    const S = helper({}, HELPERS[1]), T = helper({}, HELPERS[2]);
    module.exports = { makeSit: makeSit, sha256: T.sha256, dueStore: S.dueStore, listStore: S.listStore, VERSION: VERSION, PAGE_FILES: PAGE_FILES,
      sha256sync: sha256sync, buildOf: buildOf };
  } else {
    const why = installWhy();
    if (why) throw new Error('no VDHSit: ' + why);
    root.VDHSit = makeSit({ guard: root.VDHGuard, runner: root.VDHRunner, verify: root.VDHVerify });
  }
})(typeof window !== 'undefined' ? window : globalThis);

};
window.__vdhManifest = {"generated":"GENERATED by live/pagecmd.py manifest from the nine page files: do not edit. python3 -B live/pagecmd.py manifest . --out live/install-manifest.json writes it again; check_package.py compares it","build":"v1.11-adae74c7d6647182","files":[{"file":"guard.js","object":"VDHGuard","path":"scripts/guard.js","stripped":false,"sha256":"7e7cbddb001426f18fc7d7f80b735fde907e6b5724c0b48442326554f004c4df"},{"file":"runner.js","object":"VDHRunner","path":"scripts/runner.js","stripped":false,"sha256":"155a85defaac88fccb8cff916a07fbf5e6d32b90d8b3735e4c1b024ce8795e5a"},{"file":"verify.js","object":"VDHVerify","path":"scripts/verify.js","stripped":false,"sha256":"7b90d3feea51f9d0a42db0ebb3a7c382fc1f13660c02f5618208ec743d145a3b"},{"file":"policy.js","object":"VDHPolicy","path":"live/policy.js","stripped":true,"sha256":"1d4eb0b30a308ebd0d0b2d15bf1a7e6bb27a35a2da7a5c2714c51b9687d33338"},{"file":"storage.js","object":"VDHStore","path":"live/storage.js","stripped":true,"sha256":"cff84cea38148a958904c36a9c76388802564894772d2f9ed4b1b82cdd393b76"},{"file":"transport.js","object":"VDHTransport","path":"live/transport.js","stripped":true,"sha256":"bb21cd88ddce4c4c2fed35d232863e70485c4f493e1c2869287df7936dc35e8d"},{"file":"inspect.js","object":"VDHInspect","path":"live/inspect.js","stripped":true,"sha256":"611200e8770251ec7c3277f8dce87f8211d282d3c195d08696d282f790d7221e"},{"file":"reconcile.js","object":"VDHReconcile","path":"live/reconcile.js","stripped":true,"sha256":"165ab60fb54aa90518ea84b6698181ea3b5fff165b4dcf01d5e9ccc779190013"},{"file":"sitting.js","object":"VDHSit","path":"live/sitting.js","stripped":true,"sha256":"4d222592e4f093b7ae3cd09046c7df63a60cfb826ca17b62c3f7f3411a2fe2cd"}]};
window.__vdhSrc["sitting.js"]();
"installed sitting.js: " + typeof window.VDHSit
