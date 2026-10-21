delete window.VDHSit;
delete window.VDHStore;
(window.__vdhOrder = window.__vdhOrder || []).push("storage.js");
(window.__vdhSrc = window.__vdhSrc || {})["storage.js"] = function () {
(function (root) {
  'use strict';

  const VERSION = 'v1.11';

  const DUE_KEY = 'vdh-encharge-reconcile-due';
  function dueStore(storage) {
    let memory = null;
    const store = storage !== undefined ? storage : (() => { try { return root.localStorage || null; } catch (e) { return null; } })();
    const raw = () => { try { return store ? store.getItem(DUE_KEY) : undefined; } catch (e) { return undefined; } };
    const stored = () => {
      if (!store) return undefined;
      try { const r = store.getItem(DUE_KEY); if (r === null) return null; const v = JSON.parse(r); return v && typeof v === 'object' && typeof v.run === 'string' && v.run ? v : undefined; } catch (e) { return undefined; }
    };
    const sameRun = (a, b) => !!a && !!b && a.run === b.run && a.at === b.at && a.owner === b.owner;
    const same = (a, b) => sameRun(a, b) && a.state === b.state;
    const get = () => { const s = stored(); return s && memory && sameRun(s, memory) ? memory : (s || memory); };
    const kept = v => { const r = raw(); return typeof r === 'string' && r === JSON.stringify(v); };
    const clear = () => {
      memory = null;
      const s = stored();
      if (!s) return true;                     // nothing of ours in storage (a foreign value is never touched)
      try { store.removeItem(DUE_KEY); } catch (e) { return false; }
      return stored() === null;
    };
    return {
      get: get,
      peek: stored,
      set: v => { memory = v; if (!store || stored() === undefined) return false; try { store.setItem(DUE_KEY, JSON.stringify(v)); } catch (e) { return false; } return kept(v); },
      hold: v => { memory = v; },
      clearIf: d => (same(get(), d) ? clear() : false),
      durable: () => { const cur = get(); return !!cur && kept(cur); }
    };
  }

  const UNLEDGERED_KEY = 'vdh-encharge-unledgered';
  const FOREIGN_REC = { run: '(not the builder\'s)', foreign: true, ids: {} };
  function listStore(storage) {
    let memory = null;   // this page's own list, newer than the storage's, when the storage refused a write
    const store = storage !== undefined ? storage : (() => { try { return root.localStorage || null; } catch (e) { return null; } })();
    const isRec = x => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.run === 'string' && x.run !== '' && !!x.ids && typeof x.ids === 'object' && !Array.isArray(x.ids);
    const stored = () => {
      if (!store) return undefined;
      let r;
      try { r = store.getItem(UNLEDGERED_KEY); } catch (e) { return undefined; }
      if (r === null) return [];
      try { const v = JSON.parse(r); return Array.isArray(v) && v.every(isRec) ? v : FOREIGN_REC; } catch (e) { return FOREIGN_REC; }
    };
    const merge = (a, b) => { const out = a.slice(); b.forEach(x => { if (!out.some(y => y.run === x.run && y.verifiedAt === x.verifiedAt)) out.push(x); }); return out; };
    return {
      get: () => { const s = stored(); const base = s === FOREIGN_REC ? [FOREIGN_REC] : (s || []); return memory ? merge(base, memory) : base; },
      set: list => {
        const mine = list.filter(x => x !== FOREIGN_REC && !x.foreign);
        const s = stored();
        if (!store || s === undefined || s === FOREIGN_REC) { memory = mine; return false; }
        try { store.setItem(UNLEDGERED_KEY, JSON.stringify(mine)); } catch (e) { memory = mine; return false; }
        let back = null;
        try { back = store.getItem(UNLEDGERED_KEY); } catch (e) { back = null; }
        if (back === JSON.stringify(mine)) { memory = null; return true; }
        memory = mine;
        return false;
      },
      durable: () => memory === null && Array.isArray(stored()),
      foreign: () => stored() === FOREIGN_REC
    };
  }

  const VDHStore = { version: VERSION, dueStore: dueStore, listStore: listStore, DUE_KEY: DUE_KEY, UNLEDGERED_KEY: UNLEDGERED_KEY, FOREIGN_REC: FOREIGN_REC };
  if (typeof module !== 'undefined' && module.exports) module.exports = VDHStore;
  else root.VDHStore = VDHStore;
})(typeof window !== 'undefined' ? window : globalThis);

};
window.__vdhSrc["storage.js"]();
"installed storage.js: " + typeof window.VDHStore
