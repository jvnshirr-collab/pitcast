/* projects-ui.js — minimal G4 persistence UI for PitCast.
 *
 * Injects a Projects sidebar + first-run user-name modal + audit log viewer
 * + drag-drop .pitcast/.pitcastz file import. Requires storage.js and audit.js.
 *
 * Sources cited per G4 architecture:
 *   - W3C IndexedDB 3.0 (storage layer)
 *   - JSON Schema 2020-12 (project file format)
 *   - NIST SP 800-53 AU-10 (cryptographic audit binding)
 *   - RFC 8785 JCS (canonical JSON for hash chain)
 */
(function (root) {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  function _getUser() {
    try {
      var raw = localStorage.getItem("pitcast.user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function _setUser(u) { localStorage.setItem("pitcast.user", JSON.stringify(u)); }

  function showFirstRunModal() {
    if (_getUser()) return;
    var modal = document.createElement("div");
    modal.id = "pitcast-firstrun";
    modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center";
    modal.innerHTML = '<div style="background:#0f1d2e;border:1px solid #2dd4bf;border-radius:12px;padding:24px;max-width:420px;color:#e2e8f0"><h3 style="margin:0 0 8px;color:#2dd4bf">Welcome to PitCast Projects</h3><p style="font-size:13px;color:#94a3b8;margin:0 0 14px">Provide your name + initials for the audit trail (stored locally, never transmitted). Per NSPE Code §II.2 + NCEES §240.20 the responsible PE is identified on every calculation.</p><label style="display:block;margin-bottom:10px">Full name<input id="fr-name" type="text" style="width:100%;margin-top:4px;padding:6px 8px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:4px"></label><label style="display:block;margin-bottom:16px">Initials (≤4 chars)<input id="fr-initials" type="text" maxlength="4" style="width:80px;margin-top:4px;padding:6px 8px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:4px"></label><button id="fr-save" style="background:#2dd4bf;color:#000;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600">Save + continue</button></div>';
    document.body.appendChild(modal);
    $("fr-save").onclick = function () {
      var name = $("fr-name").value.trim();
      var initials = $("fr-initials").value.trim().toUpperCase();
      if (!name || !initials) { alert("Please enter name + initials"); return; }
      _setUser({ name: name, initials: initials });
      modal.remove();
    };
  }

  function renderSidebar() {
    var existing = $("pitcast-projects-sidebar");
    if (existing) existing.remove();
    var bar = document.createElement("div");
    bar.id = "pitcast-projects-sidebar";
    bar.style.cssText = "position:fixed;top:60px;right:0;width:280px;height:calc(100vh - 80px);background:#0f1d2e;border-left:1px solid #1e293b;padding:14px;overflow-y:auto;font-size:13px;z-index:100;color:#e2e8f0;transform:translateX(100%);transition:transform 0.2s";
    var user = _getUser();
    bar.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="color:#2dd4bf">Projects</b><button id="pp-close" style="background:transparent;color:#94a3b8;border:0;cursor:pointer;font-size:18px">×</button></div>' +
      '<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">User: ' + (user ? user.name + ' (' + user.initials + ')' : 'anonymous') + '</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:12px"><button id="pp-new" style="flex:1;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.3);padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px">+ New</button><button id="pp-import" style="flex:1;background:rgba(56,189,248,0.15);color:#7dd3fc;border:1px solid rgba(56,189,248,0.3);padding:6px 10px;border-radius:4px;cursor:pointer;font-size:11px">⤓ Import</button></div>' +
      '<input id="pp-search" type="text" placeholder="Search projects..." style="width:100%;padding:6px 8px;background:#1e293b;border:1px solid #334155;color:#e2e8f0;border-radius:4px;font-size:12px;margin-bottom:10px">' +
      '<div id="pp-list"></div>' +
      '<input type="file" id="pp-file-input" accept=".pitcast,.pitcastz" style="display:none">';
    document.body.appendChild(bar);

    var toggle = document.createElement("button");
    toggle.id = "pp-toggle";
    toggle.innerHTML = "📁 Projects";
    toggle.style.cssText = "position:fixed;top:14px;right:10px;background:rgba(45,212,191,0.15);color:#2dd4bf;border:1px solid rgba(45,212,191,0.3);padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;z-index:101";
    document.body.appendChild(toggle);

    var open = false;
    toggle.onclick = function () { open = !open; bar.style.transform = open ? "translateX(0)" : "translateX(100%)"; if (open) refreshList(); };
    $("pp-close").onclick = function () { open = false; bar.style.transform = "translateX(100%)"; };
    $("pp-new").onclick = createNewProject;
    $("pp-import").onclick = function () { $("pp-file-input").click(); };
    $("pp-file-input").onchange = function (e) { handleFileImport(e.target.files[0]); };
    $("pp-search").oninput = refreshList;

    refreshList();
  }

  function refreshList() {
    if (!window.Storage) { $("pp-list").innerHTML = '<div style="color:#94a3b8;font-size:11px">Storage layer not loaded</div>'; return; }
    Storage.listProjects().then(function (list) {
      var q = ($("pp-search") ? $("pp-search").value : "").toLowerCase();
      var filtered = q ? list.filter(function (p) { return (p.name || "").toLowerCase().indexOf(q) >= 0; }) : list;
      if (!filtered.length) { $("pp-list").innerHTML = '<div style="color:#94a3b8;font-size:11px;padding:10px">No projects yet. Click + New to create one.</div>'; return; }
      $("pp-list").innerHTML = filtered.map(function (p) {
        var modDate = p.modified_utc ? p.modified_utc.substring(0, 10) : "?";
        return '<div class="pp-item" data-id="' + p.project_id + '" style="padding:8px 10px;border:1px solid #1e293b;border-radius:4px;margin-bottom:6px;cursor:pointer;background:#1e293b"><div style="font-weight:600;color:#e2e8f0">' + (p.name || "(untitled)") + '</div><div style="font-size:10px;color:#94a3b8;margin-top:2px">' + modDate + ' · ' + (p.calculations ? p.calculations.length : 0) + ' calcs · ' + (p.audit_chain ? p.audit_chain.length : 0) + ' audit</div></div>';
      }).join("");
      document.querySelectorAll(".pp-item").forEach(function (el) {
        el.onclick = function () { openProject(el.dataset.id); };
      });
    });
  }

  function createNewProject() {
    var user = _getUser() || { name: "anonymous", initials: "??" };
    var name = prompt("Project name (asset tag + description):");
    if (!name) return;
    if (!window.Storage) { alert("Storage not loaded"); return; }
    Storage.createProject({ name: name, owner: user }).then(function (id) {
      refreshList();
      console.log("Created project " + id);
    });
  }

  function openProject(id) {
    if (!window.Storage) return;
    Storage.openProject(id).then(function (p) {
      if (!p) { alert("Project not found"); return; }
      window._pitcastActiveProject = p;
      console.log("Opened project: " + p.name);
      showAuditLog(p);
    });
  }

  function showAuditLog(p) {
    var chain = p.audit_chain || [];
    var verify = window.Audit && window.Audit.verify ? Audit.verify(chain) : { ok: null };
    var html = '<div style="background:#1e293b;padding:10px;border-radius:6px;margin-top:10px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><b style="color:#7dd3fc">Audit chain</b><span style="font-size:10px;color:' + (verify.ok ? "#34d399" : verify.ok === false ? "#ef4444" : "#94a3b8") + '">' + (verify.ok ? "✓ verified" : verify.ok === false ? "✗ tamper" : "—") + '</span></div>';
    if (!chain.length) html += '<div style="color:#94a3b8;font-size:11px">no entries</div>';
    chain.slice(-10).forEach(function (e) {
      html += '<div style="font-size:10px;color:#94a3b8;border-bottom:1px solid #334155;padding:3px 0">' + (e.ts || "").substring(11, 19) + ' · ' + (e.user || "?") + ' · ' + (e.action || "?") + '</div>';
    });
    html += '</div>';
    $("pp-list").insertAdjacentHTML("afterend", '<div id="pp-audit-log">' + html + '</div>');
  }

  function handleFileImport(file) {
    if (!file || !window.Storage) return;
    Storage.importProject(file).then(function (id) {
      alert("Imported project: " + id);
      refreshList();
    }).catch(function (err) {
      alert("Import failed: " + err.message);
    });
  }

  function init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", _doInit);
    } else {
      _doInit();
    }
  }
  function _doInit() {
    // No blocking first-run modal — the app loads straight to the tool. Projects opens
    // on demand (anonymous by default); identity is optional and never gates use, and
    // there is no PE / audit-trail ceremony on entry.
    renderSidebar();
    // Drag-drop on body
    document.body.addEventListener("dragover", function (e) { e.preventDefault(); });
    document.body.addEventListener("drop", function (e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleFileImport(e.dataTransfer.files[0]);
      }
    });
  }

  var ProjectsUI = { init: init, _getUser: _getUser, _setUser: _setUser, refreshList: refreshList };
  root.ProjectsUI = ProjectsUI;
  if (typeof module !== "undefined" && module.exports) module.exports = ProjectsUI;
})(typeof window !== "undefined" ? window : this);
