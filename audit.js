/*
 * PitCast — audit.js
 * ---------------------------------------------------------------------------
 * Tamper-evident SHA-256 hash-chain primitive for the PitCast project audit
 * trail. Implements the minimum credible cryptographic-binding requirement
 * documented in:
 *
 *   - NIST SP 800-53 Rev. 5, AU-10 (Non-Repudiation): "The information
 *     system protects against an individual falsely denying having
 *     performed a particular action." Cryptographic chaining of audit
 *     records is the canonical primitive.
 *   - IEC 62443-3-3:2013, SR 2.8 (Auditable Events), SR 2.9 (Audit Storage
 *     Capacity), SR 2.10 (Response to Audit Processing Failures),
 *     SR 2.11 (Timestamps), SR 2.12 (Non-Repudiation): mandates
 *     append-only, source-attributable, time-stamped audit records.
 *   - 21 CFR Part 11 §11.10(e): tamper-evident audit trails. PitCast does
 *     NOT claim 21 CFR Part 11 compliance — this primitive merely follows
 *     the same well-understood pattern.
 *   - RFC 8785 (March 2020), JSON Canonicalization Scheme (JCS). The
 *     canonicalize() function below implements the subset required for
 *     deterministic hashing of audit entries (sorted keys, no whitespace,
 *     standard JSON escaping). Numbers are emitted via JSON.stringify
 *     which conforms to ECMAScript ToString(Number) — RFC 8785 §3.2.2.
 *   - Haber & Stornetta (1991), "How to time-stamp a digital document",
 *     J. Cryptol. 3(2):99-111 — the hash-chain primitive foundation.
 *   - W3C Web Cryptography API (Rec. 2017-01-26), §15 SubtleCrypto.digest:
 *     supplies SHA-256 in every modern browser since ~2014.
 *
 * Threat model:
 *   - Detects: post-hoc edit, insertion, deletion, or reordering of any
 *     prior audit entry. Re-computing hashes downstream from a tampered
 *     entry exposes the modification iff at least one downstream hash is
 *     anchored outside the file (PitCast prints the head hash on every
 *     exported PDF; the on-record PDF is the trusted external anchor —
 *     same primitive as Certificate Transparency, RFC 6962).
 *   - Does NOT prove WHEN an entry was written (no trusted timestamp
 *     authority; clock comes from local browser).
 *   - Does NOT prove WHO wrote it (v1 stores user.initials in plaintext;
 *     a future v2 ECDSA keypair stored in the user's password manager
 *     would close this gap — out of scope here).
 *
 * Public surface:
 *   window.Audit = {
 *     append(chain, entry) -> Promise<chain>     // appends with new hash
 *     verify(chain)        -> Promise<{ok, breakAt, reason}>
 *     canonicalize(obj)    -> string             // RFC 8785 subset
 *     headHash(chain)      -> string             // for PDF anchoring
 *     genesisHash()        -> string             // "0".repeat(64)
 *   };
 *
 * No external dependencies. Browser-only (uses crypto.subtle, TextEncoder).
 * ---------------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  /** Genesis hash sentinel — 64 hex zeros (32 zero bytes). */
  const GENESIS = "0".repeat(64);

  /**
   * Convert an ArrayBuffer / Uint8Array to lowercase hex.
   * @param {ArrayBuffer|Uint8Array} buf
   * @returns {string} hex-encoded
   */
  function _hex(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let out = "";
    for (let i = 0; i < b.length; i++) {
      const h = b[i].toString(16);
      out += h.length === 1 ? "0" + h : h;
    }
    return out;
  }

  /**
   * SHA-256 of a UTF-8 string, returned as lowercase hex.
   * Delegates to W3C Web Crypto SubtleCrypto.digest.
   * @param {string} s
   * @returns {Promise<string>} 64-char hex digest
   */
  async function sha256Hex(s) {
    if (!global.crypto || !global.crypto.subtle) {
      throw new Error("Audit: Web Crypto SubtleCrypto unavailable (insecure context?)");
    }
    const bytes = new TextEncoder().encode(s);
    const digest = await global.crypto.subtle.digest("SHA-256", bytes);
    return _hex(digest);
  }

  /**
   * RFC 8785 JSON Canonicalization Scheme (subset sufficient for audit
   * entries). Rules implemented:
   *   - Objects: keys sorted lexicographically by UTF-16 code unit
   *     (matches Array.prototype.sort default, which matches RFC 8785
   *     §3.2.3 since JSON keys are UTF-16 in JavaScript).
   *   - Arrays: element order preserved (RFC 8785 §3.2.1).
   *   - Strings: emitted via JSON.stringify which performs the standard
   *     RFC 8259 §7 escaping required by RFC 8785 §3.2.2.2.
   *   - Numbers: emitted via JSON.stringify (ECMAScript ToString) which
   *     conforms to RFC 8785 §3.2.2.3 / RFC 7493 I-JSON for finite
   *     numbers in the safe integer / IEEE-754 range we use here.
   *   - Booleans / null: literal "true" / "false" / "null".
   *   - undefined / function / symbol: SKIPPED (matches JSON.stringify);
   *     callers must not include such values in audit entries.
   *   - No whitespace anywhere (RFC 8785 §3.2.1).
   *
   * NOTE: RFC 8785 mandates specific handling for non-integer numbers
   * (canonical decimal expansion). For audit entries we treat numbers
   * conservatively — callers SHOULD pre-round floats they care about
   * before adding them to the entry. PitCast audit entries are
   * dominated by strings (paths, IDs, timestamps, user initials) and
   * small integers (sequence numbers), so this subset is sufficient.
   *
   * @param {*} value any JSON-serialisable value
   * @returns {string} canonical JSON
   */
  function canonicalize(value) {
    if (value === null) return "null";
    const t = typeof value;
    if (t === "boolean") return value ? "true" : "false";
    if (t === "number") {
      if (!Number.isFinite(value)) {
        throw new Error("Audit.canonicalize: non-finite number is not JSON-representable");
      }
      // JSON.stringify(0) === "0"; JSON.stringify(-0) === "0"; matches RFC 8785 §3.2.2.3.
      return JSON.stringify(value);
    }
    if (t === "string") return JSON.stringify(value); // escapes per RFC 8259 §7
    if (t === "undefined" || t === "function" || t === "symbol") {
      // JSON.stringify also skips these inside arrays (with null) / objects
      // (omitted). We choose omit at object-level, null at array-level.
      return "null";
    }
    if (Array.isArray(value)) {
      const parts = new Array(value.length);
      for (let i = 0; i < value.length; i++) {
        const v = value[i];
        const tv = typeof v;
        if (v === undefined || tv === "function" || tv === "symbol") {
          parts[i] = "null";
        } else {
          parts[i] = canonicalize(v);
        }
      }
      return "[" + parts.join(",") + "]";
    }
    if (t === "object") {
      // Object: sort keys lexicographically, skip undefined/function/symbol values.
      const keys = Object.keys(value).sort();
      const parts = [];
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        const v = value[k];
        const tv = typeof v;
        if (v === undefined || tv === "function" || tv === "symbol") continue;
        parts.push(JSON.stringify(k) + ":" + canonicalize(v));
      }
      return "{" + parts.join(",") + "}";
    }
    throw new Error("Audit.canonicalize: unsupported type " + t);
  }

  /**
   * Append an entry to a hash chain.
   *
   * The new entry is mutated to receive {seq, prev_hash, hash}. The chain
   * (an Array) is mutated by push and returned for convenience.
   *
   *   H_n = SHA256( canonicalize({ ...entry, seq, prev_hash }) )
   *
   * The hash field itself is deliberately EXCLUDED from the canonical
   * pre-image — otherwise hashing would be a fixed-point search.
   *
   * @param {Array} chain the audit chain (Array of prior entries)
   * @param {Object} entry the new entry; must NOT already have hash / prev_hash / seq
   * @returns {Promise<Array>} the (mutated) chain
   */
  async function append(chain, entry) {
    if (!Array.isArray(chain)) throw new Error("Audit.append: chain must be an array");
    if (!entry || typeof entry !== "object") throw new Error("Audit.append: entry must be an object");
    const seq = chain.length;
    const prev_hash = seq === 0 ? GENESIS : chain[seq - 1].hash;
    // Build canonical pre-image WITHOUT the hash field.
    const preimage = Object.assign({}, entry, { seq: seq, prev_hash: prev_hash });
    // Strip a hash field if the caller accidentally pre-set one.
    if ("hash" in preimage) delete preimage.hash;
    const canonical = canonicalize(preimage);
    const hash = await sha256Hex(canonical);
    // Persist seq + prev_hash + hash onto the stored record.
    const record = Object.assign({}, entry, {
      seq: seq,
      prev_hash: prev_hash,
      hash: hash,
    });
    chain.push(record);
    return chain;
  }

  /**
   * Recompute every hash in the chain and verify it matches the stored
   * value AND the prev_hash linkage is correct.
   *
   * Return shape:
   *   { ok: true,  breakAt: -1, reason: null }                    // valid
   *   { ok: false, breakAt: <index>, reason: "<diagnostic>" }     // tampered
   *
   * Per NIST SP 800-53 AU-10: failure to verify indicates the audit
   * record has been altered, deleted, or reordered post-write.
   *
   * @param {Array} chain
   * @returns {Promise<{ok:boolean, breakAt:number, reason:string|null}>}
   */
  async function verify(chain) {
    if (!Array.isArray(chain)) {
      return { ok: false, breakAt: -1, reason: "chain is not an array" };
    }
    if (chain.length === 0) {
      return { ok: true, breakAt: -1, reason: null };
    }
    let expectedPrev = GENESIS;
    for (let i = 0; i < chain.length; i++) {
      const rec = chain[i];
      if (!rec || typeof rec !== "object") {
        return { ok: false, breakAt: i, reason: "entry is not an object" };
      }
      if (rec.seq !== i) {
        return { ok: false, breakAt: i, reason: "seq mismatch (expected " + i + ", got " + rec.seq + ")" };
      }
      if (rec.prev_hash !== expectedPrev) {
        return { ok: false, breakAt: i, reason: "prev_hash linkage broken" };
      }
      // Recompute hash from the stored entry (minus the hash field).
      const preimageObj = Object.assign({}, rec);
      delete preimageObj.hash;
      const canonical = canonicalize(preimageObj);
      const recomputed = await sha256Hex(canonical);
      if (recomputed !== rec.hash) {
        return { ok: false, breakAt: i, reason: "hash mismatch (entry mutated)" };
      }
      expectedPrev = rec.hash;
    }
    return { ok: true, breakAt: -1, reason: null };
  }

  /**
   * Return the current head hash, suitable for embedding in an exported
   * PDF footer. The PDF-on-record then anchors the chain externally.
   *
   * @param {Array} chain
   * @returns {string} 64-char hex digest, or GENESIS for empty chains
   */
  function headHash(chain) {
    if (!Array.isArray(chain) || chain.length === 0) return GENESIS;
    return chain[chain.length - 1].hash;
  }

  /** @returns {string} the genesis sentinel (64 hex zeros). */
  function genesisHash() {
    return GENESIS;
  }

  const Audit = {
    append: append,
    verify: verify,
    canonicalize: canonicalize,
    headHash: headHash,
    genesisHash: genesisHash,
    _sha256Hex: sha256Hex, // exposed for tests
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = Audit;
  }
  if (typeof global !== "undefined") {
    global.Audit = Audit;
  }
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
