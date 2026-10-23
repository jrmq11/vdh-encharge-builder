/*
 * storage.js -- the page's storage for vdh-encharge-builder's page helper (v1.10, P20: moved out of sitting.js as it stood
 * in v1.09, the code unchanged): the run marker (dueStore) and the record of verified runs the ledger does not hold yet
 * (listStore), each in the page's local storage, with the page's own copy when the storage refuses a write.
 *
 * It only keeps and reads: when a marker is written or cleared, and what a record says, is sitting.js's to decide (the
 * session controller owns a run's lifecycle and every change of its state). Each store is made with the storage it uses
 * (the page's local storage by default), and holds no run state of its own.
 *
 * Installed after policy.js and before transport.js; sitting.js refuses to start without it, or with one of another
 * version. Works in the page (window.VDHStore) and in Node (module.exports).
 */
(function (root) {
  'use strict';

  const VERSION = 'v1.11';

  // The run marker, in the page's local storage, so a reload or a reinstall keeps it. A run writes it before its first
  // call ("running", with an owner token of its own), checks before each call that the stored marker is still its own
  // and stores its heartbeat (beat) anew, and at its end turns it into "built" (every call went well; a passing
  // VDHSit.verify removes it) or "failed" (a write went out, then something failed), or removes it (nothing written).
  // So a run cut short by a reload, a crash or a lost answer leaves it, and no run starts until it is verified or
  // reconcile() has read Encharge's lists and found them agreeing with the ledger. A page that cannot store it (storage
  // blocked or full) starts no run. Every access is guarded; a stored value that is not a marker is never overwritten.
  const DUE_KEY = 'vdh-encharge-reconcile-due';
  function dueStore(storage) {
    let memory = null;
    const store = storage !== undefined ? storage : (() => { try { return root.localStorage || null; } catch (e) { return null; } })();
    const raw = () => { try { return store ? store.getItem(DUE_KEY) : undefined; } catch (e) { return undefined; } };
    const stored = () => {
      if (!store) return undefined;
      try { const r = store.getItem(DUE_KEY); if (r === null) return null; const v = JSON.parse(r); return v && typeof v === 'object' && typeof v.run === 'string' && v.run ? v : undefined; } catch (e) { return undefined; }
    };
    // one run's marker: same run, start and owner (the owner token is v1.01's; a run's own is unique to it)
    const sameRun = (a, b) => !!a && !!b && a.run === b.run && a.at === b.at && a.owner === b.owner;
    // the same marker: that, and the same state
    const same = (a, b) => sameRun(a, b) && a.state === b.state;
    // The page's own copy wins over storage for the same run's marker: it is the newer one whenever the storage refused
    // a write (the second review of v1.01: a full storage kept the page deciding on a stale marker, and wedged it)
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
      // what the page's storage holds: a marker, null for none, undefined when it cannot be read or is not a marker
      peek: stored,
      // true only if the page's storage now holds exactly this marker (it will survive a reload)
      set: v => { memory = v; if (!store || stored() === undefined) return false; try { store.setItem(DUE_KEY, JSON.stringify(v)); } catch (e) { return false; } return kept(v); },
      // this page's memory only, for a marker its storage cannot take: runs stay refused here, but a reload loses it
      hold: v => { memory = v; },
      // removes the marker only if it is still the one given (same run, start, owner and state), never one written
      // since; true only if it is gone
      clearIf: d => (same(get(), d) ? clear() : false),
      // whether the marker there is now is exactly the one the page's storage holds (false when a write was refused)
      durable: () => { const cur = get(); return !!cur && kept(cur); }
    };
  }

  // "Verified, not in the ledger" (v1.02; review of v1.01, N6): each run whose plain verify passed, with what it made, until
  // the ledger's refs show the ledger holds it. In the page's local storage beside the run marker, so a reload keeps it;
  // if the storage refuses it, the page keeps its own copy and says so. A stored value that is not such a list is never
  // overwritten.
  // The records are only ever added by this page's verify, or removed once the ledger holds them; the gate fails shut
  // (the review of the fixes): the page keeps its own copy of what its storage refused and decides on both together, so
  // another tab's record is never hidden by this page's copy; and a value under the key that is not the builder's list
  // holds the gate shut too (it is never overwritten: Joe decides what it is).
  const UNLEDGERED_KEY = 'vdh-encharge-unledgered';
  const FOREIGN_REC = { run: '(not the builder\'s)', foreign: true, ids: {} };
  function listStore(storage) {
    let memory = null;   // this page's own list, newer than the storage's, when the storage refused a write
    const store = storage !== undefined ? storage : (() => { try { return root.localStorage || null; } catch (e) { return null; } })();
    const isRec = x => !!x && typeof x === 'object' && !Array.isArray(x) && typeof x.run === 'string' && x.run !== '' && !!x.ids && typeof x.ids === 'object' && !Array.isArray(x.ids);
    // the storage's list; [] for none; undefined when it cannot be read (blocked, or no storage); FOREIGN_REC when it holds
    // something else under the key
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
      // true only if the page's storage now holds exactly this list (never a foreign value's place)
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
