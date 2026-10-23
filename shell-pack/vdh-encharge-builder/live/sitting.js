/*
 * sitting.js -- the session controller of vdh-encharge-builder's page helper, VDHSit (live tests B0-B8, 2026-09-25;
 * re-check R1-R4, 2026-09-26; every building session since v1.00)
 *
 * v1.10 (P20, P19's stage 2): the page helper is in page files by job, and this one owns a run's lifecycle: loading a
 * plan, the one run at a time under the builder's Web Lock, the run marker and every change of its state, Joe's
 * permissions for a run, verify, the ledger gate, refs, reconcile's lock and verdict, and waive. The others each do one
 * job and hold no run state, and each is given what it needs explicitly:
 *   policy.js     VDHPolicy     the policy facts (generated from data/policy.json and guard.js's declarations)
 *   storage.js    VDHStore      the run marker's and the verified runs' storage (dueStore, listStore)
 *   transport.js  VDHTransport  a plan's hash and parts, and the hashed argument of reconcile and setRefs
 *   inspect.js    VDHInspect    the read-only checks (v1.09, P19 stage 1)
 *   reconcile.js  VDHReconcile  Encharge's lists read whole and compared with the ledger, and the recovery results
 * VDHSit keeps every call and name it had in v1.09; the moved parts answer under them as before.
 *
 * Install (pagecmd.py install, one call per file, in this order, every time): guard.js, runner.js, verify.js, policy.js,
 * storage.js, transport.js, inspect.js, reconcile.js, sitting.js. Each install first removes VDHSit; sitting.js's call
 * carries the install manifest pagecmd.py generates (live/install-manifest.json: the files, their order, a build id,
 * each file's SHA-256 as the page holds it), and VDHSit is made only if every file is present, was installed in that
 * order, and matches it: a missing, stale, reordered, altered or mixed-build file means no VDHSit.
 *
 * It only calls VDHGuard, VDHRunner, VDHVerify and the helpers above: it never calls fetch, so every call still goes
 * through the guard. It keeps each run's full output inside the page and returns summaries only: no step schemas, no
 * email bodies, no contact data, no tokens. Counts of people leave the page as numbers.
 * One run at a time, in this browser: a run holds the builder's Web Lock (navigator.locks) from before its first call
 * until it has ended, and reconcile and waive hold it too (v1.01; review of v1.00, 4). Each run writes a marker in the
 * page's local storage before its first call, with an owner token of its own, and checks before every call that the
 * stored marker is still its own; if not, it stops with nothing more sent. At its end the marker says "built" (a plain
 * VDHSit.verify that passes clears it), "failed", or is removed if nothing was written. So no run starts, even after a
 * reload and a reinstall, until the last run was verified, or reconcile() has found Encharge's lists agreeing with the
 * ledger, with what the run made and with the session's first reads.
 * Joe's permissions are set by the page from the plan it loaded by its hash, at the start of each run, and emptied when
 * a run ends or is refused (v1.01, v1.02). A run whose plain verify passes leaves a record of what it made, "verified,
 * not in the ledger", until the ledger's refs show the ledger holds it (v1.02).
 *
 *   VDHSit.fingerprint(expected)    SHA-256 of each installed file's full text; with pagecmd.py's hashes, a yes or no
 *   VDHSit.guardSelfTest()          forbidden calls the guard must refuse, checked without sending anything
 *   VDHSit.load('b2', text, sha)    a plan passed in as JSON text; kept only if its SHA-256 matches, and never a plan
 *                                   compiled for a dry run only or for the offline suites, one with no provenance, or
 *                                   one editing Abandoners without first requiring Encharge flow 310308 off
 *   VDHSit.loadPart('b2', i, n, text, sha)  the same, in n parts sent one call each; the last joins and loads the whole
 *   VDHSit.run('b2') / start('b2') / status('b2')   run the loaded plan (start: in the background, status polls it)
 *   VDHSit.verify('b2')             verifyFlow / verifyObjects for that run, {ok, problems, counted, markerState}
 *   VDHSit.ids('b2'), VDHSit.unledgered(), VDHSit.setRefs(text, sha)   what a run made, for the ledger, and back
 *   VDHSit.reconcile(text, sha), reconcileDue(), waiveReconcile(run, joeSaid)   after a failure, and at a sitting's end
 *   VDHSit.snapshotSegments([ids]), segmentsBefore(n, id), created(), journal(), refs(), runs(), summary(n), version()
 *   VDHSit.fields(), tags(), masterCheck, emailCheck, names, flags, countPeople, matchPeople, previewNumbers, tagCounts,
 *   listeners, b7                   inspect.js's read-only checks, under their old names
 *
 * The page files are plain ASCII with no backslash-u escapes (pagecmd.py refuses others): the tool transport turns such
 * an escape into the character. Works in the page (window.VDHSit) and in Node for the rehearsals (module.exports.makeSit,
 * with the helpers on globalThis, as the page has them on window).
 */
