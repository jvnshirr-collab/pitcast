/*
 * PitCast — storage.js
 * ---------------------------------------------------------------------------
 * IndexedDB project-persistence wrapper for PitCast (pitcast.austenite.org).
 *
 * Implements PLAN-tier3.md Gap G4: a four-object-store persistence layer
 * (`projects` / `calculations` / `audit` / `attachments`) backed by the
 * browser-native W3C Indexed Database API. Pairs with audit.js (hash-chain
 * primitive) and schema/project-v1.json (file format).
 *
 * References:
 *   - W3C Indexed Database API 3.0 (W3C Working Draft 2024-09-18,
 *     https://www.w3.org/TR/IndexedDB-3/) — §2 Concepts; §3 IDBFactory;
 *     §6 transactions; §13 errors (QuotaExceededError, ConstraintError).
 *   - W3C Storage API (Living Std, https://storage.spec.whatwg.org/) —
 *     §3.4 navigator.storage.persist() for best-effort eviction protection.
 *   - HTML Living Standard §13 (https://html.spec.whatwg.org/) —
 *     CompressionStream('gzip') / DecompressionStream('gzip') for the
 *     `.pitcastz` export path.
 *   - NIST SP 800-53 Rev. 5, AU-10 — Non-Repudiation (audit binding).
 *   - IEC 62443-3-3:2013, SR 2.8–2.12 — auditable events.
 *   - RFC 8785 (March 2020), JSON Canonicalization Scheme (delegated to
 *     audit.js).
 *
 * Public surface:
 *   window.Storage = {
 *     init()                              -> Promise<void>
 *     createProject(meta)                 -> Promise<project>
 *     openProject(id)                     -> Promise<project>
 *     saveProject(p)                      -> Promise<project>     // bumps modified_utc
 *     listProjects()                      -> Promise<Array<meta>> // sorted modified_utc desc
 *     deleteProject(id)                   -> Promise<void>        // removes calc + audit + attachments too
 *     appendCalculation(projectId, calc)  -> Promise<calc>
 *     appendAudit(projectId, entry)       -> Promise<entry>
 *     attachBlob(projectId, blob, meta)   -> Promise<attachment>
 *     getAttachmentBlob(projectId, attId) -> Promise<Blob>
 *     exportProject(id, gzipped=false)    -> Promise<Blob>
 *     importProject(blob)                 -> Promise<project>     // ALWAYS imports as new (fork)
 *     verifyAudit(projectId)              -> Promise<{ok,breakAt,reason}>
 *     gc(projectId)                       -> Promise<{removed}>
 *     newId()                             -> string               // ULID
 *   };
 *
 * Storage footprint (per PLAN-tier3.md): ~120 MB / asset for a
 * 200-defect pipeline with 5 yrs monthly recalc. Comfortable on Chrome
 * (~60% disk quota), tight on Safari (1 GB / origin). `persist()` is
 * called from init() to request eviction protection.
 *
 * No external dependencies. Browser-only.
 * ---------------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  const DB_NAME = "pitcast";
  const DB_VERSION = 1;
  const STORE_PROJECTS = "projects";
  const STORE_CALCS = "calculations";
  const STORE_AUDIT = "audit";
  const STORE_ATTACHMENTS = "attachments";

  const FORMAT = "pitcast-project";
  const FORMAT_VERSION = "1.0.0";
  const SCHEMA_URL = "https://pitcast.austenite.org/schema/project-v1.json";

  /** Crockford base32 alphabet (RFC-spec ULID; excludes I L O U). */
  const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

  /**
   * Tiny ULID generator (Crockford base32, lexicographically sortable).
   * Format: 10-char ms-timestamp + 16-char random = 26 chars.
   * See https://github.com/ulid/spec — sortable IDs without the UUID v4 churn.
   * Uses crypto.getRandomValues for the random tail (CSPRNG).
   * @returns {string} 26-character ULID
   */
  function newId() {
    let now = Date.now();
    const ts = new Array(10);
    for (let i = 9; i >= 0; i--) {
      ts[i] = ULID_ALPHABET[now % 32];
      now = Math.floor(now / 32);
    }
    const rand = new Uint8Array(16);
    if (global.crypto && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(rand);
    } else {
      for (let i = 0; i < 16; i++) rand[i] = Math.floor(Math.random() * 256);
    }
    let tail = "";
    for (let i = 0; i < 16; i++) tail += ULID_ALPHABET[rand[i] % 32];
    return ts.join("") + tail;
  }

  // ---------------------------------------------------------------------------
  // Database handle (lazy open)
  // ---------------------------------------------------------------------------
  let _dbPromise = null;

  /**
   * Open (and upgrade if needed) the PitCast IndexedDB database.
   * Creates the four object stores on first run.
   * @returns {Promise<IDBDatabase>}
   */
  function _openDB() {
    if (_dbPromise) return _dbPromise;
    if (!global.indexedDB) {
      _dbPromise = Promise.reject(new Error("Storage: IndexedDB not available in this browser"));
      return _dbPromise;
    }
    _dbPromise = new Promise(function (resolve, reject) {
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (e) {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
          // Per W3C IDB §3.2 createObjectStore — keyPath = "project_id".
          const s = db.createObjectStore(STORE_PROJECTS, { keyPath: "project_id" });
          s.createIndex("modified_utc", "modified_utc", { unique: false });
          s.createIndex("name", "name", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CALCS)) {
          const s = db.createObjectStore(STORE_CALCS, { keyPath: "calc_id" });
          s.createIndex("project_id", "project_id", { unique: false });
          s.createIndex("project_seq", ["project_id", "seq"], { unique: true });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIT)) {
          const s = db.createObjectStore(STORE_AUDIT, { keyPath: "audit_id" });
          s.createIndex("project_id", "project_id", { unique: false });
          s.createIndex("project_seq", ["project_id", "seq"], { unique: true });
        }
        if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
          const s = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: "id" });
          s.createIndex("project_id", "project_id", { unique: false });
        }
      };
      req.onsuccess = function () {
        const db = req.result;
        // Surface unexpected version-change events (other tab upgrading) so
        // we close cleanly rather than throwing inside an in-flight tx.
        db.onversionchange = function () { try { db.close(); } catch (_) {} _dbPromise = null; };
        resolve(db);
      };
      req.onerror = function () { reject(req.error || new Error("Storage: IndexedDB open failed")); };
      req.onblocked = function () {
        reject(new Error("Storage: IndexedDB upgrade blocked by another tab — close other PitCast tabs and retry"));
      };
    });
    return _dbPromise;
  }

  /**
   * Wrap an IDBRequest in a Promise. Maps QuotaExceededError to a
   * friendly message per W3C IDB §13.
   * @param {IDBRequest} req
   * @returns {Promise<*>}
   */
  function _req(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () {
        const err = req.error || new Error("IndexedDB request failed");
        if (err && (err.name === "QuotaExceededError" || (err.code === 22))) {
          const friendly = new Error(
            "PitCast: browser storage quota exceeded. Free space by deleting old projects, " +
            "or export to .pitcastz and offload. (See navigator.storage.estimate() for current usage.)"
          );
          friendly.cause = err;
          friendly.name = "QuotaExceededError";
          reject(friendly);
        } else {
          reject(err);
        }
      };
    });
  }

  /**
   * Wrap an IDBTransaction's completion in a Promise.
   * @param {IDBTransaction} tx
   * @returns {Promise<void>}
   */
  function _tx(tx) {
    return new Promise(function (resolve, reject) {
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error || new Error("Transaction failed")); };
      tx.onabort = function () { reject(tx.error || new Error("Transaction aborted")); };
    });
  }

  // ---------------------------------------------------------------------------
  // Public init
  // ---------------------------------------------------------------------------

  /**
   * One-shot initialiser. Opens the DB and best-effort calls
   * navigator.storage.persist() (W3C Storage API §3.4) — granted on
   * sites the user has bookmarked / installed / engaged with; declined
   * silently otherwise (does NOT throw).
   * @returns {Promise<{persisted:boolean, quota:number, usage:number}>}
   */
  async function init() {
    await _openDB();
    const out = { persisted: false, quota: 0, usage: 0 };
    try {
      if (global.navigator && global.navigator.storage) {
        if (typeof global.navigator.storage.persist === "function") {
          try { out.persisted = !!(await global.navigator.storage.persist()); } catch (_) { out.persisted = false; }
        }
        if (typeof global.navigator.storage.estimate === "function") {
          try {
            const est = await global.navigator.storage.estimate();
            out.quota = est.quota || 0;
            out.usage = est.usage || 0;
          } catch (_) { /* ignore */ }
        }
      }
    } catch (_) { /* never throw from init for persist/estimate failures */ }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Project CRUD
  // ---------------------------------------------------------------------------

  /**
   * Build a fresh project skeleton conforming to schema/project-v1.json.
   * @param {Object} meta caller-supplied fields (name, owner, asset, ...)
   * @returns {Object} the bare project
   */
  function _skeleton(meta) {
    const now = new Date().toISOString();
    const m = meta || {};
    return {
      $schema: SCHEMA_URL,
      format: FORMAT,
      format_version: FORMAT_VERSION,
      project_id: m.project_id || newId(),
      name: m.name || "Untitled PitCast project",
      created_utc: m.created_utc || now,
      modified_utc: now,
      owner: m.owner || { name: "", initials: "", pe_stamp: null },
      asset: m.asset || {
        tag: "",
        type: "other",
        material_uns: "",
        service: {},
      },
      calculations: [],
      audit_chain: [],
      attachments: [],
    };
  }

  /**
   * Create a new project record and persist its skeleton.
   * Also writes the first audit entry (`create_project`).
   * @param {Object} meta
   * @returns {Promise<Object>} the newly-created project (fully hydrated)
   */
  async function createProject(meta) {
    const proj = _skeleton(meta);
    const db = await _openDB();
    const tx = db.transaction([STORE_PROJECTS], "readwrite");
    tx.objectStore(STORE_PROJECTS).put(proj);
    await _tx(tx);
    // Append the genesis audit entry. Done outside the create tx so
    // the chain hash lives in its own store row.
    await appendAudit(proj.project_id, {
      ts: new Date().toISOString(),
      user: (proj.owner && proj.owner.initials) || "",
      action: "create_project",
      path: "",
      before: null,
      after: {
        name: proj.name,
        owner: proj.owner,
        asset: proj.asset,
      },
    });
    // Re-fetch so the returned project includes the audit_chain entry.
    return openProject(proj.project_id);
  }

  /**
   * Load a project by ID, hydrating its calculations and audit_chain
   * arrays from their respective stores (sorted by seq ascending).
   * Attachments are returned as metadata only — call getAttachmentBlob
   * separately to retrieve binary payload.
   * @param {string} id ULID project_id
   * @returns {Promise<Object>}
   */
  async function openProject(id) {
    if (!id) throw new Error("Storage.openProject: id required");
    const db = await _openDB();
    const tx = db.transaction([STORE_PROJECTS, STORE_CALCS, STORE_AUDIT, STORE_ATTACHMENTS], "readonly");
    const proj = await _req(tx.objectStore(STORE_PROJECTS).get(id));
    if (!proj) throw new Error("Storage.openProject: project not found: " + id);
    const calcs = await _req(tx.objectStore(STORE_CALCS).index("project_id").getAll(id));
    const audits = await _req(tx.objectStore(STORE_AUDIT).index("project_id").getAll(id));
    const atts = await _req(tx.objectStore(STORE_ATTACHMENTS).index("project_id").getAll(id));
    await _tx(tx);
    calcs.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    audits.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    proj.calculations = calcs.map(_stripWrapper);
    proj.audit_chain = audits.map(_stripWrapper);
    proj.attachments = atts.map(function (a) {
      // Hide the raw blob from the public attachment listing — callers
      // use getAttachmentBlob() to retrieve binary payload.
      return {
        id: a.id,
        filename: a.filename,
        sha256: a.sha256,
        size_bytes: a.size_bytes,
        ref: a.ref,
        mime: a.mime || null,
        created_utc: a.created_utc,
      };
    });
    return proj;
  }

  /**
   * Strip the storage-only wrapper fields from a stored row so the
   * exported project conforms exactly to the JSON schema.
   * @private
   */
  function _stripWrapper(row) {
    const out = Object.assign({}, row);
    delete out.project_id; // wrapper key; project-level only
    delete out.audit_id;
    delete out.calc_id_internal;
    return out;
  }

  /**
   * Persist an updated project header. Bumps modified_utc. Does NOT
   * rewrite calculations / audit_chain / attachments — use the
   * dedicated append/attach methods for those (they hash-chain).
   * @param {Object} p project object
   * @returns {Promise<Object>} the saved project
   */
  async function saveProject(p) {
    if (!p || !p.project_id) throw new Error("Storage.saveProject: project_id required");
    const db = await _openDB();
    const tx = db.transaction([STORE_PROJECTS], "readwrite");
    const existing = await _req(tx.objectStore(STORE_PROJECTS).get(p.project_id));
    const merged = existing ? Object.assign({}, existing) : _skeleton({ project_id: p.project_id });
    // Copy header fields only — calculations / audit_chain / attachments are
    // managed by their dedicated stores. Treat the passed `p` as the
    // authoritative project header.
    const headerKeys = ["$schema", "format", "format_version", "name", "created_utc", "owner", "asset"];
    headerKeys.forEach(function (k) { if (k in p) merged[k] = p[k]; });
    merged.project_id = p.project_id;
    merged.modified_utc = new Date().toISOString();
    tx.objectStore(STORE_PROJECTS).put(merged);
    await _tx(tx);
    return openProject(p.project_id);
  }

  /**
   * List all project headers, sorted by modified_utc DESCENDING.
   * Returns the lightweight header only (no calc/audit/attachment arrays).
   * @returns {Promise<Array<Object>>}
   */
  async function listProjects() {
    const db = await _openDB();
    const tx = db.transaction([STORE_PROJECTS], "readonly");
    const all = await _req(tx.objectStore(STORE_PROJECTS).getAll());
    await _tx(tx);
    all.sort(function (a, b) {
      const ka = a.modified_utc || "";
      const kb = b.modified_utc || "";
      // Lexicographic DESC works for ISO-8601 UTC strings.
      if (kb > ka) return 1;
      if (kb < ka) return -1;
      return 0;
    });
    return all.map(function (p) {
      return {
        project_id: p.project_id,
        name: p.name,
        created_utc: p.created_utc,
        modified_utc: p.modified_utc,
        owner: p.owner,
        asset: p.asset,
      };
    });
  }

  /**
   * Delete a project and all its associated calculations, audit entries,
   * and attachments. Irreversible from this layer (no soft-delete).
   * @param {string} id
   * @returns {Promise<void>}
   */
  async function deleteProject(id) {
    if (!id) throw new Error("Storage.deleteProject: id required");
    const db = await _openDB();
    const tx = db.transaction(
      [STORE_PROJECTS, STORE_CALCS, STORE_AUDIT, STORE_ATTACHMENTS],
      "readwrite"
    );
    tx.objectStore(STORE_PROJECTS).delete(id);
    await _deleteByIndex(tx.objectStore(STORE_CALCS), "project_id", id);
    await _deleteByIndex(tx.objectStore(STORE_AUDIT), "project_id", id);
    await _deleteByIndex(tx.objectStore(STORE_ATTACHMENTS), "project_id", id);
    await _tx(tx);
  }

  /**
   * Delete every row in `store` where `indexName === key`.
   * @private
   */
  function _deleteByIndex(store, indexName, key) {
    return new Promise(function (resolve, reject) {
      const idx = store.index(indexName);
      const cursorReq = idx.openCursor(IDBKeyRange.only(key));
      cursorReq.onsuccess = function () {
        const c = cursorReq.result;
        if (c) { c.delete(); c.continue(); } else { resolve(); }
      };
      cursorReq.onerror = function () { reject(cursorReq.error || new Error("cursor failed")); };
    });
  }

  // ---------------------------------------------------------------------------
  // Calculations + audit + attachments
  // ---------------------------------------------------------------------------

  /**
   * Append a calculation snapshot to a project. Auto-assigns a ULID
   * calc_id and per-project sequence number. Bumps project.modified_utc.
   * @param {string} projectId
   * @param {Object} calc shape per schema/project-v1.json#calculations
   * @returns {Promise<Object>} the stored calculation row (with calc_id, seq)
   */
  async function appendCalculation(projectId, calc) {
    if (!projectId) throw new Error("Storage.appendCalculation: projectId required");
    if (!calc || typeof calc !== "object") throw new Error("Storage.appendCalculation: calc must be an object");
    const db = await _openDB();
    const tx = db.transaction([STORE_PROJECTS, STORE_CALCS], "readwrite");
    const seq = await _nextSeq(tx.objectStore(STORE_CALCS), projectId);
    const row = Object.assign({
      calc_id: calc.calc_id || newId(),
      timestamp_utc: calc.timestamp_utc || new Date().toISOString(),
    }, calc, {
      project_id: projectId,
      seq: seq,
    });
    tx.objectStore(STORE_CALCS).put(row);
    // Bump modified_utc on the header.
    const headerStore = tx.objectStore(STORE_PROJECTS);
    const head = await _req(headerStore.get(projectId));
    if (head) {
      head.modified_utc = new Date().toISOString();
      headerStore.put(head);
    }
    await _tx(tx);
    return _stripWrapper(row);
  }

  /**
   * Append an audit-trail entry. Computes the SHA-256 chain hash via
   * audit.js (which delegates to Web Crypto SubtleCrypto).
   *
   * Concurrency: hash computation happens BEFORE the IDB transaction
   * opens, because crypto.subtle.digest is async and IDB transactions
   * auto-commit on the microtask queue if no in-flight requests exist
   * (W3C IDB §3.2.5). Serialise within a project by ensuring this
   * function is called sequentially per project — the unique
   * [project_id, seq] index ensures a duplicate seq attempt aborts.
   *
   * @param {string} projectId
   * @param {Object} entry { ts, user, action, path?, before, after }
   * @returns {Promise<Object>} the stored audit row
   */
  async function appendAudit(projectId, entry) {
    if (!projectId) throw new Error("Storage.appendAudit: projectId required");
    if (!entry || typeof entry !== "object") throw new Error("Storage.appendAudit: entry must be an object");
    if (!global.Audit) throw new Error("Storage.appendAudit: window.Audit not loaded (include audit.js first)");

    // Read current chain (just the seq/hash fields needed) to derive prev_hash.
    const db = await _openDB();
    const readTx = db.transaction([STORE_AUDIT], "readonly");
    const existing = await _req(readTx.objectStore(STORE_AUDIT).index("project_id").getAll(projectId));
    await _tx(readTx);
    existing.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });

    // Build the in-memory chain in the canonical (exportable) shape so
    // Audit.append produces the same hash whether the chain was built
    // in-memory or re-hydrated from IDB.
    const chain = existing.map(_stripWrapper);
    const fresh = {
      ts: entry.ts || new Date().toISOString(),
      user: entry.user || "",
      action: entry.action || "unknown",
    };
    if ("path" in entry) fresh.path = entry.path;
    if ("before" in entry) fresh.before = entry.before;
    if ("after" in entry) fresh.after = entry.after;
    // Pass through any caller-supplied diagnostic fields (e.g. fork_of, note).
    Object.keys(entry).forEach(function (k) {
      if (!(k in fresh) && k !== "seq" && k !== "prev_hash" && k !== "hash") {
        fresh[k] = entry[k];
      }
    });
    await global.Audit.append(chain, fresh);
    const newRec = chain[chain.length - 1]; // now has seq/prev_hash/hash

    // Persist + bump modified_utc in one transaction.
    const writeTx = db.transaction([STORE_PROJECTS, STORE_AUDIT], "readwrite");
    writeTx.objectStore(STORE_AUDIT).put(Object.assign({
      audit_id: newId(),
      project_id: projectId,
    }, newRec));
    const headerStore = writeTx.objectStore(STORE_PROJECTS);
    const head = await _req(headerStore.get(projectId));
    if (head) {
      head.modified_utc = new Date().toISOString();
      headerStore.put(head);
    }
    await _tx(writeTx);
    return newRec;
  }

  /**
   * Attach a binary blob to a project. Computes SHA-256 of the bytes
   * and stores both the blob and its metadata. Does NOT auto-emit an
   * audit entry — call appendAudit() separately if you want to record
   * the attachment in the audit trail.
   *
   * @param {string} projectId
   * @param {Blob} blob the binary payload
   * @param {Object} meta { filename, mime? }
   * @returns {Promise<Object>} { id, filename, sha256, size_bytes, ref, mime, created_utc }
   */
  async function attachBlob(projectId, blob, meta) {
    if (!projectId) throw new Error("Storage.attachBlob: projectId required");
    if (!(blob instanceof Blob)) throw new Error("Storage.attachBlob: blob must be a Blob");
    const m = meta || {};
    const id = "att_" + newId();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const hashBuf = await global.crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(hashBuf)).map(function (b) {
      const h = b.toString(16); return h.length === 1 ? "0" + h : h;
    }).join("");
    const record = {
      id: id,
      project_id: projectId,
      filename: m.filename || "attachment.bin",
      sha256: sha256,
      size_bytes: blob.size,
      mime: m.mime || blob.type || "application/octet-stream",
      ref: "indexeddb://blob/" + id,
      blob: blob,
      created_utc: new Date().toISOString(),
    };
    const db = await _openDB();
    const tx = db.transaction([STORE_PROJECTS, STORE_ATTACHMENTS], "readwrite");
    tx.objectStore(STORE_ATTACHMENTS).put(record);
    const headerStore = tx.objectStore(STORE_PROJECTS);
    const head = await _req(headerStore.get(projectId));
    if (head) {
      head.modified_utc = new Date().toISOString();
      headerStore.put(head);
    }
    await _tx(tx);
    return {
      id: record.id,
      filename: record.filename,
      sha256: record.sha256,
      size_bytes: record.size_bytes,
      ref: record.ref,
      mime: record.mime,
      created_utc: record.created_utc,
    };
  }

  /**
   * Retrieve an attachment's binary blob.
   * @param {string} projectId
   * @param {string} attId
   * @returns {Promise<Blob>}
   */
  async function getAttachmentBlob(projectId, attId) {
    if (!projectId || !attId) throw new Error("Storage.getAttachmentBlob: projectId + attId required");
    const db = await _openDB();
    const tx = db.transaction([STORE_ATTACHMENTS], "readonly");
    const rec = await _req(tx.objectStore(STORE_ATTACHMENTS).get(attId));
    await _tx(tx);
    if (!rec) throw new Error("Storage.getAttachmentBlob: attachment not found: " + attId);
    if (rec.project_id !== projectId) {
      throw new Error("Storage.getAttachmentBlob: attachment does not belong to project");
    }
    return rec.blob;
  }

  /**
   * Compute the next sequence number for a project + store. Uses the
   * compound [project_id, seq] index opened DESC and reads only the
   * first cursor result. O(log n) lookup; falls back to 0 if no rows.
   * @private
   */
  function _nextSeq(store, projectId) {
    return new Promise(function (resolve, reject) {
      const idx = store.index("project_seq");
      const range = IDBKeyRange.bound([projectId, -Infinity], [projectId, Infinity]);
      const cursorReq = idx.openCursor(range, "prev");
      cursorReq.onsuccess = function () {
        const c = cursorReq.result;
        resolve(c ? ((c.value.seq || 0) + 1) : 0);
      };
      cursorReq.onerror = function () { reject(cursorReq.error || new Error("seq cursor failed")); };
    });
  }

  // ---------------------------------------------------------------------------
  // Export / import
  // ---------------------------------------------------------------------------

  /**
   * Export a project as a Blob. The serialised form is the JSON file
   * defined by schema/project-v1.json. Attachments are inlined as
   * base64 strings under `attachments_inline` (the exported file is
   * self-contained); the schema's `ref` field still says
   * "indexeddb://blob/<id>" for backward-compat, but consumers should
   * prefer `attachments_inline[id].data_b64` when present.
   *
   * @param {string} id
   * @param {boolean} [gzipped=false] if true, gzip via CompressionStream
   * @returns {Promise<Blob>} the serialised project
   */
  async function exportProject(id, gzipped) {
    const proj = await openProject(id);
    // Inline attachments. We hold the blobs alongside the JSON envelope.
    const inline = {};
    for (let i = 0; i < proj.attachments.length; i++) {
      const a = proj.attachments[i];
      try {
        const blob = await getAttachmentBlob(id, a.id);
        inline[a.id] = {
          mime: a.mime || blob.type || "application/octet-stream",
          data_b64: await _blobToBase64(blob),
        };
      } catch (e) { /* skip missing */ }
    }
    proj.attachments_inline = inline;
    const json = JSON.stringify(proj, null, 2);
    const jsonBlob = new Blob([json], { type: "application/vnd.pitcast.project+json" });
    if (!gzipped) return jsonBlob;
    // Gzip via WHATWG Streams CompressionStream (HTML Living Standard).
    if (typeof global.CompressionStream !== "function") {
      throw new Error("Storage.exportProject: CompressionStream not supported in this browser; export uncompressed instead");
    }
    const compressed = jsonBlob.stream().pipeThrough(new global.CompressionStream("gzip"));
    const buf = await new Response(compressed).arrayBuffer();
    return new Blob([buf], { type: "application/vnd.pitcast.project+gzip" });
  }

  /**
   * Import a project from a Blob. Auto-detects gzip via magic bytes
   * 0x1f 0x8b (RFC 1952 §2.3.1). ALWAYS creates a new project_id and
   * records a fork-of audit entry — never overwrites an existing project
   * (Plan G4: "Never auto-overwrite open project").
   *
   * @param {Blob} blob
   * @returns {Promise<Object>} the newly-imported (fork) project
   */
  async function importProject(blob) {
    if (!(blob instanceof Blob)) throw new Error("Storage.importProject: blob required");
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    let jsonText;
    if (head.length >= 2 && head[0] === 0x1f && head[1] === 0x8b) {
      if (typeof global.DecompressionStream !== "function") {
        throw new Error("Storage.importProject: gzipped input but DecompressionStream unsupported in this browser");
      }
      const decompressed = blob.stream().pipeThrough(new global.DecompressionStream("gzip"));
      jsonText = await new Response(decompressed).text();
    } else {
      jsonText = await blob.text();
    }
    let imported;
    try { imported = JSON.parse(jsonText); }
    catch (e) { throw new Error("Storage.importProject: invalid JSON — " + e.message); }
    if (!imported || imported.format !== FORMAT) {
      throw new Error("Storage.importProject: not a PitCast project file (format = " +
        (imported && imported.format) + ")");
    }
    // Fork: brand-new project_id; preserve original payload under fork_of.
    const originalId = imported.project_id;
    const forkId = newId();
    const now = new Date().toISOString();
    const forkMeta = {
      project_id: forkId,
      name: (imported.name || "Imported project") + " (imported)",
      owner: imported.owner || { name: "", initials: "", pe_stamp: null },
      asset: imported.asset || { tag: "", type: "other", material_uns: "", service: {} },
      created_utc: now,
    };
    // Create the empty shell + first audit entry (create_project).
    await createProject(forkMeta);
    // Append a fork-of audit entry that anchors the imported chain head.
    const importedAuditHead = global.Audit.headHash(imported.audit_chain || []);
    await appendAudit(forkId, {
      ts: now,
      user: (forkMeta.owner && forkMeta.owner.initials) || "",
      action: "fork_import",
      path: "",
      before: null,
      after: {
        fork_of_project_id: originalId,
        fork_of_audit_head_hash: importedAuditHead,
        imported_calc_count: (imported.calculations || []).length,
        imported_audit_count: (imported.audit_chain || []).length,
        imported_attachment_count: (imported.attachments || []).length,
      },
    });
    // Replay calculations as opaque snapshots — they keep their original
    // calc_id and timestamp but get fresh per-project seq numbers.
    const calcs = imported.calculations || [];
    for (let i = 0; i < calcs.length; i++) {
      await appendCalculation(forkId, Object.assign({}, calcs[i]));
    }
    // Replay imported audit entries as data-only "imported_audit" entries
    // under the NEW chain — we do NOT re-use the original hashes (those
    // were valid only under the original chain). The original chain is
    // pinned by the fork_import entry above.
    const imp = imported.audit_chain || [];
    for (let i = 0; i < imp.length; i++) {
      const orig = imp[i];
      await appendAudit(forkId, {
        ts: orig.ts || now,
        user: orig.user || "",
        action: "imported_audit",
        path: orig.path || "",
        before: null,
        after: {
          original_seq: orig.seq,
          original_action: orig.action,
          original_hash: orig.hash,
          original_prev_hash: orig.prev_hash,
          original_before: orig.before,
          original_after: orig.after,
        },
      });
    }
    // Replay attachments if inlined.
    const att = imported.attachments || [];
    const inline = imported.attachments_inline || {};
    for (let i = 0; i < att.length; i++) {
      const a = att[i];
      const inl = inline[a.id];
      if (inl && inl.data_b64) {
        try {
          const bytes = _base64ToBytes(inl.data_b64);
          const b = new Blob([bytes], { type: inl.mime || a.mime || "application/octet-stream" });
          await attachBlob(forkId, b, { filename: a.filename, mime: inl.mime || a.mime });
        } catch (_) { /* skip corrupt */ }
      }
    }
    return openProject(forkId);
  }

  /**
   * Verify a project's audit chain (delegates to audit.js).
   * @param {string} projectId
   * @returns {Promise<{ok:boolean, breakAt:number, reason:string|null}>}
   */
  async function verifyAudit(projectId) {
    if (!projectId) throw new Error("Storage.verifyAudit: projectId required");
    if (!global.Audit) throw new Error("Storage.verifyAudit: window.Audit not loaded");
    const db = await _openDB();
    const tx = db.transaction([STORE_AUDIT], "readonly");
    const rows = await _req(tx.objectStore(STORE_AUDIT).index("project_id").getAll(projectId));
    await _tx(tx);
    rows.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    const chain = rows.map(_stripWrapper);
    return global.Audit.verify(chain);
  }

  /**
   * Garbage-collect a project's calculation snapshots, keeping only the
   * latest per `module` key. Audit entries are NEVER pruned (their
   * integrity rests on the immutable chain). Attachments are kept iff
   * still referenced by a remaining calculation OR an audit entry.
   *
   * @param {string} projectId
   * @returns {Promise<{removed:number, kept:number}>}
   */
  async function gc(projectId) {
    if (!projectId) throw new Error("Storage.gc: projectId required");
    const db = await _openDB();
    const tx = db.transaction([STORE_CALCS], "readwrite");
    const calcStore = tx.objectStore(STORE_CALCS);
    const rows = await _req(calcStore.index("project_id").getAll(projectId));
    rows.sort(function (a, b) { return (a.seq || 0) - (b.seq || 0); });
    const latestByModule = {};
    rows.forEach(function (r) { latestByModule[r.module || "<unknown>"] = r.calc_id; });
    let removed = 0, kept = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (latestByModule[r.module || "<unknown>"] === r.calc_id) {
        kept++;
      } else {
        calcStore.delete(r.calc_id);
        removed++;
      }
    }
    await _tx(tx);
    return { removed: removed, kept: kept };
  }

  // ---------------------------------------------------------------------------
  // base64 helpers (browser-native btoa/atob; chunked for large blobs)
  // ---------------------------------------------------------------------------

  function _blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        const s = reader.result || "";
        const comma = s.indexOf(",");
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      reader.onerror = function () { reject(reader.error || new Error("FileReader failed")); };
      reader.readAsDataURL(blob);
    });
  }

  function _base64ToBytes(b64) {
    const bin = global.atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---------------------------------------------------------------------------
  // Public export
  // ---------------------------------------------------------------------------

  const Storage = {
    init: init,
    createProject: createProject,
    openProject: openProject,
    saveProject: saveProject,
    listProjects: listProjects,
    deleteProject: deleteProject,
    appendCalculation: appendCalculation,
    appendAudit: appendAudit,
    attachBlob: attachBlob,
    getAttachmentBlob: getAttachmentBlob,
    exportProject: exportProject,
    importProject: importProject,
    verifyAudit: verifyAudit,
    gc: gc,
    newId: newId,
    // exposed constants for the schema validator + tests:
    DB_NAME: DB_NAME,
    FORMAT: FORMAT,
    FORMAT_VERSION: FORMAT_VERSION,
    SCHEMA_URL: SCHEMA_URL,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Storage;
  if (typeof global !== "undefined") global.Storage = Storage;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
