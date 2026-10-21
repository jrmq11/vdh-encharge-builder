delete window.VDHSit;
delete window.VDHGuard;
window.__vdhOrder = ["guard.js"];
(window.__vdhSrc = window.__vdhSrc || {})["guard.js"] = function () {
/*
 * guard.js -- vdh-encharge-builder
 *
 * Installed in the Encharge page (app.encharge.io, built-in browser pane on Joe's laptop) before any call.
 * Every call goes through VDHGuard.call(method, path, body). The guard refuses anything that is not on the
 * allowed list (references/api-map.md section 1) BEFORE it leaves the page, and records what it refused.
 *
 * - "Created in this session" is learned only from Encharge's own responses to create calls, never from the
 *   caller, so a plan cannot talk the guard into touching an existing flow, step, email or segment.
 * - Content checks repeat the compiler's rules at the wire: protected tags, currentAndFuture segment entry,
 *   End Flow naming a flow outside the build, Archive and Send webhook steps. Each needs a permission entry.
 * - The guard never returns or logs a token, a request body or a response body. Its log holds method, path,
 *   status and the reason for a refusal.
 * - Its journal (v0.4) records each object Encharge says it created, as it happens, in the page's local storage
 *   (shared by every app.encharge.io tab in this browser, and kept until cleared): time, this install's id, kind,
 *   id or name, the name Encharge gave it, and path. It is for reconciling after an interruption, and it never
 *   feeds "created in this session", so a journal cannot open anything to the guard.
 * - Paths come only in the shapes the builder uses (/v1/ and lower-case segments of letters, digits, _ and -, then
 *   plain name=value query pairs) and must be what the browser will send, so no other spelling of a forbidden path
 *   gets through. The body is judged as the text that is sent: it is serialised once, and the parsed copy of that
 *   text is what the checks see.
 * - Create and update bodies carry only their own keys and no id but the path's (a note's own UUID aside); each
 *   step keeps the type Encharge gave it at creation, and each step value must be in the one shape compile.py
 *   writes. Only the step types the builder makes are allowed. An email is never saved over, and a field is
 *   created only after the account's fields were read through the guard, and never one that exists.
 *
 * Honest limit (api-map section 1): this is code Claude installs, not a wall Claude cannot cross. The walls
 * are Encharge's: new flows are created off, and nothing on the allowed list can switch a flow on.
 *
 * Works in the page (window.VDHGuard) and in Node for the offline tests (module.exports.makeGuard).
 */
(function (root) {
  'use strict';

  const API = 'https://api.encharge.io';
  const PROTECTED_TAG = /^(product_|refunded_)|^abandoned_active$/;
  const ROUTER_FIELDS = new Set([
    'mostrecent_abandoned_at', 'mostrecent_abandonedproduct_id', 'mostrecent_abandonedproduct_name',
    'first_channel', 'first_touch_id', 'first_hack', 'first_purchase_at', 'last_purchase_at',
    'requested_template_name', 'requested_template_url',
    'LastLoginDate', 'LoginCount'
  ]);
  const ROUTER_FIELDS_LC = new Set([...ROUTER_FIELDS].map(f => f.toLowerCase()));
  const NEEDS_PERMISSION_OPS = new Set(['/archive', '/send-webhook']);
  // The step types compile.py makes; anything else is refused (Archive and Send webhook only with permission).
  const BUILDER_OPS = new Set(['/added-tag', '/entered-segment', '/event', '/delay-v2', '/send', '/add-tag', '/remove-tag',
    '/check-field', '/end-flow-v2', '/change-field', '/archive', '/send-webhook']);
  const JOURNAL_KEY = 'vdh-encharge-journal', JOURNAL_MAX = 5000;
  // The keys runner.js copies from the master into a new email (capture 2's POST /v1/emails, as the app sends it).
  const EMAIL_KEYS = ['type', 'name', 'isStandalone', 'accountId', 'subject', 'fromEmail', 'fromName', 'html', 'editor', 'previewImage',
    'archived', 'canSpamCompliance', 'communicationCategoryId', 'isDefaultTemplate'];
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  // The page's journal: local storage when it can be used, else memory for this page session. Every access is
  // guarded, so a full or blocked storage can never stop a call. A stored value that is not a journal is never
  // overwritten: entries then stay in memory, and read() says the journal is not durable.
  function pageJournal() {
    let memory = [];
    const store = (() => { try { return root.localStorage || null; } catch (e) { return null; } })();
    const readStored = () => {    // the stored list, [] if none, or null if storage is blocked or holds something else
      if (!store) return null;
      try { const raw = store.getItem(JOURNAL_KEY); if (raw === null) return []; const v = JSON.parse(raw); return Array.isArray(v) ? v : null; } catch (e) { return null; }
    };
    return {
      append: entry => {
        const stored = readStored();
        if (stored) {
          try { store.setItem(JOURNAL_KEY, JSON.stringify(stored.concat(memory, [entry]).slice(-JOURNAL_MAX))); memory = []; return; }
          catch (e) { /* storage full or blocked: keep it in memory */ }
        }
        memory.push(entry);
        memory = memory.slice(-JOURNAL_MAX);
      },
      read: () => { const stored = readStored(); return { durable: !!stored && memory.length === 0, entries: (stored || []).concat(memory) }; },
      clear: () => { memory = []; if (store) { try { store.removeItem(JOURNAL_KEY); } catch (e) { /* blocked */ } } }
    };
  }

  // The path as the browser will send it, or null if the URL parser would change it in any way.
  // Only the shapes the builder uses: /v1/ and lower-case segments of letters, digits, _ and -, then an optional query
  // of plain name=value pairs. So no ;params, dots, escapes or other spellings a browser or a server might re-read.
  function cleanPath(p) {
    if (typeof p !== 'string' || !p.startsWith('/v1/')) return null;
    const cut = p.indexOf('?'), pathname = cut === -1 ? p : p.slice(0, cut), query = cut === -1 ? null : p.slice(cut + 1);
    if (!/^\/v1(\/[a-z0-9_-]+)+\/?$/.test(pathname)) return null;
    if (query !== null && !/^[A-Za-z0-9_]+=[A-Za-z0-9_.,-]*(&[A-Za-z0-9_]+=[A-Za-z0-9_.,-]*)*$/.test(query)) return null;
    let u;
    try { u = new URL(API + p); } catch (e) { return null; }
    return (u.origin === API && u.pathname + u.search === p) ? p : null;
  }

  function makeGuard(opts) {
    opts = opts || {};
    const fetchFn = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    const journal = opts.journal || pageJournal();
    const install = opts.install || (Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36));
    const state = {
      created: { flows: new Set(), steps: new Set(), links: new Set(), emails: new Set(), segments: new Set(),
                 tags: new Set(), fields: new Set() },
      stepOps: new Map(),       // step id -> the type Encharge gave it at creation
      accountFields: null,      // the account's field names (lower case), from the last GET /v1/schemas read through the guard
      permissions: [],          // [{object: "segment:people_in_flow", id: 1257090, action: "patch"}, {object: "tag:product_x", action: "use"}, ...]
      folderFiling: false,      // switched on only if test B3 shows unfiled segments are hidden
      folders: null,            // last GET /v1/folders snapshot, for the append-only check
      auth: { mode: 'cookie' }, // set by probe(); {mode: 'bearer', token: () => string} is kept inside the page
      log: [],
      n: 0
    };

    // A permission names its object and its action exactly (rule 4). A segment or a flow is named by key and by its
    // Encharge id, {"object": "flow:zz_copy", "id": 404886, "action": "end"}, and the guard matches the id; a key
    // written as digits must be that id. Anything else (a tag, a field, an op) must match the object exactly.
    function permitted(object, action) {
      const kind = object.split(':')[0], name = object.slice(kind.length + 1);
      return state.permissions.some(p => {
        if (!p || typeof p.object !== 'string' || p.action !== action) return false;
        if (kind === 'segment' || kind === 'flow') {
          const key = p.object.slice(kind.length + 1);
          return p.object.startsWith(kind + ':') && key !== '' && /^\d+$/.test(name) &&
            p.id !== undefined && p.id !== null && /^\d+$/.test(String(p.id)) && String(p.id) === name &&
            (!/^\d+$/.test(key) || key === name);
        }
        return p.object === object;
      });
    }
    const protectedTag = t => PROTECTED_TAG.test(String(t).trim().toLowerCase());

    function refuse(reason) { return { ok: false, reason: reason }; }
    const OK = { ok: true };

    function idOf(p, re) { const m = p.match(re); return m ? Number(m[1]) : null; }

    // Walk a step's inputFields and collect the values set in it: {"tags": [...], "email.id": 1, ...}
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

    // Content rules for a step, at creation and when configured (repeats compile.py's rules at the wire).
    function checkStepContent(data) {
      const op = data && data.operationKey;
      if (!BUILDER_OPS.has(op)) return refuse('step type ' + op + ' is not one the builder makes');
      const vals = valuesOf(data && data.inputFields);
      if (NEEDS_PERMISSION_OPS.has(op) && !permitted('op:' + op, 'use')) return refuse(op + ' needs express permission');
      // Each value in the one shape compile.py writes; any other spelling (a comma-joined list, a hidden character, a
      // list where a word goes) is refused rather than interpreted.
      if (op === '/add-tag' || op === '/remove-tag') {   // a Tag added trigger only reads its tag
        if (vals.tag !== undefined) return refuse('a tag step lists its tags under "tags"');
        if (vals.tags !== undefined) {
          if (!Array.isArray(vals.tags)) return refuse('a tag step\'s tags are a list of names');
          for (const t of vals.tags) {
            if (typeof t !== 'string' || !/^[a-z0-9_]+$/.test(t)) return refuse('a tag in a step is its snake_case name: ' + JSON.stringify(t));
            if (protectedTag(t) && !permitted('tag:' + t, 'use')) return refuse('protected tag ' + t + ' needs express permission');
          }
        }
      }
      if (op === '/entered-segment' && vals.includePeople !== undefined) {
        if (vals.includePeople === 'currentAndFuture') {
          if (!permitted('includePeople:currentAndFuture', 'use')) return refuse('includePeople currentAndFuture needs express permission');
        } else if (vals.includePeople !== 'future') return refuse('includePeople is "future", or "currentAndFuture" with express permission');
      }
      if (op === '/end-flow-v2' && vals.flowIds !== undefined && vals.flowIds !== '{{encharge.flowId}}') {
        if (typeof vals.flowIds !== 'string' || !/^\d+(,\d+)*$/.test(vals.flowIds)) return refuse('End Flow names this flow, or flows by their IDs');
        for (const id of vals.flowIds.split(',').map(Number)) {
          if (!state.created.flows.has(id) && !permitted('flow:' + id, 'end')) return refuse('End Flow naming flow ' + id + ' (not built in this session) needs express permission');
        }
      }
      if (op === '/change-field' && vals.fieldName !== undefined) {
        if (typeof vals.fieldName !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(vals.fieldName)) return refuse('Update field names one field by its plain name: ' + JSON.stringify(vals.fieldName));
        if (ROUTER_FIELDS_LC.has(vals.fieldName.toLowerCase()) && !permitted('field:' + vals.fieldName, 'set')) {
          return refuse('Update field on router-owned field ' + vals.fieldName + ' needs express permission');
        }
      }
      return OK;
    }

    // Keys a create body may carry; anything else (an id above all) is refused.
    function onlyKeys(body, allowed, what) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse(what + ': the body must be an object');
      const extra = Object.keys(body).filter(k => allowed.indexOf(k) === -1);
      return extra.length ? refuse(what + ' may not carry ' + extra.join(', ')) : OK;
    }

    function check(method, path, body) {
      method = String(method || '').toUpperCase();
      if (typeof path !== 'string' || !path.startsWith('/v1/')) return refuse('path must start with /v1/');
      const p = cleanPath(path);
      if (p === null) return refuse('the path is not written plainly (the browser would change it): ' + JSON.stringify(String(path).slice(0, 80)));
      if (/share-token/.test(p)) return refuse('share-token mints a permanent read link');
      if (/^\/v1\/accounts(\/|$|\?)/.test(p)) return refuse('/v1/accounts: its response holds the API key; accounts/me changes Joe\'s settings');
      if (/^\/v1\/(people|broadcasts)(\/|$|\?)/.test(p)) return refuse('contacts and broadcasts are out of scope');
      if (method === 'DELETE') return refuse('DELETE is never called; cleanup is by hand');

      if (method === 'GET') return OK;

      if (method === 'POST' && p === '/v1/schemas/person/fields') {
        if (!Array.isArray(body) || !body.length) return refuse('fields body must be a non-empty array');
        for (const f of body) {
          if (!f || typeof f.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(f.name)) return refuse('field name must be snake_case: ' + (f && f.name));
          if (f.createdBy !== 'user') return refuse('field createdBy must be "user"');
          if (f.id !== undefined) return refuse('a new field may not carry an id');
          if (ROUTER_FIELDS_LC.has(f.name.toLowerCase())) return refuse('field ' + f.name + ' is written by the FlowMattic routers; the builder never creates it');
          if (!state.accountFields) return refuse('read the account\'s fields (GET /v1/schemas) through the guard before creating one');
          if (state.accountFields.has(f.name.toLowerCase())) return refuse('field ' + f.name + ' already exists in the account');
        }
        return OK;
      }
      if (method === 'POST' && p === '/v1/tags-management') {
        const keys = onlyKeys(body, ['tags'], 'a new tag');
        if (!keys.ok) return keys;
        const tags = Array.isArray(body.tags) ? body.tags : [];
        if (!tags.length) return refuse('no tags in body');
        for (const t of tags) {
          if (!t || typeof t !== 'object' || Object.keys(t).join() !== 'tag' || typeof t.tag !== 'string') return refuse('each new tag is {"tag": "<name>"}');
          if (!/^[a-z0-9_]+$/.test(t.tag)) return refuse('tag name must be snake_case: ' + JSON.stringify(t.tag));
          if (protectedTag(t.tag) && !permitted('tag:' + t.tag, 'create')) return refuse('creating protected tag ' + t.tag + ' needs express permission');
        }
        return OK;
      }
      if (method === 'POST' && p === '/v1/emails') {
        if (body && typeof body === 'object' && body.id !== undefined) return refuse('a new email must not carry an id');
        const keys = onlyKeys(body, EMAIL_KEYS, 'a new email');
        if (!keys.ok) return keys;
        if (body.archived !== false || body.isDefaultTemplate !== false) return refuse('a new email is not archived and not a default template');
        return OK;
      }
      if (method === 'PATCH' && /^\/v1\/emails\/\d+$/.test(p)) return refuse('the builder posts each email finished and never saves over one');
      if (method === 'POST' && (p === '/v1/segments/' || p === '/v1/segments')) return onlyKeys(body, ['name', 'color', 'objectName'], 'a new segment');
      if (method === 'PATCH' && /^\/v1\/segments\/\d+$/.test(p)) {
        const id = idOf(p, /^\/v1\/segments\/(\d+)$/);
        if (!state.created.segments.has(id) && !permitted('segment:' + id, 'patch')) return refuse('segment ' + id + ' is live: editing it needs express permission');
        if (!body || Number(body.id) !== id) return refuse('segment body id must match the path');
        const g = body.conditions;
        if (!g || g.type !== 'group' || (g.operator !== 'and' && g.operator !== 'or') || !Array.isArray(g.conditions) || !g.conditions.length) {
          return refuse('a segment needs one All/Any group with at least one row');
        }
        if (g.conditions.some(r => !r || typeof r !== 'object' || r.type === 'group')) return refuse('segment rows must be one flat group');
        return OK;
      }
      if (method === 'PATCH' && /^\/v1\/folders\/[0-9a-f-]+$/.test(p)) {
        if (!state.folderFiling) return refuse('folder filing is off (switch on only if test B3 shows it is needed)');
        const id = p.split('/').pop();
        const before = state.folders && state.folders.find(f => f.id === id);
        if (!before) return refuse('read /v1/folders through the guard first (append-only check)');
        const next = (body && body.childrenIds) || [];
        const dropped = before.childrenIds.filter(c => next.indexOf(c) === -1);
        if (dropped.length) return refuse('folder patch would drop ' + dropped.length + ' children');
        const added = next.filter(c => before.childrenIds.indexOf(c) === -1);
        const ours = added.every(c => state.created.segments.has(Number(c)) || state.created.emails.has(Number(c)));
        return ours ? OK : refuse('folder patch may only add objects created in this session');
      }
      if (method === 'POST' && p === '/v1/integrations/') {
        const keys = Object.keys(body || {});
        if (keys.length !== 1 || keys[0] !== 'name') return refuse('create flow body must be {name} only');
        return OK;
      }
      if (method === 'PATCH' && /^\/v1\/integrations\/\d+$/.test(p)) {
        const id = idOf(p, /^\/v1\/integrations\/(\d+)$/);
        if (!state.created.flows.has(id)) return refuse('flow ' + id + ' was not created in this session');
        const keys = onlyKeys(body, ['id', 'name', 'status', 'data'], 'a flow settings call');
        if (!keys.ok) return keys;
        if (body.status !== 'deactivated') return refuse('status must be "deactivated": the builder never switches a flow on');
        if (Number(body.id) !== id) return refuse('body id must match the path');
        return OK;
      }
      if (method === 'POST' && p === '/v1/steps/') {
        const keys = onlyKeys(body, ['integrationId', 'serviceId', 'data'], 'a new step');
        if (!keys.ok) return keys;
        if (!state.created.flows.has(Number(body.integrationId))) return refuse('steps may only be added to flows created in this session');
        if (body.serviceId !== 'encharge') return refuse('serviceId must be "encharge"');
        if (body.data && body.data.id !== undefined) return refuse('a new step may not carry an id');
        return checkStepContent(body.data);
      }
      if (method === 'PATCH' && /^\/v1\/steps\/\d+$/.test(p)) {
        const id = idOf(p, /^\/v1\/steps\/(\d+)$/);
        if (!state.created.steps.has(id)) return refuse('step ' + id + ' was not created in this session');
        const keys = onlyKeys(body, ['integrationId', 'serviceId', 'data'], 'a step configure call');
        if (!keys.ok) return keys;
        if (!state.created.flows.has(Number(body.integrationId))) return refuse('step body must name a flow created in this session');
        if (body.data && body.data.id !== undefined) return refuse('a step configure call may not carry an id');
        const op = body.data && body.data.operationKey;
        if (op !== state.stepOps.get(id)) return refuse('step ' + id + ' was created as ' + state.stepOps.get(id) + '; a configure call must keep that type (got ' + op + ')');
        return checkStepContent(body.data);
      }
      if (method === 'POST' && p === '/v1/links/') {
        const keys = onlyKeys(body, ['source', 'target', 'data'], 'a new link');
        if (!keys.ok) return keys;
        if (!state.created.steps.has(Number(body.source)) || !state.created.steps.has(Number(body.target))) {
          return refuse('links may only join steps created in this session');
        }
        return OK;
      }
      if (method === 'POST' && p === '/v1/decorations') {
        if (!body || !state.created.flows.has(Number(body.integrationId))) return refuse('notes may only go on flows created in this session');
        if (typeof body.id !== 'string' || !UUID.test(body.id)) return refuse('a new note carries its own UUID as its id, nothing else');
        return OK;
      }
      return refuse('not on the allowed list: ' + method + ' ' + p);
    }

    // Record what this session created, from Encharge's own responses; and journal it (never read back here).
    // sent is the parsed body that went out: a step's type comes from Encharge's answer, else from the checked body.
    function learn(method, p, json, sent) {
      if (!json) return;
      const note = entry => {
        try { journal.append(Object.assign({ t: new Date().toISOString(), install: install }, entry, { path: p })); } catch (e) { /* never stops a call */ }
      };
      const made = (kind, set, obj) => {
        const id = Number(obj && obj.id);
        if (!Number.isFinite(id)) return;
        set.add(id);
        const e = { kind: kind, id: id };
        if (obj && typeof obj.name === 'string') e.name = obj.name.slice(0, 200);
        note(e);
      };
      if (method === 'POST' && p === '/v1/integrations/' && json.integration) made('flow', state.created.flows, json.integration);
      if (method === 'POST' && p === '/v1/steps/' && json.step) {
        made('step', state.created.steps, json.step);
        const op = (json.step.data && json.step.data.operationKey) || (sent && sent.data && sent.data.operationKey);
        state.stepOps.set(Number(json.step.id), op);
      }
      if (method === 'POST' && p === '/v1/links/' && json.link) made('link', state.created.links, json.link);
      if (method === 'POST' && p === '/v1/emails' && json.email) made('email', state.created.emails, json.email);
      if (method === 'POST' && (p === '/v1/segments/' || p === '/v1/segments') && json.segment) made('segment', state.created.segments, json.segment);
      if (method === 'GET' && p === '/v1/folders') state.folders = json.folders || (Array.isArray(json) ? json : null);
      if (method === 'GET' && p === '/v1/schemas' && Array.isArray(json.objects)) {
        const person = json.objects.find(o => o && o.name === 'person');
        if (person && Array.isArray(person.fields)) state.accountFields = new Set(person.fields.map(f => String(f && f.name).toLowerCase()));
      }
      // Tags and fields have no ID: they are known by name (Encharge's answer lists only those it created).
      const named = (kind, set, name) => {
        if (typeof name !== 'string') return;
        set.add(name);
        note({ kind: kind, name: name });
      };
      if (method === 'POST' && p === '/v1/tags-management' && Array.isArray(json.tags)) json.tags.forEach(t => named('tag', state.created.tags, t && t.tag));
      if (method === 'POST' && p === '/v1/schemas/person/fields' && Array.isArray(json.fields)) {
        json.fields.forEach(f => {
          named('field', state.created.fields, f && f.name);
          if (state.accountFields && f && typeof f.name === 'string') state.accountFields.add(f.name.toLowerCase());   // in the account from now on
        });
      }
    }

    async function call(method, path, body) {
      method = String(method || '').toUpperCase();
      const n = ++state.n;
      // The body is serialised once; the checks judge the parsed copy of exactly the text that is sent.
      let bodyText, sent;
      try {
        bodyText = body === undefined ? undefined : JSON.stringify(body);
        sent = bodyText === undefined ? undefined : JSON.parse(bodyText);
      } catch (e) { bodyText = null; }
      const verdict = bodyText === null ? refuse('the body cannot be sent as JSON') : check(method, path, sent);
      if (!verdict.ok) {
        state.log.push({ n: n, method: method, path: String(path).slice(0, 200), refused: verdict.reason });
        return { ok: false, refused: true, reason: verdict.reason, status: null, json: null };
      }
      if (!fetchFn) throw new Error('no fetch available');
      const headers = { 'Accept': 'application/json' };
      if (bodyText !== undefined) headers['Content-Type'] = 'application/json';
      if (state.auth.mode === 'bearer' && typeof state.auth.token === 'function') headers['Authorization'] = 'Bearer ' + state.auth.token();
      const res = await fetchFn(API + path, {
        method: method, headers: headers, credentials: 'include', body: bodyText
      });
      let json = null;
      const text = await res.text();
      if (text) { try { json = JSON.parse(text); } catch (e) { json = null; } }
      const ok = res.status >= 200 && res.status < 300;
      if (ok) learn(method, path, json, sent);
      state.log.push({ n: n, method: method, path: path, status: res.status });
      return { ok: ok, refused: false, status: res.status, json: json };
    }

    // B0: find out how the page is logged in, without ever returning a token.
    async function probe() {
      const r = await call('GET', '/v1/heartbeat/authenticated');
      if (r.ok) { state.auth = { mode: 'cookie' }; return { mode: 'cookie', status: r.status }; }
      let names = [];
      try { names = Object.keys(root.localStorage || {}).filter(k => /token|auth|jwt|session/i.test(k)); } catch (e) { names = []; }
      return { mode: 'unknown', status: r.status, storageKeyNames: names };
    }

    function useBearerFrom(storageKey) {
      // The token stays inside the page: only a function that reads it is kept.
      state.auth = { mode: 'bearer', token: () => root.localStorage.getItem(storageKey) };
      return { mode: 'bearer', storageKey: storageKey };
    }

    return {
      call: call, check: check, probe: probe, useBearerFrom: useBearerFrom,
      setPermissions: list => { state.permissions = Array.isArray(list) ? list.slice() : []; return state.permissions.length; },
      setFolderFiling: on => { state.folderFiling = !!on; return state.folderFiling; },
      created: () => ({
        flows: [...state.created.flows], steps: [...state.created.steps], links: [...state.created.links],
        emails: [...state.created.emails], segments: [...state.created.segments],
        tags: [...state.created.tags], fields: [...state.created.fields]
      }),
      log: () => state.log.slice(),
      // {durable, install, entries}: durable is false when entries sit in memory only (blocked or foreign storage),
      // so they would not survive a reload; install is this guard's own id, carried by every entry it writes.
      journal: () => { const r = journal.read(); return Object.assign({ install: install }, Array.isArray(r) ? { durable: false, entries: r } : r); },
      clearJournal: () => journal.clear()
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { makeGuard: makeGuard };
  else root.VDHGuard = makeGuard();
})(typeof window !== 'undefined' ? window : globalThis);

};
window.__vdhSrc["guard.js"]();
"installed guard.js: " + typeof window.VDHGuard