(function (root) {
  'use strict';


  // v1.09 (P19, stage 1) moved the read-only checks to inspect.js; v1.10 (P20, stage 2) the policy facts, the storage, the
  // transport and the reconciliation to page files of their own. This file refuses to start without each of them, or
  // with one of another version, so an incomplete or mixed install leaves no VDHSit at all
  const VERSION = 'v1.11';
  const PAGE_FILES = ['guard.js', 'runner.js', 'verify.js', 'policy.js', 'storage.js', 'transport.js', 'inspect.js', 'reconcile.js', 'sitting.js'];
  // guard.js's fingerprint, pinned here as check_package.py pins it: the install manifest must name it, so a manifest made
  // by hand for a changed guard still leaves no VDHSit (the independent review of v1.10)
  const GUARD_SHA256 = '7e7cbddb001426f18fc7d7f80b735fde907e6b5724c0b48442326554f004c4df';
  const PAGE_OBJECTS = ['VDHGuard', 'VDHRunner', 'VDHVerify', 'VDHPolicy', 'VDHStore', 'VDHTransport', 'VDHInspect', 'VDHReconcile', 'VDHSit'];
  // the helpers, by file: the object each makes on window
  const HELPERS = [['policy.js', 'VDHPolicy', 'policy'], ['storage.js', 'VDHStore', 'store'], ['transport.js', 'VDHTransport', 'transport'],
    ['inspect.js', 'VDHInspect', 'inspect'], ['reconcile.js', 'VDHReconcile', 'reconcile']];
  // the helper a page file makes, from what makeSit is given or else from window, checked: present and of this version
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
    // The browser's Web Locks: one holder of the builder's lock at a time, across every tab of app.encharge.io in this
    // browser, released by the browser only when the holder's page goes (a reload, a closed tab). A run holds it until it
    // has ended, even while a call hangs; so no other copy of the builder runs or reconciles while this run could still
    // wake up and send (review of v1.00, 4: a heartbeat's age never proved the run had stopped).
    const locks = deps.locks !== undefined ? deps.locks : ((root.navigator && root.navigator.locks) || null);
    const LOCK = 'vdh-encharge-builder';
    // A call that got no answer, or a run cut short, may still be acted on by Encharge for a while: a marker whose last
    // call went out less than this long ago is not reconciled yet, so Encharge's lists show what the call did.
    const SETTLE_MS = 120000;
    // the read-only checks, given the run state read-only (need) and the guarded list reader (listAll)
    const insp = I.make({ guard: G, runner: R, verify: V, sha256: sha256, need: name => need(name), listAll: (p, k) => listAll(p, k) });
    // the reconciliation, given the guard, the fields read, the policy facts, and the ledger gate's records read-only
    const rc = C.make({ guard: G, fields: () => insp.fields(), policy: P, records: () => ledgerGate.get() });
    const planNames = rc.planNames, mayExist = rc.mayExist, listAll = rc.listAll;
    let inFlight = null;      // the run in progress in this page: one at a time
    let current = null;       // its marker
    let lastReconcile = null; // {run, at, owner, resolved} of this page's last reconcile of a marker, for waiveReconcile

    // Runs fn holding the builder's lock, or says why not (another holder, or no Web Locks in this page).
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

    // Why the page's storage no longer holds this run's marker, or null while it does.
    function markerLost(mark) {
      const s = due.peek();
      if (s === undefined) return 'the page\'s storage cannot be read';
      if (s === null) return 'the run marker is gone from the page\'s storage (cleared by something else)';
      if (s.run !== mark.run || s.at !== mark.at || s.owner !== mark.owner) return 'the page\'s storage now holds another run\'s marker (' + s.run + ')';
      return null;
    }

    // Encharge's own words when it refuses a call, kept per run (the runner reports only the status). Short text only.
    function errorText(j) {
      if (!j) return null;
      const m = (j.error && (j.error.message || j.error)) || j.message || j.errors || j;
      return (typeof m === 'string' ? m : JSON.stringify(m)).slice(0, 300);
    }
    // The object a call would create, by kind and name (steps, links and notes belong to their flow), or null.
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
    // What Encharge's answer says the call made: [{kind, id (flows, segments, emails, when the answer holds it), name}].
    function madeFrom(c, json) {
      const j = json || {};
      const one = obj => [{ kind: c.kind, id: obj && Number.isFinite(Number(obj.id)) ? Number(obj.id) : null, name: c.names[0] }];
      if (c.kind === 'flow') return one(j.integration);
      if (c.kind === 'segment') return one(j.segment);
      if (c.kind === 'email') return one(j.email);
      const listed = c.kind === 'tag' ? (Array.isArray(j.tags) ? j.tags.map(t => t && t.tag) : null) : (Array.isArray(j.fields) ? j.fields.map(f => f && f.name) : null);
      return (listed || c.names).filter(n => typeof n === 'string').map(n => ({ kind: c.kind, name: n }));
    }
    // The guard as this run sees it: before every call, the stored marker must still be this run's own and take its new
    // heartbeat; otherwise the call is refused here, nothing sent, and the run stops (review of v1.00, 4). The marker also
    // records what the run made (made: each create Encharge answered) and the create in flight (pending), so a reconcile
    // after a failure or a reload knows both without the guard's journal (the second review of v1.01).
    function recording(name, mark) {
      return { call: async (method, path, body) => {
        const c = createOf(method, path, body);
        let why = markerLost(mark);
        if (!why) {
          mark.beat = now(); mark.pending = c;
          // refused: the call is never sent, so its create is not in doubt (the fourth review)
          if (!due.set(mark)) { mark.pending = null; why = 'its heartbeat could not be stored'; }
        }
        if (why) {
          lost[name] = why;
          return { ok: false, refused: true, by: 'the page', reason: 'this run no longer holds its marker (' + why + '): stopped, nothing sent' };
        }
        const r = await G.call(method, path, body);   // a throw leaves pending set: that call may have been acted on
        if (!r.ok && !r.refused) errors[name] = { method: method, path: path, status: r.status, encharge: errorText(r.json) };
        // A create is settled by the guard's refusal (nothing sent) or by an answer that shows it done or undone: a
        // success, whose objects are recorded as made, or a 4xx other than a timeout, Encharge's own refusal. A 5xx or a
        // timeout, like no answer, may have been acted on: the create stays pending, in doubt until a list or Joe settles
        // it (the fourth review: Encharge may make an object and still answer 500)
        const settled = r.refused === true || (typeof r.status === 'number' && !mayHaveActed(r.status));
        if (c && settled) {
          mark.pending = null;
          if (r.ok) mark.made = (mark.made || []).concat(madeFrom(c, r.json));
          // stored only while the marker is still this run's (never written back over a loss); if the storage refuses
          // it, or the marker was lost, the next call's check stops the run, and the end marker carries what was made
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
        // built, not verified: "run succeeded" is not "verified and ready" (review of v1.00)
        s.state = 'built';
        s.next = 'VDHSit.verify(\'' + name + '\'): no run starts until it passes';
      }
      if (unstored[name]) {
        // The page holds the end marker in memory (durable: false); the storage still says running. In this page the
        // memory one decides; after a reload, the stored one does (a reconcile, after the two minutes).
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
      // how many permissions, each object and action once (the plan lists one per step that uses it)
      const used = ((plan.report || {}).permissionsUsed) || [];
      return { loaded: true, run: name, calls: plan.calls.length, sha: got, permissions: new Set(used.map(x => String(x && x.object) + ' ' + String(x && x.action))).size };
    }

    // A plan in n parts, one call each (v1.02; review of v1.01, N5): a part is at most 24,000 bytes, well under the largest
    // single call proven live through the tool transport (68,524 bytes, v1.02's sitting.js install, gap A21), and the
    // biggest v50 plan is 315 KB. transport.js keeps the parts until all n have come; the last to arrive joins them, in
    // order, and loads the whole through load(), which checks its hash.
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
    // A marker whose last call may still be acted on by Encharge: a run cut short, or one whose last call got no answer
    // (or a gateway's 408, 502, 503 or 504). Timed from when this page's code stopped waiting for that call, not from
    // when it went out (the second review of v1.01): for a failed run, when it ended; for a run cut short, from the
    // first reconcile or waive that held the lock and found it, stamped in the marker as quietSince (the page that ran
    // it was gone by then, since the lock was free). Whether the run could still send is the lock's question.
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
    // A status that is no answer from Encharge itself: a timeout, or a gateway or CDN that lost it (Cloudflare's 520-524)
    const NO_ANSWER = { 408: true, 502: true, 503: true, 504: true, 520: true, 521: true, 522: true, 523: true, 524: true };
    // An answer that does not show the call undone: those, and any other server error (5xx: Encharge's own 500 may come
    // after it acted). Such a call's create stays in doubt, and reconcile gives it two minutes from when the page stopped
    // waiting for it (the fourth and fifth reviews of v1.01). No answer at all is a throw, and counts the same.
    const mayHaveActed = st => typeof st === 'number' && (st >= 500 || NO_ANSWER[st] === true);

    // The segments a plan edits, by id (compile.py writes each edit's path with the ledger's id).
    function editedSegments(plan) {
      return (plan.calls || []).filter(c => c.do === 'segment-edit').map(c => Number(String(c.path).split('/').pop())).filter(id => id > 0);
    }
    const snapWhy = ids => 'this plan edits segment(s) ' + ids.join(', ') + ': first VDHSit.snapshotSegments([' + ids.join(', ') +
      ']), and save its answer in the workspace, so their rows as they were can be restored by hand';

    // Joe's permissions are for the run they were set for: emptied when it ends or is refused, whatever happened (v1.01),
    // except when the refusal is that another run is going in this page, whose permissions they may be.
    const dropPermissions = () => { if (typeof G.setPermissions === 'function') G.setPermissions([]); };
    const refused = why => { dropPermissions(); return new Error(why); };
    // v1.02 (review of v1.01, N4): a run's permissions are the ones its plan lists as used (compile.py checked each is Joe's
    // own words with a date), set by the page just before the run's first call, never typed in by hand. Why a plan's list
    // cannot be used, or null.
    // (the third review of the fixes: the words' letters and digits alone, so plurals, glued and spaced forms are caught;
    // and no backslash-b or backslash-p escape, which the tool transport was never probed with)
    // v1.10 (P20): the words and the first day come from data/policy.json (through policy.js), as the compiler's and
    // pagecmd.py's do; the invisible characters' table stays here (data/policy.json's notes say why)
    const PW = P.facts, NOT_WORDS = new RegExp(PW.notWords);
    // Unicode's format and control characters (Cf, Cc), by code point: taken out before the words are judged
    const INVISIBLE = [[0x0, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x600, 0x605], [0x61c, 0x61c], [0x6dd, 0x6dd], [0x70f, 0x70f], [0x890, 0x891],
      [0x8e2, 0x8e2], [0x180e, 0x180e], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x206f], [0xfeff, 0xfeff],
      [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd], [0x13430, 0x13438], [0x1bca0, 0x1bca3], [0x1d173, 0x1d17a], [0xe0001, 0xe0001], [0xe0020, 0xe007f]];
    const visible = s => Array.from(s).filter(ch => { const c = ch.codePointAt(0); return !INVISIBLE.some(r => c >= r[0] && c <= r[1]); }).join('');
    // a calendar day from 2020 to tomorrow at the latest: a permission is never dated in the future
    const realDate = s => { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < PW.firstDate) return false; const d = new Date(s + 'T00:00:00Z');
      return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s && d.getTime() <= now() + 86400000; };
    function planPermissionsWhy(plan) {
      const list = ((plan.report || {}).permissionsUsed) || [];
      if (!Array.isArray(list)) return 'the plan\'s permissionsUsed is not a list';
      for (const p of list) {
        if (!p || typeof p.object !== 'string' || typeof p.action !== 'string') return 'a permission in the plan names no object or action';
        // as compile.py judges them: invisible (format and control) characters out, then no note in brackets, and no test's
        // or rehearsal's words, with case, spaces and punctuation folded
        const bare = typeof p.joeSaid === 'string' ? visible(p.joeSaid).trim() : '';
        if (!bare || PW.noteOpeners.indexOf(bare.charAt(0)) !== -1 || NOT_WORDS.test(bare.toLowerCase().replace(/[^a-z0-9]/g, ''))) return 'permission ' + p.object + ' in the plan carries no words of Joe\'s';
        if (!realDate(p.date)) return 'permission ' + p.object + ' in the plan carries no date';
      }
      return null;
    }
    // The page holds D1 too (the second review of the fixes): a plan compiled before v1.02 has no provenance and no
    // switch-over gate, so it is refused; and an edit to Encharge segment Abandoners (active last 24h) runs only in a plan
    // whose first call reads Encharge flow Abandoned Cart Email Sending Sequence and requires it off.
    function planShapeWhy(plan) {
      // (the rehearsals' pages, which take the offline suites' plans, also take their hand-made ones)
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
      // v1.02: checked again under the lock, since another tab may have verified a run meanwhile
      const ul = unledgeredWhy();
      if (ul) throw new Error(ul);
      const permWhy = planPermissionsWhy(plan);
      if (permWhy && !(plan.offlineOnly && deps.allowOfflinePlans)) throw new Error(permWhy);
      // v1.07 (P2; the review of v1.07): a run's refs are the page's alone, which only the hashed setRefs sets, and what
      // its own calls make. A refs option to run or start, which pointed a step at another object with no hash, is gone.
      const seed = Object.assign({}, refs);
      // Written before the first call: if the page reloads or crashes mid-run, it stays, and no run starts until reconcile.
      // made and pending (see recording) say what the run created, and what it may have
      const mark = { run: name, state: 'running', owner: newOwner(), at: new Date(now()).toISOString(), beat: now(), names: planNames(plan),
        made: [], pending: null, planSha: loadedSha[name] || null, provenance: provenanceOf(plan) };
      if (!due.set(mark)) {
        due.clearIf(mark);
        throw new Error('the page cannot keep its run marker in local storage (blocked or full), so a reload mid-run would go unnoticed: no run starts. ' +
          'Save and clear the journal (VDHSit.journal(), then VDHGuard.clearJournal()) or free the storage, and load the plan again');
      }
      runs[name] = { plan: plan, seed: Object.assign({}, seed), owner: mark.owner, out: { ok: false, error: 'running', results: [], refs: {} } };
      current = mark;
      // v1.02: the plan's own permissions, set now, under the lock, with the marker written; emptied when the run ends
      if (typeof G.setPermissions === 'function') G.setPermissions((((plan.report || {}).permissionsUsed) || []).slice());
      let out, threw = false;
      try {
        out = await R.runPlan(recording(name, mark), plan, { refs: seed, delayMs: opts.delayMs === undefined ? 300 : opts.delayMs });
      } catch (e) {
        threw = true;
        out = { ok: false, error: 'threw: ' + String(e && e.message || e) + ' (IDs: VDHSit.created(); then reconcile)', results: [], refs: {} };
      }
      runs[name] = { plan: plan, seed: Object.assign({}, seed), owner: mark.owner, out: out, threw: threw, planSha: mark.planSha };
      // A write went out (a GET creates nothing): the run ends "built" (verify next) or "failed" (reconcile next)
      const wrote = threw || (out.results || []).some(x => !x.refused && x.method !== 'LOCAL' && x.method !== 'GET');
      const ended = new Date(now()).toISOString();
      let endMark = null;
      if (wrote && out.ok) endMark = Object.assign({}, mark, { state: 'built', ended: ended });
      else if (wrote) {
        const may = mayExist(plan, out, seed, threw);
        endMark = Object.assign({}, mark, { state: 'failed', failedAt: out.failedAt || null, do: out.do || null, ended: ended,
          // a write that got no answer, a timeout or a 5xx (a read creates nothing: the sixth review)
          noAnswer: threw || (out.results || []).some(x => x.method !== 'GET' && x.method !== 'LOCAL' && (x.threw !== undefined || mayHaveActed(x.status))),
          emailsToFind: may.filter(m => m.kind === 'email').map(m => m.name) });
      }
      // Never write over, or clear, a marker that is not this run's. If the page's storage lost this run's marker (cleared
      // by something else), the run's end marker is written there again; if it holds another run's (not possible while
      // the lock holds, but checked), that one stands, and this one is kept in the page's memory.
      const gone = markerLost(mark);
      let stored = true;
      if (!endMark) { if (!gone) due.clearIf(mark); }
      else if (!gone || due.peek() === null) { if (!due.set(endMark)) { due.hold(endMark); stored = false; } }
      else { due.hold(endMark); stored = false; }
      if (!stored) unstored[name] = true;
      // The run's IDs join the page's refs only once a plain verify passes (v1.01, the second review): an unverified
      // run's objects are never named by a later plan in this page.
      return summary(name, out);
    }

    // A run started in the background, for runs longer than one tool call: start() returns at once, status() polls.
    // A refusal here empties Joe's permissions too, as run()'s do, unless another run is going in this page. A start the
    // lock then refuses (another copy of the builder holds it) answers started, and status() then says error, with why.
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
      // built -> verified (v1.01): a plain verify that passes removes this run's "built" marker, so the next run may
      // start; one that fails, plain or not, turns it into "unverified", which only a reconcile clears. A verify with
      // options that relax it (ignoreName, a status of its own) never counts as a pass: it clears nothing.
      const d = due.get();
      const relaxed = !!opts && Object.keys(opts).some(k => opts[k] !== undefined);
      if (d && d.run === name && d.owner === r.owner && d.state === 'built') {
        if (res.ok && !relaxed) {
          // v1.02 (review of v1.01, N6): what the run made, kept until the ledger holds it, written before the run's marker
          // is cleared, so that at no moment neither holds the next run back (the review of the fixes)
          const made = ids(name);
          let recordKept = true;
          if (Object.keys(made).some(k => !/^position:/.test(k))) {
            // startedAt: when the run began, so the ledger tool can refuse a "first read" saved after it (the fourth review)
            const rec = { run: name, startedAt: d.at || null, verifiedAt: new Date(now()).toISOString(), planSha: r.planSha || null, provenance: provenanceOf(p), ids: made };
            const list = ledgerGate.get().filter(x => x.run !== name).concat([rec]);
            res.unledgered = true;
            if (!ledgerGate.set(list)) {
              // the record is only in this page's memory: the run's built marker stays, so a reload loses neither (the
              // second review of the fixes); once the storage takes the record, a plain verify again counts
              recordKept = false;
              res.unledgeredStored = false;
              res.unledgeredNote = 'the page\'s storage refused the record of what this run made, so the run stays built (a reload must not lose both): ' +
                'free the storage (save VDHSit.journal(), then VDHGuard.clearJournal()) and verify again; write the ledger now either way';
            }
            res.next = 'write VDHSit.ids(\'' + name + '\') into the ledger (pagecmd.py ledger add), write it back to the Project, then send pagecmd.py refs ledger.json: no run starts until the ledger holds this run';
          }
          res.markerCleared = recordKept ? due.clearIf(d) : false;
          // Only this verify, the one that clears the run's built marker, lets the run's own new IDs (never its seed, the
          // ledger's) join the page's refs, for later plans to name; a second verify adds nothing (the second review)
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
      // v1.02 (review of v1.01, N8): whether this verify counted as the run's, and the run's marker after it, so a result is
      // never read as a pass it was not. Only a plain verify that clears the built marker counts.
      const after = due.get();
      res.counted = res.markerCleared === true;
      res.markerState = after && after.run === name && after.owner === r.owner ? after.state : null;
      if (relaxed) res.note = 'a verify with options (' + Object.keys(opts).filter(k => opts[k] !== undefined).join(', ') + ') never counts as the run\'s verify';
      return res;
    }

    // A plan's provenance, short, for the marker and the ledger record (v1.02; review of v1.01, N9)
    function provenanceOf(plan) {
      const pv = plan && plan.provenance;
      if (!pv || typeof pv !== 'object') return null;
      const short = x => (x && typeof x === 'object' ? String(x.file) + '@' + String(x.sha256).slice(0, 12) : null);
      return { compiler: pv.compiler || null, compilerSha: String(pv.compilerSha256 || '').slice(0, 12) || null, mode: pv.mode || null,
        emailSet: pv.emailSet || null, inputs: (pv.inputs || []).map(short), manifest: short(pv.manifest), ledger: short(pv.ledger),
        permissions: short(pv.permissions) };
    }

    // v1.02: the verified runs whose objects the ledger does not hold yet
    function unledgered() {
      const l = ledgerGate.get();
      const out = { durable: ledgerGate.durable(), runs: l.filter(x => !x.foreign).map(x => Object.assign({}, x)) };
      if (ledgerGate.foreign()) out.foreign = 'the storage holds something under ' + UNLEDGERED_KEY + ' that is not the builder\'s list: no run starts until Joe has it removed';
      return out;
    }

    // v1.02: the ledger's refs, and (ledger) every ID and name it holds, by kind, whatever their state: {flows, segments,
    // emails} by ID, {tags, fields} by name (the review of the fixes: IDs without their kind let an email's ID stand for a
    // flow's). A verified run all of whose objects are there is in the ledger now. A record not the builder's never clears.
    // v1.07 (P2): reached only through setRefs, below, which checks the hash of what pagecmd.py refs wrote.
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
      // the answer is what the gate holds now, so it never says a run is in the ledger while the page still waits for it
      // (a storage that refused the clear keeps it; the second review of the fixes)
      const after = ledgerGate.get().map(rec => rec.run);
      return { refs: Object.keys(refs).length, ledgered: cleared.filter(n => after.indexOf(n) === -1), unledgered: after, stored: stored };
    }

    // v1.07 (P2): reconcile and setRefs take their argument as JSON text with its SHA-256 (transport.js checks it)
    const argIn = transport.argIn;

    // {refs, ledger} as pagecmd.py refs writes it; putRefs, above, once the hash matches and the shape is right
    async function setRefs(text, sha) {
      const a = await argIn(text, sha), m = a.arg, obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
      if (a.why) return a;
      if (!obj(m) || !obj(m.refs) || (m.ledger !== undefined && !(obj(m.ledger) && Object.keys(m.ledger).every(k => Array.isArray(m.ledger[k]))))) {
        return { ok: false, why: 'not {refs, ledger} as pagecmd.py refs writes it: nothing changed' };
      }
      return putRefs(m.refs, m.ledger);
    }

    // The IDs this run made, for the ledger: refs whose value differs from what was seeded in (so a rebuild's new flow
    // under a key the ledger holds is kept, and the ledger's own IDs never are), and whose objects the guard saw Encharge
    // create. So a live segment or an earlier run's flow can never land on the delete list. A key the ledger already
    // holds with another ID is a rebuild: the new ID takes the key, and the old entry moves, with its state, to a key of
    // its own (SKILL.md, The ledger).
    function ids(name) {
      const r = need(name), c = G.created();
      const made = { flow: c.flows, step: c.steps, email: c.emails, segment: c.segments };
      const out = {}, all = R.ids(r.out.refs), seed = r.seed || {};
      Object.keys(all).forEach(k => {
        if (Object.prototype.hasOwnProperty.call(seed, k) && String(seed[k]) === String(all[k])) return;
        const kind = k.split(':')[0];
        if (kind === 'position' || (made[kind] || []).indexOf(Number(all[k])) !== -1) out[k] = all[k];
      });
      // Tags and fields have no ID: those this run's own calls asked for, and that Encharge answered it created.
      const sentOk = new Set((r.out.results || []).filter(x => x.status >= 200 && x.status < 300).map(x => x.n));
      (r.plan.calls || []).forEach(call => {
        if (!sentOk.has(call.n)) return;
        if (call.do === 'create-tag') ((call.body && call.body.tags) || []).forEach(t => { if (t && (c.tags || []).indexOf(t.tag) !== -1) out['tag:' + t.tag] = t.tag; });
        if (call.do === 'create-field') (Array.isArray(call.body) ? call.body : []).forEach(f => { if (f && (c.fields || []).indexOf(f.name) !== -1) out['field:' + f.name] = f.name; });
      });
      return out;
    }

    // After a failed or interrupted run, before any rebuild, and at the end of a sitting: every ZZ object in Encharge's
    // own lists (read only), flows, segments, tags and fields, split into those the ledger knows and those it doesn't,
    // so a draft whose create went through while its answer was lost, or that Encharge stored under a changed name,
    // still shows up. known = {flows: [ids], segments: [ids], tags: [names], fields: [names], names: [display names]},
    // as pagecmd.py reconcile writes it from the ledger (and the plans); all four lists are required. Also listed:
    // objects with one of the names given or left by the failed run's plan (a real build's drafts carry no ZZ).
    // missingKnown lists what the ledger knows and the list did not return: something deleted by hand, which the ledger
    // then marks deleted (known.deleted, from pagecmd.py), or a list that came back short (gap A19), which could also hide
    // what a failed run made; stillThere lists what the ledger marks deleted and the list still returns.
    // Emails have no list call: emailsToFind names those a failed run may have made; Joe looks for them by name.
    // ok (resolved) only when all four lists were read and agree with the ledger; only then is the marker cleared
    // (review of v1.00, 5: it used to be cleared once the lists were read, whatever they lacked). It holds the builder's
    // lock throughout, so no run starts in any tab while it reads.
    // v1.07 (P2): known comes as JSON text with its SHA-256, both as pagecmd.py reconcile writes them (argIn, below).
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
      // A built run this page still holds is settled by its verify, never by a reconcile (the second review of v1.01)
      if (d && d.state === 'built' && runs[d.run] && runs[d.run].owner === d.owner) {
        return { ok: false, why: 'run ' + d.run + ' is built and this page holds its record: VDHSit.verify(\'' + d.run + '\') settles it. Reconcile is for a run this page no longer holds (after a reload), or one that failed' };
      }
      const wait = settleCheck(d);
      if (wait) return { ok: false, why: wait };
      d = due.get();
      // the comparison (reconcile.js): Encharge's lists, the ledger, the marker and the session's first reads
      const cmp = await rc.compare(known, d);
      const out = cmp.out, names = cmp.names, objNames = cmp.objNames, made = cmp.made;
      if (d) {
        rc.markerFacts(out, d, made);   // the run, its state, and the emails Joe looks for by name
        out.markerCleared = out.resolved ? due.clearIf(d) : false;
        // a built run this page no longer holds (a reload lost its record) was never verified: its drafts are unverified
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

    // A marker reconcile could not clear, because a list Encharge will not give whole, or the lists and the ledger do not
    // agree in a way only Joe can settle: cleared only after this page's own reconcile of it came back unresolved, on
    // Joe's words in the chat naming the run, once he has checked Encharge by hand. It holds the builder's lock, as
    // reconcile does. The answer carries his words and what the marker held, for the session's record.
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

    // Segment definitions (rows, no people) read through the guard before a run that edits them: kept in the page, and
    // returned in full so the workspace saves a copy outside the tab.
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

    // If a segment edit or its preview failed, or a run is to be undone: that segment (its definition, no people) as it
    // was just before its own edit in the run (beforeEdit, from the read kept under its own id, segments:before:<id>),
    // and before the run (beforeRun, the snapshot). rows, operator and from give beforeEdit, or else beforeRun.
    // (Review of v1.00, 7: the one shared read was overwritten by the next edit's, so a segment edited earlier in the run
    // came back with its new rows.)
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
      // differ: the segment changed between the snapshot and its edit (by hand, or by an earlier run)
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
      // the ledger's refs, replacing the page's (v1.01): an entry the ledger no longer offers (deleted, failed) is gone; with
      // the ledger's IDs and names (v1.02), the verified runs it now holds are cleared. v1.07 (P2): as JSON text with its
      // SHA-256. Nothing pasted changes the page's refs without a hash: addRefs, which merged an object in unchecked and
      // which nothing used, is gone, and so is run's refs option; a run's own new IDs join them, as before, when its plain
      // verify passes
      setRefs: setRefs,
      summary: n => summary(n, need(n).out) };

    // The SHA-256 of each of the nine files as installed (v1.10): pagecmd.py install wraps each file in a function kept on window.__vdhSrc,
    // and a function's source text is exactly what was sent, so any slip in copying changes its hash. current says
    // whether the objects this helper uses are still the ones on window (a reinstalled guard alone would not be).
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

  // v1.10 (P20): the install manifest. pagecmd.py install sends each file wrapped in a function kept on window.__vdhSrc,
  // records the order the files came in (window.__vdhOrder: guard.js starts it), and removes VDHSit; sitting.js's call
  // also carries the manifest (window.__vdhManifest), generated from the package: its build id, and each file in order
  // with the object it makes and the SHA-256 of exactly what the page holds. VDHSit is made only if every file is there,
  // came in that order, once each, made its object, and hashes as the manifest says, and the manifest lists this file's
  // own nine: otherwise there is no VDHSit, and the error says why. The hash is worked out here, at once (sha256sync),
  // so the install's answer is VDHSit's own: "installed sitting.js: object", or the reason there is none.
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
  // the manifest's build id: v1.10 and the first 16 hex of the SHA-256 of "<sha256>  <file>" lines, in order (pagecmd.py)
  const buildOf = files => VERSION + '-' + sha256sync(files.map(f => f.sha256 + '  ' + f.file + '\n').join('')).slice(0, 16);
  // Why this install must not make VDHSit, or null
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
    // Node, for the rehearsals: the helpers on globalThis, as the page has them on window (the storage's two stores, and
    // the transport's sha256, offered here too, as v1.09's sitting.js offered them)
    const S = helper({}, HELPERS[1]), T = helper({}, HELPERS[2]);
    module.exports = { makeSit: makeSit, sha256: T.sha256, dueStore: S.dueStore, listStore: S.listStore, VERSION: VERSION, PAGE_FILES: PAGE_FILES,
      sha256sync: sha256sync, buildOf: buildOf };
  } else {
    const why = installWhy();
    if (why) throw new Error('no VDHSit: ' + why);
    root.VDHSit = makeSit({ guard: root.VDHGuard, runner: root.VDHRunner, verify: root.VDHVerify });
  }
})(typeof window !== 'undefined' ? window : globalThis);
