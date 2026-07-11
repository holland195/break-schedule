function renderStaff() {
    var e = isLeader(currentUser) || isTraining(currentUser);
    e || "schedule" === staffSubTab || (staffSubTab = "schedule");
    var t = function(e) {
        return "padding:9px 24px;font-size:13px;font-weight:600;cursor:pointer;border:none;background:none;color:" + (staffSubTab === e ? "var(--accent)" : "var(--text2)") + ";border-bottom:3px solid " + (staffSubTab === e ? "var(--accent)" : "transparent") + ";margin-bottom:-2px;transition:all .12s;";
    };
    return `\n<div class="page-header">\n  <div><div class="page-title">Staff</div></div>\n</div>\n<div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">\n  ${e ? `<button onclick="staffSubTab='info';nav('staff')" style="${t("info")}">👤 Staff Info</button>` : ""}\n  <button onclick="staffSubTab='schedule';nav('staff')" style="${t("schedule")}">📅 Staff Schedule</button>\n  ${e ? `<button onclick="staffSubTab='attendance';nav('staff')" style="${t("attendance")}">📋 Staff Attendance</button>` : ""}\n  ${e ? `<button onclick="staffSubTab='workingtime';nav('staff')" style="${t("workingtime")}">⏱ Working Time</button>` : ""}\n</div>\n<div id="staff-subtab-content">\n  ${"info" === staffSubTab ? _renderStaffInfo() : "attendance" === staffSubTab ? _renderStaffAttendance() : "workingtime" === staffSubTab ? _renderWorkingTime() : _renderStaffSchedule()}\n</div>`;
}

function _renderStaffInfo() {
    const e = Object.entries(state.staffInfo || {}).map(([e, t]) => ({
        username: e,
        ...t
    })).sort(_roleSort), t = staffFilters._info || "", a = e.filter(e => !t || (e.name || "").toLowerCase().includes(t.toLowerCase()) || (e.username || "").toLowerCase().includes(t.toLowerCase()) || (e.empNo || "").toLowerCase().includes(t.toLowerCase()) || (_resolveRole(e.role, e.team) || "").toLowerCase().includes(t.toLowerCase())), n = _renderStaffInfoRows(t);
    return document.getElementById("modal-staff-info") || document.body.insertAdjacentHTML("beforeend", _staffInfoModalHTML()), 
    `\n<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap;">\n  <input class="filter-input" style="width:260px;" placeholder="Search name, username, emp#, role…"\n    value="${t}"\n    oninput="staffFilters._info=this.value;document.getElementById('staff-info-tbody').innerHTML=_renderStaffInfoRows(this.value)">\n  <span style="font-size:11px;color:var(--text3);">${a.length} records</span>\n  ${isTraining(currentUser) ? '\n  <div style="margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">\n    <button class="btn btn-accent btn-sm" onclick="openStaffInfoModal(null)" style="font-size:11px;">+ Add Staff</button>\n    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;">\n      <input type="file" id="excel-file-input" accept=".xlsx,.xls" style="font-size:11px;max-width:200px;">\n    </label>\n    <button class="btn btn-accent btn-sm" onclick="importExcelStaffInfo()">Import Excel</button>\n    <div id="excel-import-status" style="font-size:11px;min-width:160px;"></div>\n  </div>' : ""}\n</div>\n<div class="staff-tbl-wrap">\n  <table>\n    <thead>\n      <tr>\n        <th style="text-align:center;width:52px;background:var(--bg3);">ACTIVE</th><th style="width:90px;background:var(--bg3);">EMP#</th><th style="background:var(--bg3);">FULL NAME</th><th style="background:var(--bg3);">USERNAME</th><th style="text-align:center;width:60px;background:var(--bg3);">GENDER</th><th style="background:var(--bg3);">DATE OF BIRTH</th><th style="background:var(--bg3);">POSITION</th><th style="background:var(--bg3);">PHONE</th>${isTraining(currentUser) ? '<th style="width:80px;text-align:center;background:var(--bg3);">ACTIONS</th>' : ""}\n      </tr>\n    </thead>\n    <tbody id="staff-info-tbody">${n}</tbody>\n  </table>\n</div>`;
}

function _renderStaffInfoRows(e) {
    const t = Object.entries(state.staffInfo || {}).map(([e, t]) => ({
        username: e,
        ...t
    })).filter(e => _resolveRole(e.role, e.team)).sort(_roleSort), a = (e || "").toLowerCase();
    return t.filter(e => !a || (e.name || "").toLowerCase().includes(a) || (e.username || "").toLowerCase().includes(a) || (e.empNo || "").toLowerCase().includes(a) || (_resolveRole(e.role, e.team) || "").toLowerCase().includes(a)).map(e => {
        var t = "F" === e.gender ? '<span style="color:var(--A-color);font-size:15px;" title="Female">♀</span>' : "M" === e.gender ? '<span style="color:var(--B-color);font-size:15px;" title="Male">♂</span>' : '<span style="color:var(--text3);font-size:11px;">—</span>', a = _roleColor(e.role, e.team), n = e.empNo || "—", r = e.dob || "—", o = e.phone || "—", s = !1 !== e.active, i = isTraining(currentUser) ? `<button onclick="toggleStaffActive('${e.username}')"\n           title="${s ? "Click to deactivate" : "Click to activate"}"\n           style="background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:6px;\n                  color:${s ? "var(--ok)" : "var(--err)"};font-size:15px;transition:opacity .1s;"\n           onmouseover="this.style.opacity='.6'" onmouseout="this.style.opacity='1'">●</button>` : `<span style="color:${s ? "var(--ok)" : "var(--err)"};font-size:14px;" title="${s ? "Active" : "Inactive"}">●</span>`, l = isTraining(currentUser) ? "<button onclick=\"openStaffInfoModal('" + e.username + '\')" title="Edit" style="background:none;border:none;cursor:pointer;padding:2px 5px;font-size:13px;color:var(--accent);border-radius:4px;" onmouseover="this.style.background=\'rgba(31,102,241,.1)\'" onmouseout="this.style.background=\'none\'">✎</button><button onclick="deleteStaffInfo(\'' + e.username + '\')" title="Delete" style="background:none;border:none;cursor:pointer;padding:2px 5px;font-size:13px;color:var(--err);border-radius:4px;" onmouseover="this.style.background=\'rgba(220,38,38,.1)\'" onmouseout="this.style.background=\'none\'">✕</button>' : "";
        return '<tr style="' + (s ? "" : "opacity:0.45;") + '"><td style="text-align:center;vertical-align:middle;">' + i + '</td><td class="mono" style="font-size:11px;color:var(--text3);">' + n + '</td><td style="font-weight:600;">' + (e.name || "—") + '</td><td class="mono" style="color:var(--accent);font-size:11px;">' + e.username + '</td><td style="text-align:center;vertical-align:middle;">' + t + "</td><td style=\"font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);\">" + r + '</td><td style="font-size:11px;color:' + a + ';font-weight:500;">' + (getRoleInfo(e.role, e.team).label || _resolveRole(e.role, e.team) || "—") + "</td><td style=\"font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--text2);\">" + o + "</td>" + (isTraining(currentUser) ? '<td style="text-align:center;white-space:nowrap;">' + l + "</td>" : "") + "</tr>";
    }).join("");
}

function toggleStaffActive(e) {
    if (state.staffInfo[e]) {
        var t = !1 !== state.staffInfo[e].active;
        state.staffInfo[e].active = !t, syncPush();
        var a = document.getElementById("staff-info-tbody");
        a && (a.innerHTML = _renderStaffInfoRows(staffFilters._info || ""));
    }
}

function _staffInfoModalHTML() {
    return '<div id="modal-staff-info" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-staff-info\')"><div class="modal" style="width:500px;"><div class="modal-title" id="sif-modal-title">Add Staff</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin:16px 0;"><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Full Name *</label><input id="sif-name" class="filter-input" style="width:100%;" placeholder="Nguyen Van A"></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Username *</label><input id="sif-username" class="filter-input" style="width:100%;" placeholder="a.nguyen"></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Emp #</label><input id="sif-empno" class="filter-input" style="width:100%;" placeholder="1234"></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Team</label><input id="sif-team" class="filter-input" style="width:100%;" placeholder="SR1"></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Position *</label><select id="sif-role" class="login-select" style="width:100%;">' + Object.keys(ROLES).map(function(e) {
        return '<option value="' + e + '">' + (ROLES[e].label || e) + "</option>";
    }).join("") + '</select></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Gender</label><select id="sif-gender" class="login-select" style="width:100%;"><option value="">—</option><option value="M">Male</option><option value="F">Female</option></select></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Date of Birth</label><input id="sif-dob" class="filter-input" style="width:100%;" placeholder="DD/MM/YYYY"></div><div><label style="font-size:11px;color:var(--text2);display:block;margin-bottom:4px;">Phone</label><input id="sif-phone" class="filter-input" style="width:100%;" placeholder="09xxxxxxxx"></div></div><div id="sif-error" style="font-size:11px;color:var(--err);min-height:16px;margin-bottom:8px;"></div><div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn" onclick="closeModal(\'modal-staff-info\')">Cancel</button><button class="btn btn-accent" onclick="saveStaffInfoModal()">Save</button></div></div></div>';
}

var _sifEditingUsername = null;

function openStaffInfoModal(e) {
    document.getElementById("modal-staff-info") || document.body.insertAdjacentHTML("beforeend", _staffInfoModalHTML()), 
    _sifEditingUsername = e || null, document.getElementById("sif-modal-title").textContent = e ? "Edit Staff" : "Add Staff", 
    document.getElementById("sif-error").textContent = "";
    var t = document.getElementById("sif-username");
    if (e) {
        var a = state.staffInfo[e] || {};
        document.getElementById("sif-name").value = a.name || "", t.value = e, t.disabled = !0, 
        document.getElementById("sif-empno").value = a.empNo || "", document.getElementById("sif-team").value = a.team || "", 
        document.getElementById("sif-role").value = _resolveRole(a.role, a.team) || a.role || "Data Analyst", 
        document.getElementById("sif-gender").value = a.gender || "", document.getElementById("sif-dob").value = a.dob || "", 
        document.getElementById("sif-phone").value = a.phone || "";
    } else document.getElementById("sif-name").value = "", t.value = "", t.disabled = !1, 
    document.getElementById("sif-empno").value = "", document.getElementById("sif-team").value = "", 
    document.getElementById("sif-role").value = "Data Analyst", document.getElementById("sif-gender").value = "", 
    document.getElementById("sif-dob").value = "", document.getElementById("sif-phone").value = "";
    document.getElementById("modal-staff-info").classList.add("show");
}

function saveStaffInfoModal() {
    var e = (document.getElementById("sif-name").value || "").trim(), t = _sifEditingUsername || (document.getElementById("sif-username").value || "").trim().toLowerCase(), a = (document.getElementById("sif-empno").value || "").trim(), n = (document.getElementById("sif-team").value || "").trim(), r = document.getElementById("sif-role").value, o = document.getElementById("sif-gender").value, s = (document.getElementById("sif-dob").value || "").trim(), i = (document.getElementById("sif-phone").value || "").trim(), l = document.getElementById("sif-error");
    if (e) if (t) if (_sifEditingUsername || !state.staffInfo[t]) {
        state.staffInfo || (state.staffInfo = {});
        var d = state.staffInfo[t] || {};
        state.staffInfo[t] = Object.assign({}, d, {
            name: e,
            role: r,
            team: n,
            active: !1 !== d.active
        }), a && (state.staffInfo[t].empNo = a), o && (state.staffInfo[t].gender = o), s && (state.staffInfo[t].dob = s), 
        i && (state.staffInfo[t].phone = i);
        for (var p = -1, c = 0; c < state.users.length; c++) if (state.users[c].username === t) {
            p = c;
            break;
        }
        if (p >= 0) state.users[p].name = e, state.users[p].role = r, state.users[p].team = n, 
        a && (state.users[p].empNo = a), o && (state.users[p].gender = o), s && (state.users[p].dob = s), 
        i && (state.users[p].phone = i); else {
            for (var f = 0, u = 0; u < t.length; u++) f = (f << 5) - f + t.charCodeAt(u), f |= 0;
            state.users.push({
                id: Math.abs(f),
                username: t,
                name: e,
                role: r,
                team: n,
                empNo: a,
                gender: o,
                dob: s,
                phone: i,
                active: !0
            });
        }
        syncPush(), closeModal("modal-staff-info"), nav("staff");
    } else l.textContent = "Username already exists."; else l.textContent = "Username is required."; else l.textContent = "Full name is required.";
}

function deleteStaffInfo(e) {
    if (e && state.staffInfo[e]) {
        var t = state.staffInfo[e].name || e;
        if (confirm("Delete " + t + "? Their break and attendance records are kept.")) {
            delete state.staffInfo[e];
            for (var a = 0; a < state.users.length; a++) if (state.users[a].username === e) {
                state.users.splice(a, 1);
                break;
            }
            syncPush(), nav("staff");
        }
    }
}

let _tempImportedUsers = [];

function _buildImportSplitHTML(e) {
    const t = VISIBLE_SHIFTS.filter(t => e.has(t)).map(e => {
        const t = BREAK_SLOTS[e] || [], a = getBreakSplitPct(e), n = null !== a ? a : 50, r = 100 - n, o = null !== a;
        return `\n<div style="margin-bottom:12px;">\n  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">\n    <span style="font-size:12px;font-weight:700;">Shift ${e}</span>\n    <span style="font-size:10px;padding:2px 8px;border-radius:8px;font-weight:600;\n      background:${o ? "var(--accent)" : "var(--bg3)"};\n      color:${o ? "#fff" : "var(--text3)"};">\n      ${o ? `Custom ${n}%/${r}%` : "Default (50/50 rotation)"}\n    </span>\n  </div>\n  <div style="display:flex;align-items:center;gap:8px;">\n    <span style="font-size:10px;color:var(--text2);min-width:90px;white-space:nowrap;">${e}1 ${t[0] || ""}</span>\n    <input type="range" id="import-split-slider-${e}" min="0" max="100" step="1" value="${n}"\n      style="flex:1;accent-color:var(--accent);"\n      oninput="onImportSplitSlide('${e}',this.value)">\n    <span style="font-size:10px;color:var(--text2);min-width:90px;text-align:right;white-space:nowrap;">${e}2 ${t[1] || ""}</span>\n  </div>\n  <div style="display:flex;justify-content:space-between;margin-top:2px;">\n    <span id="import-split-lbl-${e}-1" style="font-size:12px;font-weight:700;color:var(--accent);">${n}%</span>\n    <span id="import-split-lbl-${e}-2" style="font-size:12px;font-weight:700;color:var(--accent);">${r}%</span>\n  </div>\n</div>`;
    }).join("");
    return t ? `\n<div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px;background:var(--bg2);">\n  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);margin-bottom:10px;font-family:'IBM Plex Mono',monospace;">\n    Break Distribution\n  </div>\n  <div style="font-size:11px;color:var(--text2);margin-bottom:12px;line-height:1.6;">\n    Drag a slider to change the group size ratio for a shift. Rotation still applies — groups swap slots each week. Changes are saved for future imports.\n    Full settings: <b>Arrange Breaks → 📐 Break Split</b>.\n  </div>\n  ${t}\n</div>` : "";
}

function onImportSplitSlide(e, t) {
    const a = parseInt(t), n = 100 - a, r = document.getElementById(`import-split-lbl-${e}-1`), o = document.getElementById(`import-split-lbl-${e}-2`);
    r && (r.textContent = `${a}%`), o && (o.textContent = `${n}%`);
    const s = document.getElementById(`import-split-slider-${e}`);
    s && (s.dataset.dirty = "true");
}

function importFromPaste() {
    const e = document.getElementById("paste-area"), t = document.getElementById("paste-status"), a = document.getElementById("sched-preview-section"), n = document.getElementById("sched-preview-list"), r = document.getElementById("sched-preview-count");
    if (!e || !e.value.trim()) return void (t.innerHTML = '<span style="color:var(--err);">⚠ Paste data from Sheets first.</span>');
    const o = e.value.trim().split("\n"), s = o[0].split("\t"), i = [];
    s.forEach((e, t) => {
        e.match(/^\d{1,2}\/\d{1,2}$/) && i.push({
            index: t,
            dateKey: e
        });
    }), _tempImportedUsers = [], o.slice(1).forEach(e => {
        const t = e.split("\t");
        if (t.length < 5) return;
        const a = t[3]?.trim().toLowerCase() || "", n = {
            id: (e => {
                let t = 0;
                for (let a = 0; a < e.length; a++) t = Math.imul(31, t) + e.charCodeAt(a) | 0;
                return Math.abs(t);
            })(a),
            team: t[1]?.trim() || "—",
            name: t[2]?.trim() || "—",
            username: a,
            role: t[4]?.trim() || "—",
            schedule: {}
        };
        n.username && (i.forEach(e => {
            n.schedule[e.dateKey] = t[e.index]?.trim().toUpperCase() || "0";
        }), _tempImportedUsers.push(n));
    }), r.textContent = _tempImportedUsers.length;
    const l = `\n    <tr style="background:var(--bg3); position:sticky; top:0; z-index:10;">\n      <th style="padding:8px; border:1px solid var(--border);">No.</th>\n      <th style="padding:8px; border:1px solid var(--border);">Group</th>\n      <th style="padding:8px; border:1px solid var(--border); min-width:150px;">NAME</th>\n      <th style="padding:8px; border:1px solid var(--border);">Username</th>\n      <th style="padding:8px; border:1px solid var(--border);">Roles</th>\n      ${i.map(e => `<th style="padding:4px; border:1px solid var(--border); min-width:40px; color:var(--accent);">${e.dateKey}</th>`).join("")}\n    </tr>`, d = _tempImportedUsers.map((e, t) => `\n    <tr style="border-bottom:1px solid var(--border);">\n      <td style="padding:6px; border:1px solid var(--border); text-align:center;">${t + 1}</td>\n      <td style="padding:6px; border:1px solid var(--border); text-align:center;">${e.team}</td>\n      <td style="padding:6px; border:1px solid var(--border); font-weight:600;">${e.name}</td>\n      <td style="padding:6px; border:1px solid var(--border); color:var(--accent); font-family:monospace;">${e.username}</td>\n      <td style="padding:6px; border:1px solid var(--border); font-size:10px;">${_resolveRole(e.role, e.team)}</td>\n      ${i.map(t => {
        const a = e.schedule[t.dateKey] || "0";
        let n = "";
        return "D" === a ? n = "background:#fecaca; color:#b91c1c;" : "A" === a ? n = "background:#fef08a; color:#a16207;" : "E" === a ? n = "background:#d8b4fe; color:#6b21a8;" : "0" === a && (n = "background:white; color:#9ca3af;"), 
        `<td style="padding:4px; border:1px solid var(--border); text-align:center; font-weight:bold; ${n}">${a}</td>`;
    }).join("")}\n    </tr>`).join("");
    n.innerHTML = `\n    <div style="overflow-x:auto; max-height:400px; border:1px solid var(--border); border-radius:8px;">\n      <table style="width:max-content; border-collapse:collapse; background:white; text-align:left;">\n        <thead>${l}</thead>\n        <tbody>${d}</tbody>\n      </table>\n    </div>`;
    const p = new Set;
    _tempImportedUsers.forEach(e => {
        Object.values(e.schedule).forEach(e => {
            VISIBLE_SHIFTS.includes(e) && p.add(e);
        });
    });
    const c = document.getElementById("import-split-panel");
    c && (c.innerHTML = _buildImportSplitHTML(p)), t.innerHTML = '<span style="color:var(--ok);">✓ Data parsed successfully.</span>', 
    a.style.display = "block";
}

async function confirmScheduleImport() {
    if (0 === _tempImportedUsers.length) return;
    VISIBLE_SHIFTS.forEach(e => {
        const t = document.getElementById(`import-split-slider-${e}`);
        t && "true" === t.dataset.dirty && setBreakSplitPct(e, parseInt(t.value));
    }), state.staffSchedule || (state.staffSchedule = {}), _tempImportedUsers.forEach(function(e) {
        e.username && e.schedule && (state.staffSchedule[e.username] = e.schedule);
    }), state.users = _tempImportedUsers.map(function(e) {
        return {
            id: e.id,
            username: e.username,
            name: e.name,
            team: e.team,
            role: e.role,
            gender: e.gender || ""
        };
    }), state._usersUpdatedAt = Date.now();
    const e = autoAssignBreaks(state.users);
    save(), "function" == typeof syncWrite && await syncWrite(), toast(`Imported ${state.users.length} staff. Auto-assigned ${e.assigned} breaks.`, "ok"), 
    document.getElementById("sched-preview-section").style.display = "none", nav("staff");
}

function _renderStaffSchedule() {
    showFullMonth = !0;
    if (!(state.users && state.users.length > 0)) return '\n<div class="empty" style="padding:48px 0;">\n  <div class="empty-ico">📋</div>\n  <div>No schedule data available.</div>\n  <div style="font-size:12px;color:var(--text3);margin-top:6px;">Schedule is synced automatically from Google Sheets each morning.</div>\n</div>';
    var e = {};
    Object.values(state.staffSchedule || {}).forEach(function(t) {
        Object.keys(t || {}).forEach(function(t) {
            /^\d{2}\/\d{2}$/.test(t) && (e[t.split("/")[1]] = 1);
        });
    });
    var t = Object.keys(e).sort();
    if (!_schedMonth || !t.includes(_schedMonth)) {
        var a = _ssActiveMonday.split("/")[1];
        _schedMonth = t.includes(a) ? a : t[t.length - 1] || a;
    }
    var n = {};
    Object.values(state.staffSchedule || {}).forEach(function(e) {
        Object.keys(e || {}).forEach(function(e) {
            /^\d{2}\/\d{2}$/.test(e) && e.split("/")[1] === _schedMonth && (n[e] = 1);
        });
    });
    const r = _sortDateKeys(Object.keys(n));
    var o = isTraining(currentUser);
    const s = state.users.filter(e => {
        if ("tuan.mai" === e.username || "nhon.bui" === e.username) return !1;
        var t = e.role || (state.staffInfo[e.username] || {}).role || "", a = (_resolveRole(t, e.team) || "").toLowerCase(), n = (e.team || "").toUpperCase().charAt(0), r = isTraining(e) || a.includes("training") || "T" === n;
        if (!o && r) return !1;
        var s = _attNormalizeLabel(staffFilters.search || "");
        return !s || (_attNormalizeLabel(e.team || "").includes(s) || _attNormalizeLabel(e.name || "").includes(s) || _attNormalizeLabel(e.username || "").includes(s) || _attNormalizeLabel(a).includes(s));
    });
    var i = "background:var(--bg3);position:sticky;z-index:20;top:0;", l = '<input class="filter-input" style="width:200px;" placeholder="Search group, name, user, role…" value="' + (staffFilters.search || "") + '" oninput="staffFilters.search=this.value;_liveFilter()">';
    var d, p = !isLeader(currentUser) && !isTraining(currentUser) ? '<button class="btn btn-sm" onclick="openDayoffSwapModal(null)" style="font-size:11px;">↔ Day-off Swap</button>' : "";
    d = _ssFilterDk && "All" !== _ssShiftFilter ? s.filter(function(e) {
        return (_getSched(e.username, _ssFilterDk) || "").charAt(0) === _ssShiftFilter;
    }) : "All" === _ssShiftFilter ? s : s.filter(function(e) {
        return r.some(function(t) {
            return (_getSched(e.username, t) || "").charAt(0) === _ssShiftFilter;
        });
    });
    const c = {
        "01": "January",
        "02": "February",
        "03": "March",
        "04": "April",
        "05": "May",
        "06": "June",
        "07": "July",
        "08": "August",
        "09": "September",
        10: "October",
        11: "November",
        12: "December"
    };
    return `\n<div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap;">\n  ${l}\n  <div style="width:1px;height:20px;background:var(--border);"></div>\n  <select class="login-select" style="width:130px;padding:4px;" onchange="_schedMonth=this.value;nav('staff')">\n    ${t.map(e => `<option value="${e}" ${e === _schedMonth ? "selected" : ""}>${c[e] || e}</option>`).join("")}\n  </select>\n  ${p}\n  <span style="font-size:11px;color:var(--text3);margin-left:auto;">${d.length} staff</span>\n</div>\n${function(e, t) {
        var a = _sortStaffUsers(t || s);
        return `<div class="staff-tbl-wrap">\n  <table>\n    <thead>\n      <tr>\n        <th style="${i}left:0;min-width:60px;width:60px;">GROUP</th>\n        <th style="${i}left:60px;min-width:200px;width:200px;">FULL NAME</th>\n        <th style="${i}left:260px;min-width:130px;width:130px;">USER</th>\n        <th style="${i}left:390px;min-width:140px;width:140px;box-shadow:3px 0 6px rgba(0,0,0,.12);">POSITION</th>\n        ${e.map(function(e) {
            const t = _ssFilterDk === e;
            return '<th class="c" style="min-width:48px;padding:6px 2px;' + (t && "All" !== _ssShiftFilter ? "background:rgba(31,102,241,0.16) !important;" : "") + '"><div style="font-size:8px;font-weight:400;opacity:.65;line-height:1.5;">' + getWkDay(e) + '</div><div style="color:var(--accent);font-size:11px;line-height:1.3;">' + e + "</div><select onclick=\"event.stopPropagation()\" onchange=\"window._ssFilterDk=this.value==='All'?'':'" + e + "';window._ssShiftFilter=this.value;nav('staff')\" style=\"display:block;margin:4px auto 0 auto;font-size:9px;padding:1px 2px;pointer-events:auto;border:1px solid var(--border2);border-radius:4px;background:var(--bg3);color:var(--text2);cursor:pointer;width:38px;height:18px;text-align:center;\">" + [ "All", "A", "D", "E" ].map(function(e) {
                var a = t && _ssShiftFilter === e;
                return t || "All" !== e || (a = !0), '<option value="' + e + '"' + (a ? " selected" : "") + ">" + e + "</option>";
            }).join("") + "</select></th>";
        }).join("")}\n      </tr>\n    </thead>\n    <tbody id="staff-tbody">${renderStaffRows(a, e)}</tbody>\n  </table>\n</div>`;
    }(r, d)}`;
}

function _navStaff() {
    var e = document.getElementById("sa-table-wrap"), t = e ? e.scrollTop : 0, a = document.getElementById("main-content"), n = a ? a.scrollTop : window.pageYOffset;
    nav("staff");
    var r = document.getElementById("sa-table-wrap");
    r && (r.scrollTop = t), a ? a.scrollTop = n : window.scrollTo(0, n);
}

var _attNow = new Date, _attImportMonth = _attNow.getDate() >= 25 ? 11 === _attNow.getMonth() ? 1 : _attNow.getMonth() + 2 : _attNow.getMonth() + 1, _attImportYear = _attNow.getDate() >= 25 && 11 === _attNow.getMonth() ? _attNow.getFullYear() + 1 : _attNow.getFullYear(), _staffAttConflictFilter = !1, _saShiftFilter = "All", _saFilterDk = "", _saDateFilter = "", _saShiftFilterDate = "", _saFillCode = "XA", _saSearchQuery = "", _saFilteredUsernames = [], _saCurrentDates = [], _saCurrentMonthKey = "", _attCopiedCode = "", _staffAttUndoStack = [], _wtNow = new Date, _wtMonth = _wtNow.getMonth() + 1, _wtYear = _wtNow.getFullYear(), _wtShiftFilter = "All", _wtFilterDk = "";

function _renderWorkingTime() {
    var e = _wtMonth, t = _wtYear, a = t + "-" + String(e).padStart(2, "0"), n = _getAllDatesInMonth(t, e), r = {};
    (state.policyCompliance || []).forEach(function(e) {
        e.username && e.empNo && !r[e.username] && (r[e.username] = e.empNo);
    });
    var o = Object.keys(state.staffInfo || {});
    state.users.forEach(function(e) {
        e.username && -1 === o.indexOf(e.username) && o.push(e.username);
    });
    var s, i = t > 2026 || 2026 === t && e >= 7, l = o.map(function(e) {
        var t = state.staffInfo[e] || {}, a = state.users.find(function(t) {
            return t.username === e;
        }), n = a && a.role || t.role || "", o = a && a.team || t.team || "", s = (ROLES[_resolveRole(n, o)] || {}).level;
        if (void 0 === s && (s = 0), s >= 3) return null;
        var l = a && a.empNo || t.empNo || r[e] || "";
        if (i && l && 0 === l.trim().toUpperCase().indexOf("AG")) return null;
        var d = a && a.name || t.name || e;
        return {
            username: e,
            name: d,
            role: n,
            team: o,
            empNo: l,
            id: a ? a.id : null
        };
    }).filter(Boolean);
    s = (s = _wtFilterDk && "All" !== _wtShiftFilter ? l.filter(function(e) {
        return (_getSched(e.username, _wtFilterDk) || "").charAt(0) === _wtShiftFilter;
    }) : l).slice().sort(function(e, t) {
        return _roleSort(e, t);
    });
    var d = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ], p = "#f87171", c = "rgba(248,113,113,.18)", f = "#fb923c", u = "rgba(251,146,60,.18)", m = "#34d399", g = "rgba(52,211,153,.18)", v = "#a78bfa", y = "rgba(167,139,250,.18)", h = "<tr>";
    h += '<th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);min-width:92px;width:92px;position:sticky;top:0;left:0;z-index:4;background:var(--bg3);border-bottom:2px solid var(--border2);">EMP NO.</th><th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text2);min-width:165px;width:165px;position:sticky;top:0;left:92px;z-index:4;background:var(--bg3);border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">NAME</th><th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);min-width:145px;width:145px;position:sticky;top:0;left:257px;z-index:4;background:var(--bg3);border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">POSITION</th>';
    n.forEach(function(a, n) {
        var r = a.split("/"), o = r[0], s = r[1], i = parseInt(s) === e ? t : 1 === e ? t - 1 : t, l = new Date(i, parseInt(s) - 1, parseInt(o)).getDay(), p = 0 === l || 6 === l, c = 0 === l, f = _wtFilterDk === a, u = "<select onclick=\"event.stopPropagation()\" onchange=\"window._wtFilterDk=this.value==='All'?'':'" + a + "';window._wtShiftFilter=this.value;nav('staff')\" style=\"display:block;margin:4px auto 0 auto;font-size:9px;padding:1px 2px;pointer-events:auto;border:1px solid var(--border2);border-radius:4px;background:var(--bg3);color:var(--text2);cursor:pointer;width:38px;height:18px;text-align:center;\">" + [ "All", "A", "D", "E" ].map(function(e) {
            var t = f && _wtShiftFilter === e;
            return f || "All" !== e || (t = !0), '<option value="' + e + '"' + (t ? " selected" : "") + ">" + e + "</option>";
        }).join("") + "</select>", m = f && "All" !== _wtShiftFilter;
        h += '<th style="min-width:40px;padding:4px 2px;text-align:center;font-size:10px;font-weight:600;color:' + (c ? "var(--err)" : p ? "var(--warn)" : "var(--text2)") + ";background:" + (m ? "rgba(31,102,241,0.16) !important" : p ? "var(--bg4)" : "var(--bg3)") + ";" + (m ? "border-bottom:2px solid var(--accent);" : "border-bottom:2px solid " + (c ? "var(--err)" : p ? "var(--border2)" : "var(--accent)") + ";") + "border-left:" + (0 === n || c ? "2px solid var(--border)" : "none") + ';position:sticky;top:0;z-index:2;white-space:nowrap;"><div style="font-size:9px;' + (p ? "" : "opacity:.65;") + 'line-height:1.5;">' + d[l] + '</div><div style="font-size:11px;line-height:1.3;letter-spacing:-.3px;">' + o + '/<span style="font-size:9px;opacity:.7;">' + s + "</span></div>" + u + "</th>";
    }), h += '<th style="text-align:center;padding:6px 4px;font-size:10px;color:' + p + ';min-width:45px;width:45px;position:sticky;top:0;z-index:2;background:var(--bg3);border-bottom:2px solid var(--border2);border-left:2px solid var(--border);" title="Total Late">LATE</th><th style="text-align:center;padding:6px 4px;font-size:10px;color:var(--text2);min-width:45px;width:45px;position:sticky;top:0;z-index:2;background:var(--bg3);border-bottom:2px solid var(--border2);border-left:1px solid var(--border);" title="Total Early">EARLY</th><th style="text-align:center;padding:6px 4px;font-size:10px;color:var(--text2);min-width:55px;width:55px;position:sticky;top:0;z-index:2;background:var(--bg3);border-bottom:2px solid var(--border2);border-left:1px solid var(--border);" title="Total Training">TRAIN</th><th style="text-align:center;padding:6px 4px;font-size:10px;color:var(--text2);min-width:45px;width:45px;position:sticky;top:0;z-index:2;background:var(--bg3);border-bottom:2px solid var(--border2);border-left:1px solid var(--border);" title="Total Others">OTHER</th>', 
    h += "</tr>";
    var x = "position:sticky;z-index:1;background:var(--bg3);", b = s.map(function(r) {
        var o = r.role || "", s = 0, i = 0, l = 0, d = 0, h = DB.getWorkingTime(r.username, a) || {};
        Object.keys(h).forEach(function(e) {
            var t = h[e];
            t.late && (s += t.late), t.early && (i += t.early), t.training && (l += t.training), 
            t.others && (d += t.others);
        });
        var b = n.map(function(n, o) {
            var s = n.split("/"), i = s[0], l = s[1], d = parseInt(l) === e ? t : 1 === e ? t - 1 : t, h = new Date(d, parseInt(l) - 1, parseInt(i)).getDay(), x = 0 === h || 6 === h, b = (DB.getWorkingTime(r.username, a) || {})[n] || {}, w = b.late || b.early || b.training || b.others || b.total, _ = x ? "background:var(--bg4);" : "", S = (r.name || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            return '<td style="text-align:center;padding:3px 1px;cursor:pointer;' + (0 === o ? "border-left:2px solid var(--border);" : "") + (n === _wtFilterDk && "All" !== _wtShiftFilter ? "background:rgba(31,102,241,0.06) !important;" : "") + (w ? "" : _) + '" onclick="openWtModal(\'' + r.username + "','" + a + "','" + n + "','" + S + "')\">" + (w ? '<div style="display:flex;flex-direction:column;gap:1px;padding:2px 1px;">' + (void 0 !== b.late && null !== b.late ? '<span style="font-size:9px;font-weight:700;color:' + p + ";background:" + c + ';border-radius:3px;padding:0 3px;white-space:nowrap;">L ' + b.late + "</span>" : "") + (void 0 !== b.early && null !== b.early ? '<span style="font-size:9px;font-weight:700;color:' + f + ";background:" + u + ';border-radius:3px;padding:0 3px;white-space:nowrap;">E ' + b.early + "</span>" : "") + (void 0 !== b.training && null !== b.training ? '<span style="font-size:9px;font-weight:700;color:' + m + ";background:" + g + ';border-radius:3px;padding:0 3px;white-space:nowrap;">T ' + b.training + "</span>" : "") + (void 0 !== b.others && null !== b.others ? '<span style="font-size:9px;font-weight:700;color:' + v + ";background:" + y + ';border-radius:3px;padding:0 3px;white-space:nowrap;">O ' + b.others + "</span>" : "") + "</div>" : '<span style="font-size:10px;color:var(--text3);">·</span>') + "</td>";
        }).join("");
        return '<tr style="border-bottom:0.5px solid var(--border);"><td style="padding:5px 8px;white-space:nowrap;' + x + "left:0;min-width:92px;width:92px;font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;\">" + (r.empNo || "—") + '</td><td style="padding:5px 10px;white-space:nowrap;' + x + 'left:92px;min-width:165px;width:165px;border-left:1px solid var(--border);"><div style="font-size:12px;font-weight:600;">' + r.name + '</div></td><td style="padding:5px 8px;white-space:nowrap;' + x + "left:257px;min-width:145px;width:145px;border-left:1px solid var(--border);font-size:11px;color:" + _roleColor(o, r.team) + ';">' + (getRoleInfo(o, r.team).label || _resolveRole(o, r.team) || "—") + "</td>" + b + '<td style="padding:5px 4px;text-align:center;min-width:45px;width:45px;border-left:2px solid var(--border);font-size:11px;font-weight:600;color:' + (s > 0 ? p : "var(--text3)") + ';">' + (s || "—") + '</td><td style="padding:5px 4px;text-align:center;min-width:45px;width:45px;border-left:1px solid var(--border);font-size:11px;font-weight:600;color:' + (i > 0 ? f : "var(--text3)") + ';">' + (i || "—") + '</td><td style="padding:5px 4px;text-align:center;min-width:55px;width:55px;border-left:1px solid var(--border);font-size:11px;font-weight:600;color:' + (l > 0 ? m : "var(--text3)") + ';">' + (l || "—") + '</td><td style="padding:5px 4px;text-align:center;min-width:45px;width:45px;border-left:1px solid var(--border);font-size:11px;font-weight:600;color:' + (d > 0 ? v : "var(--text3)") + ';">' + (d || "—") + "</td></tr>";
    }).join("");
    return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap;">' + ("<select class=\"login-select\" style=\"padding:5px 8px;font-size:12px;width:110px;\" onchange=\"_wtMonth=+this.value;_wtFilterDk='';_wtShiftFilter='All';nav('staff')\">" + [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ].map(function(a) {
        return '<option value="' + a + '"' + (a === e ? " selected" : "") + ">" + new Date(t, a - 1, 1).toLocaleString("en-US", {
            month: "long"
        }) + "</option>";
    }).join("") + "</select><select class=\"login-select\" style=\"padding:5px 8px;font-size:12px;width:70px;\" onchange=\"_wtYear=+this.value;_wtFilterDk='';_wtShiftFilter='All';nav('staff')\">" + [ 2026, 2027 ].map(function(e) {
        return '<option value="' + e + '"' + (e === t ? " selected" : "") + ">" + e + "</option>";
    }).join("") + "</select>") + "</div>" + ('<div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;margin-bottom:10px;align-items:center;"><span style="background:' + c + ";color:" + p + ';padding:2px 7px;border-radius:4px;font-weight:600;">L</span> Late login (min) &nbsp;<span style="background:' + u + ";color:" + f + ';padding:2px 7px;border-radius:4px;font-weight:600;">E</span> Early logout (min) &nbsp;<span style="background:' + g + ";color:" + m + ';padding:2px 7px;border-radius:4px;font-weight:600;">T</span> Training time (min) &nbsp;<span style="background:' + y + ";color:" + v + ';padding:2px 7px;border-radius:4px;font-weight:600;">O</span> Others (min)</div>') + '<div style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 280px);border:1px solid var(--border);border-radius:8px;"><table style="border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;"><thead>' + h + "</thead><tbody>" + b + "</tbody></table></div>";
}

function _ensureWtModal() {
    if (!document.getElementById("modal-wt-cell")) {
        var e = function(e, t, a, n) {
            return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;"><label style="font-size:11px;font-weight:700;color:' + n + ';min-width:72px;">' + t + '</label><input id="' + e + '" type="number" min="0" step="1" placeholder="—" style="flex:1;padding:6px 10px;font-size:14px;font-family:\'IBM Plex Mono\',monospace;border:1.5px solid var(--border2);border-radius:8px;background:var(--bg3);color:var(--text);text-align:right;"><span style="font-size:11px;color:var(--text3);min-width:28px;">' + a + "</span></div>";
        };
        document.body.insertAdjacentHTML("beforeend", '<div id="modal-wt-cell" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-wt-cell\')"><div class="modal" style="width:360px;"><div class="modal-title" id="wt-modal-title">Working Time</div><div style="margin:4px 0 14px;font-size:11px;color:var(--text3);" id="wt-modal-desc"></div>' + e("wt-inp-late", "LATE", "min", "#f87171") + e("wt-inp-early", "EARLY", "min", "#fb923c") + e("wt-inp-training", "TRAINING", "min", "#34d399") + e("wt-inp-others", "OTHERS", "min", "#a78bfa") + '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;"><button class="btn btn-sm" onclick="closeModal(\'modal-wt-cell\')">Cancel</button><button class="btn btn-accent btn-sm" onclick="saveWtCell()">Save</button></div></div></div>');
    }
}

var _wtPending = {};

function openWtModal(e, t, a, n) {
    _ensureWtModal(), _wtPending = {
        username: e,
        monthKey: t,
        dk: a
    }, document.getElementById("wt-modal-title").textContent = n, document.getElementById("wt-modal-desc").textContent = a + " · " + t;
    var r = (DB.getWorkingTime(e, t) || {})[a] || {}, o = function(e, t) {
        var a = document.getElementById(e);
        a && (a.value = void 0 !== r[t] && null !== r[t] ? r[t] : "");
    };
    o("wt-inp-late", "late"), o("wt-inp-early", "early"), o("wt-inp-training", "training"), 
    o("wt-inp-others", "others"), document.getElementById("modal-wt-cell").classList.add("show"), 
    setTimeout(function() {
        var e = document.getElementById("wt-inp-late");
        e && e.focus();
    }, 80);
}

function saveWtCell() {
    if (_wtPending.username) {
        for (var e = function(e) {
            var t = document.getElementById(e);
            if (t && "" !== t.value.trim()) {
                var a = parseFloat(t.value);
                return isNaN(a) ? void 0 : a;
            }
        }, t = DB.getWorkingTime(_wtPending.username, _wtPending.monthKey) || {}, a = Object.assign({}, t[_wtPending.dk] || {}), n = [ "late", "early", "training", "others" ], r = [ "wt-inp-late", "wt-inp-early", "wt-inp-training", "wt-inp-others" ], o = 0; o < n.length; o++) {
            var s = e(r[o]);
            void 0 !== s ? a[n[o]] = s : delete a[n[o]];
        }
        var i = Object.assign({}, t);
        0 === Object.keys(a).length ? delete i[_wtPending.dk] : i[_wtPending.dk] = a, DB.setWorkingTime(_wtPending.username, _wtPending.monthKey, i), 
        closeModal("modal-wt-cell"), nav("staff"), "function" == typeof syncPush && syncPush();
    }
}

function _staffAttSnapshot() {
    var e = [];
    return _saFilteredUsernames.forEach(function(t) {
        var a = DB.getMonthlyAtt(t, _saCurrentMonthKey);
        e.push({
            username: t,
            monthKey: _saCurrentMonthKey,
            data: Object.assign({}, a)
        });
    }), e;
}

function undoClearAtt() {
    _staffAttUndoStack.length && (_staffAttUndoStack.pop().forEach(function(e) {
        DB.setMonthlyAtt(e.username, e.monthKey, e.data);
    }), syncWrite(), _navStaff());
}

function fillAttRow(e, t) {
    if (_saFillCode) {
        var a, n, r = _saCurrentDates.length ? _saCurrentDates : (a = parseInt(t.split("-")[0]), 
        n = parseInt(t.split("-")[1]), _getAllDatesInMonth(a, n)), o = Object.assign({}, DB.getMonthlyAtt(e, t)), s = 0;
        r.forEach(function(e) {
            o[e] || (o[e] = _saFillCode, s++);
        }), 0 !== s && (DB.setMonthlyAtt(e, t, o), syncWrite(), _navStaff());
    }
}

function fillAttAll() {
    if (_saCurrentMonthKey) {
        var e = new Date, t = e.getDate().toString().padStart(2, "0") + "/" + (e.getMonth() + 1).toString().padStart(2, "0");
        _saFilteredUsernames.forEach(function(e) {
            var a = Object.assign({}, DB.getMonthlyAtt(e, _saCurrentMonthKey));
            if (!a[t]) {
                var n;
                if ("All" !== _saShiftFilter) n = "X" + _saShiftFilter; else {
                    var r = _getSched(e, t);
                    n = r && "0" !== r ? "X" + r : "";
                }
                n && (a[t] = n, DB.setMonthlyAtt(e, _saCurrentMonthKey, a));
            }
        }), syncWrite(), _navStaff();
    }
}

function clearAttAll() {
    if (_saCurrentMonthKey) {
        _staffAttUndoStack.push(_staffAttSnapshot());
        var e = new Date, t = e.getDate().toString().padStart(2, "0") + "/" + (e.getMonth() + 1).toString().padStart(2, "0");
        _saFilteredUsernames.forEach(function(e) {
            var a = Object.assign({}, DB.getMonthlyAtt(e, _saCurrentMonthKey)), n = a[t];
            n && ("All" === _saShiftFilter && "X" !== n.charAt(0) || (delete a[t], DB.setMonthlyAtt(e, _saCurrentMonthKey, a)));
        }), syncWrite(), _navStaff();
    }
}

var _attHoveredCell = null, _attKbdInstalled = !1;

function _installAttKbd() {
    _attKbdInstalled || (_attKbdInstalled = !0, document.addEventListener("keydown", function(e) {
        var t = (e.target || {}).tagName;
        if ("INPUT" !== t && "SELECT" !== t && "TEXTAREA" !== t && document.getElementById("sa-kbd-marker")) {
            if ((e.ctrlKey || e.metaKey) && "z" === e.key) {
                if (!_staffAttUndoStack.length) return;
                return e.preventDefault(), void undoClearAtt();
            }
            if ((e.ctrlKey || e.metaKey) && "c" === e.key) {
                if (!_attHoveredCell || !_attHoveredCell.code) return;
                e.preventDefault(), _attCopiedCode = _attHoveredCell.code, _navStaff();
            }
            if ((e.ctrlKey || e.metaKey) && "v" === e.key) {
                if (!_attHoveredCell || !_attCopiedCode) return;
                e.preventDefault();
                var a = Object.assign({}, DB.getMonthlyAtt(_attHoveredCell.username, _attHoveredCell.monthKey));
                a[_attHoveredCell.dk] = _attCopiedCode, DB.setMonthlyAtt(_attHoveredCell.username, _attHoveredCell.monthKey, a), 
                syncWrite(), _navStaff();
            }
            "Escape" === e.key && _attCopiedCode && (_attCopiedCode = "", _navStaff());
        }
    }));
}

function _attCellModalHTML() {
    return '<div id="modal-att-cell" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-att-cell\')"><div class="modal" style="width:380px;"><div class="modal-title" id="att-cell-modal-title">Edit Attendance</div><div id="att-cell-code-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:14px 0;"></div><div style="display:flex;gap:8px;justify-content:space-between;margin-top:4px;"><div style="display:flex;gap:8px;"><button class="btn btn-sm" style="color:var(--err);border-color:var(--err);" onclick="clearAttCell()">Clear</button><button class="btn btn-sm" title="Copy code for quick paste" onclick="_attCopiedCode=_attCellSelected;closeModal(\'modal-att-cell\');_navStaff()">Copy</button></div><div style="display:flex;gap:8px;"><button class="btn btn-sm" onclick="closeModal(\'modal-att-cell\')">Cancel</button><button class="btn btn-accent btn-sm" onclick="saveAttCell()">Save</button></div></div></div></div>';
}

var _attCellTarget = null, _attCellSelected = "";

function openAttCellModal(e, t, a) {
    document.getElementById("modal-att-cell") || document.body.insertAdjacentHTML("beforeend", _attCellModalHTML()), 
    _attCellTarget = {
        username: e,
        monthKey: t,
        dk: a
    };
    var n = (DB.getMonthlyAtt(e, t) || {})[a] || "";
    _attCellSelected = n;
    var r = state.users.find(function(t) {
        return t.username === e;
    }), o = r ? r.name : e;
    document.getElementById("att-cell-modal-title").textContent = "Edit " + a + " — " + o;
    document.getElementById("att-cell-code-grid").innerHTML = [ "XA", "XD", "XE", "0", "A1", "A2", "UA1", "UA2", "D1", "D2", "UD1", "UD2", "E1", "E2", "UE1", "UE2", "A", "H", "U", "S", "L" ].map(function(e) {
        return '<button class="btn btn-sm' + (e === n ? " btn-accent" : "") + "\" onclick=\"document.querySelectorAll('#att-cell-code-grid .btn').forEach(function(b){b.classList.remove('btn-accent');});this.classList.add('btn-accent');_attCellSelected='" + e + "'\">" + e + "</button>";
    }).join(""), document.getElementById("modal-att-cell").classList.add("show");
}

function saveAttCell() {
    if (_attCellTarget && _attCellSelected) {
        var e = _attCellTarget, t = Object.assign({}, DB.getMonthlyAtt(e.username, e.monthKey));
        t[e.dk] = _attCellSelected, DB.setMonthlyAtt(e.username, e.monthKey, t), syncWrite(), 
        closeModal("modal-att-cell"), _navStaff();
    }
}

function clearAttCell() {
    if (_attCellTarget) {
        var e = _attCellTarget, t = Object.assign({}, DB.getMonthlyAtt(e.username, e.monthKey));
        delete t[e.dk], DB.setMonthlyAtt(e.username, e.monthKey, t), syncWrite(), closeModal("modal-att-cell"), 
        _navStaff();
    }
}

function attCellClick(e, t, a) {
    if (_attCopiedCode) {
        var n = Object.assign({}, DB.getMonthlyAtt(e, t));
        n[a] = _attCopiedCode, DB.setMonthlyAtt(e, t, n), syncWrite(), _navStaff();
    } else openAttCellModal(e, t, a);
}

function _liveFilterAttendance() {
    const e = _attImportYear, t = _attImportMonth, a = `${e}-${String(t).padStart(2, "0")}`;
    const n = _getAllDatesInMonth(e, t), r = state.monthlyAttendance || {};
    var o = (state.users || []).filter(function(e) {
        return "tuan.mai" !== e.username && "nhon.bui" !== e.username;
    }).map(function(e) {
        return e.username;
    }), s = Object.keys(r).filter(function(e) {
        if ("tuan.mai" === e || "nhon.bui" === e) return !1;
        var t = r[e]?.[a];
        return t && Object.keys(t).length > 0;
    }), i = {};
    o.forEach(function(e) {
        i[e] = !0;
    }), s.forEach(function(e) {
        i[e] = !0;
    });
    const l = Object.keys(i);
    var d = {};
    (state.policyCompliance || []).forEach(function(e) {
        e.username && e.empNo && !d[e.username] && (d[e.username] = e.empNo);
    });
    var p = e > 2026 || 2026 === e && t >= 7, c = l.map(function(e) {
        var t = state.staffInfo?.[e], a = t && t.empNo || d[e] || "", n = state.users.find(function(t) {
            return t.username === e;
        });
        return n ? Object.assign({}, n, {
            empNo: n.empNo || a
        }) : t ? {
            username: e,
            name: t.name || e,
            role: t.role || "",
            team: t.team || "",
            empNo: a,
            id: null
        } : null;
    }).filter(Boolean);
    p && (c = c.filter(function(e) {
        return !(e.empNo || "").trim().toUpperCase().startsWith("AG");
    })), c.sort(function(e, t) {
        return _roleSort(e, t);
    });
    var f = {};
    c.forEach(function(e) {
        var t = r[e.username]?.[a] || {}, o = [];
        n.forEach(function(a) {
            var n = t[a];
            if (n || _parseAttCode(n)) {
                var r = _checkAttConflict(e, a, _parseAttCode(n));
                r && r.length > 0 && o.push({
                    dk: a,
                    msgs: r
                });
            }
        }), f[e.username] = o;
    });
    let u = _staffAttConflictFilter ? c.filter(e => f[e.username]?.length > 0) : c;
    _saFilterDk && "All" !== _saShiftFilter && (u = u.filter(e => (_getSched(e.username, _saFilterDk) || "").charAt(0) === _saShiftFilter));
    var m = _attNormalizeLabel(_saSearchQuery || "");
    if (m) {
        var g = m.split(/[;,|]+/).map(function(e) {
            return e.trim();
        }).filter(Boolean);
        g.length > 0 && (u = u.filter(e => {
            var t = _attNormalizeLabel(e.team || ""), a = _attNormalizeLabel(e.name || ""), n = _attNormalizeLabel(e.username || ""), r = _attNormalizeLabel(e.empNo || ""), o = _attNormalizeLabel(_resolveRole(e.role || (state.staffInfo[e.username] || {}).role || "", e.team || (state.staffInfo[e.username] || {}).team || "") || "");
            return g.some(function(e) {
                return t.includes(e) || a.includes(e) || n.includes(e) || r.includes(e) || o.includes(e);
            });
        }));
    }
    u = _sortStaffUsers(u), _saFilteredUsernames = u.map(e => e.username);
    var v = {
        A: [ "rgba(14,165,233,.14)", "#0ea5e9" ],
        B: [ "rgba(14,165,233,.14)", "#0ea5e9" ],
        C: [ "rgba(14,165,233,.14)", "#0ea5e9" ],
        D: [ "rgba(14,165,233,.14)", "#0ea5e9" ],
        E: [ "rgba(14,165,233,.14)", "#0ea5e9" ]
    }, y = [ "rgba(167,139,250,.14)", "#a78bfa" ], h = {
        A: [ "rgba(234,179,8,.13)", "#ca8a04" ],
        H: [ "rgba(220,38,38,.13)", "#dc2626" ],
        0: [ "rgba(22,163,74,.13)", "#16a34a" ],
        U: [ "rgba(225,29,72,.12)", "#e11d48" ],
        S: [ "rgba(234,88,12,.12)", "#ea580c" ],
        L: [ "rgba(99,102,241,.13)", "#6366f1" ]
    };
    return {
        html: u.map(o => {
            const s = r[o.username]?.[a] || {}, i = f[o.username] || [];
            var l = o.team || (state.staffInfo[o.username] || {}).team || "", d = _resolveRole(o.role || (state.staffInfo[o.username] || {}).role || "", l) || "", p = 3 === (ROLES[d] || {}).level;
            const c = n.map(n => {
                const r = s[n], l = _parseAttCode(r), [d, c] = n.split("/"), f = parseInt(c) === t ? e : 1 === t ? e - 1 : e, u = new Date(f, parseInt(c) - 1, parseInt(d)).getDay(), m = n === _saFilterDk && "All" !== _saShiftFilter ? "background:rgba(31,102,241,0.06) !important;" : "";
                if (!r && !l) return `<td style="text-align:center;padding:2px 1px;background:${0 === u || 6 === u ? "var(--bg4)" : ""};${m}cursor:pointer;"\n          onclick="attCellClick('${o.username}','${a}','${n}')"\n          onmouseover="_attHoveredCell={username:'${o.username}',monthKey:'${a}',dk:'${n}',code:''}">\n          <span style="font-size:10px;color:var(--text3);">·</span></td>`;
                const g = i.find(e => e.dk === n), x = g ? g.msgs : null, b = !p && !!g;
                let w = "", _ = "", S = "";
                if (l) if ("OFF" === l.type) {
                    const e = String(r).toUpperCase();
                    _ = "0" === e || "0.0" === e ? "0" : e;
                    const t = h["0.0" === e ? "0" : e] || [ "var(--D-bg)", "var(--err)" ];
                    w = "background:" + t[0] + ";", S = "color:" + t[1] + ";font-weight:600;";
                } else if ("HD1" === l.type || "HD2" === l.type) w = `background:${y[0]};`, S = `color:${y[1]};font-weight:600;`, 
                _ = String(r).toUpperCase(); else {
                    const e = (l.shift || "").toUpperCase(), t = v[e];
                    w = t ? `background:${t[0]};` : "background:rgba(74,222,128,.06);", S = t ? `color:${t[1]};font-weight:600;` : "color:var(--ok);font-weight:500;", 
                    _ = l.shift || "✓";
                } else _ = r || "?", S = "color:var(--text3);";
                b && (w = "background:rgba(248,113,113,.12);", S = "color:var(--err);font-weight:700;");
                const I = b ? '<sup style="font-size:7px;position:relative;top:-1px;margin-left:1px;">⚠</sup>' : "";
                return `<td style="text-align:center;padding:2px 2px;${w}${m}"\n        title="${x ? x.join(" | ") : l?.reason || r || ""}" ${`onmouseover="_attHoveredCell={username:'${o.username}',monthKey:'${a}',dk:'${n}',code:'${(r || "").replace(/'/g, "\\'")}'}"`} ${`onclick="attCellClick('${o.username}','${a}','${n}')" style="cursor:pointer;"`}>\n        <span style="font-size:10px;font-family:'IBM Plex Mono',monospace;${S}">${_}${I}</span>\n      </td>`;
            }).join(""), u = i.length ? "background:rgba(248,113,113,.03);" : "", m = "position:sticky;z-index:1;background:var(--bg3);";
            var g = o.role || (state.staffInfo[o.username] || {}).role || "";
            return `<tr style="border-bottom:0.5px solid var(--border);${u}">\n      <td style="padding:5px 8px;white-space:nowrap;${m}left:0;min-width:92px;width:92px;font-size:11px;color:var(--text3);font-family:'IBM Plex Mono',monospace;">${o.empNo || "—"}</td>\n      <td style="padding:5px 10px;white-space:nowrap;${m}left:92px;min-width:165px;width:165px;border-left:1px solid var(--border);">\n        <div style="font-size:12px;font-weight:600;">${o.name}</div>\n      </td>\n      <td style="padding:5px 8px;white-space:nowrap;${m}left:257px;min-width:145px;width:145px;border-left:1px solid var(--border);font-size:11px;color:${_roleColor(g, o.team)};">${getRoleInfo(g, o.team).label || _resolveRole(g, o.team) || "—"}</td>\n      ${c}\n    </tr>`;
        }).join(""),
        count: u.length
    };
}

function _renderStaffAttendance() {
    const e = _attImportYear, t = _attImportMonth, a = `${e}-${String(t).padStart(2, "0")}`, n = `${new Date(1 === t ? e - 1 : e, (1 === t ? 12 : t - 1) - 1, 25).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short"
    })} – ${new Date(e, t - 1, 24).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    })}`;
    const r = _getAllDatesInMonth(e, t), o = state.monthlyAttendance || {}, s = `\n      <select class="login-select" style="padding:5px 8px;font-size:12px;width:110px;"\n        onchange="_attImportMonth=+this.value;_saDateFilter='';_saFilterDk='';_saShiftFilter='All';_saSearchQuery='';_navStaff()">\n        ${[ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12 ].map(a => `<option value="${a}" ${a === t ? "selected" : ""}>${new Date(e, a - 1, 1).toLocaleString("en-US", {
        month: "long"
    })}</option>`).join("")}\n      </select>\n      <select class="login-select" style="padding:5px 8px;font-size:12px;width:70px;"\n        onchange="_attImportYear=+this.value;_saDateFilter='';_saFilterDk='';_saShiftFilter='All';_saSearchQuery='';_navStaff()">\n        ${[ 2026, 2027 ].map(t => `<option value="${t}" ${t === e ? "selected" : ""}>${t}</option>`).join("")}\n      </select>`, i = _attImportPanelHTML(s, n);
    if (!Object.values(o).some(e => {
        const t = e?.[a];
        return t && Object.keys(t).length > 0;
    })) return `\n      ${i}\n      <div class="empty" style="padding:48px;">\n        <div class="empty-ico">📋</div>\n        No attendance data for ${n}.\n      </div>`;
    const l = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ], d = r.map(a => {
        const [n, r] = a.split("/"), o = parseInt(r) === t ? e : 1 === t ? e - 1 : e, s = new Date(o, parseInt(r) - 1, parseInt(n)).getDay(), i = 0 === s || 6 === s, d = 0 === s, p = _saFilterDk === a, c = p && "All" !== _saShiftFilter, f = c ? "rgba(31,102,241,0.16) !important" : i ? "var(--bg4)" : "var(--bg3)", u = c ? "border-bottom:2px solid var(--accent);" : "border-bottom:2px solid " + (d ? "var(--err)" : i ? "var(--border2)" : "var(--accent)") + ";";
        var m = "<select onclick=\"event.stopPropagation()\" onchange=\"window._saFilterDk=this.value==='All'?'':'" + a + "';window._saShiftFilter=this.value;_saSearchQuery=document.getElementById('sa-search-input')?document.getElementById('sa-search-input').value:'';_navStaff()\" style=\"display:block;margin:4px auto 0 auto;font-size:9px;padding:1px 2px;pointer-events:auto;border:1px solid var(--border2);border-radius:4px;background:var(--bg3);color:var(--text2);cursor:pointer;width:38px;height:18px;text-align:center;\">" + [ "All", "A", "D", "E" ].map(function(e) {
            var t = p && _saShiftFilter === e;
            return p || "All" !== e || (t = !0), '<option value="' + e + '"' + (t ? " selected" : "") + ">" + e + "</option>";
        }).join("") + "</select>";
        return '<th style="min-width:40px;padding:4px 2px;text-align:center;font-size:10px;font-weight:600;color:' + (d ? "var(--err)" : i ? "var(--warn)" : "var(--text2)") + ";background:" + f + ";" + u + "border-left:" + (d ? "2px solid var(--border)" : "none") + ';position:sticky;top:0;z-index:2;white-space:nowrap;"><div style="font-size:9px;' + (i ? "" : "opacity:.65;") + 'line-height:1.5;">' + l[s] + '</div><div style="font-size:11px;line-height:1.3;letter-spacing:-.3px;">' + n + '/<span style="font-size:9px;opacity:.7;">' + r + "</span></div>" + m + "</th>";
    }).join(""), p = `\n    <button class="btn btn-sm" onclick="_staffAttConflictFilter=!_staffAttConflictFilter;nav('staff')"\n      style="${_staffAttConflictFilter ? "background:var(--err);color:#fff;border-color:var(--err);" : "border-color:var(--err);color:var(--err);"}font-size:11px;">\n      ⚠ Conflicts only${_staffAttConflictFilter ? " ✕" : ""}\n    </button>`, c = `<button class="btn btn-accent btn-sm" onclick="fillAttAll()" style="font-size:11px;">Fill All ↓</button>\n    <button class="btn btn-sm" onclick="clearAttAll()" style="color:var(--err);border-color:var(--err);font-size:11px;">Clear ✕</button>\n    <button class="btn btn-sm" onclick="undoClearAtt()" title="Undo last clear (Ctrl+Z)" style="font-size:11px;${_staffAttUndoStack.length ? "" : "opacity:.35;cursor:not-allowed;"}">↩ Undo</button>`;
    _saCurrentDates = r, _saCurrentMonthKey = a, _installAttKbd();
    var f = _liveFilterAttendance();
    const u = f.html;
    return `\n    ${_attImportPanelHTML(s, n, {
        count: f.count,
        legendHTML: '\n    <div style="display:flex;gap:6px 8px;flex-wrap:wrap;font-size:10px;align-items:center;line-height:1.2;">\n      <span style="background:var(--C-bg);color:var(--ok);padding:2px 8px;border-radius:4px;font-weight:500;">XA–XE</span> Working\n      <span style="background:rgba(167,139,250,.14);color:#a78bfa;padding:2px 8px;border-radius:4px;font-weight:500;">D1/D2</span> Half day\n      <span style="color:var(--text3);font-size:10px;margin:0 2px;">│</span>\n      <span style="background:rgba(234,179,8,.13);color:#ca8a04;padding:2px 7px;border-radius:4px;font-weight:600;">A</span> Annual\n      <span style="background:rgba(220,38,38,.13);color:#dc2626;padding:2px 7px;border-radius:4px;font-weight:600;">H</span> Holiday\n      <span style="background:rgba(22,163,74,.13);color:#16a34a;padding:2px 7px;border-radius:4px;font-weight:600;">0</span> Day off\n      <span style="background:rgba(225,29,72,.12);color:#e11d48;padding:2px 7px;border-radius:4px;font-weight:600;">U</span> Unpaid\n      <span style="background:rgba(234,88,12,.12);color:#ea580c;padding:2px 7px;border-radius:4px;font-weight:600;">S</span> Sick\n      <span style="background:rgba(99,102,241,.13);color:#6366f1;padding:2px 7px;border-radius:4px;font-weight:600;">L</span> Social\n      <span style="color:var(--text3);font-size:10px;margin:0 2px;">│</span>\n      <span style="background:var(--D-bg);color:var(--err);padding:2px 8px;border-radius:4px;font-weight:700;border:1.5px solid var(--err);">⚠</span> Conflict\n    </div>',
        codePicker: c,
        conflictFilterBtn: p
    })}    <div id="sa-table-wrap" style="overflow-x:auto;overflow-y:auto;max-height:calc(100vh - 240px);border:1px solid var(--border);border-radius:8px;">\n      <table style="border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;">\n        <thead>\n          <tr>\n            <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);\n              min-width:92px;width:92px;position:sticky;top:0;left:0;z-index:4;background:var(--bg3);\n              border-bottom:2px solid var(--border2);">EMP NO.</th>\n            <th style="text-align:left;padding:6px 10px;font-size:11px;color:var(--text2);\n              min-width:165px;width:165px;position:sticky;top:0;left:92px;z-index:4;background:var(--bg3);\n              border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">NAME</th>\n            <th style="text-align:left;padding:6px 8px;font-size:11px;color:var(--text2);\n              min-width:145px;width:145px;position:sticky;top:0;left:257px;z-index:4;background:var(--bg3);\n              border-bottom:2px solid var(--border2);border-left:1px solid var(--border);">POSITION</th>\n            ${d}\n          </tr>\n        </thead>\n        <tbody id="sa-tbody">${u}</tbody>\n      </table>\n    </div>`;
}

function _attImportPanelHTML(e, t, a) {
    var n = (a = a || {}).legendHTML || "", r = a.codePicker || "", o = a.conflictFilterBtn || "", s = a.count || 0;
    return `\n    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;padding:8px 12px;border:1px solid var(--border);border-radius:10px;background:linear-gradient(180deg,var(--bg2),rgba(255,255,255,0.96));">\n      ${r ? '<span id="sa-kbd-marker" style="display:none;"></span>' : ""}\n      ${r ? `<input class="filter-input" id="sa-search-input" style="width:200px;min-height:32px;" placeholder="Search name, username, emp#…" value="${_saSearchQuery || ""}" oninput="_saSearchQuery=this.value; var res=_liveFilterAttendance(); document.getElementById('sa-tbody').innerHTML=res.html; document.getElementById('sa-count-label').textContent=res.count + ' staff';">` : ""}\n      ${r ? '<div style="width:1px;height:18px;background:var(--border);"></div>' : ""}\n      ${r}\n      ${o}\n      ${_attCopiedCode && r ? `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--accent);color:#fff;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">📋 ${_attCopiedCode} <button onclick="_attCopiedCode='';nav('staff')" style="background:none;border:none;color:#fff;cursor:pointer;padding:0;font-size:12px;line-height:1;">✕</button></span>` : ""}\n      ${n ? '<div style="width:1px;height:18px;background:var(--border);"></div>' : ""}\n      ${n}\n      <span id="sa-count-label" style="font-size:11px;color:var(--text3);margin-left:auto;line-height:1;white-space:nowrap;">${s} staff</span>\n      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;line-height:1;">${e}</div>\n      <button class="btn btn-accent" onclick="openLeaveImportModal()" style="min-height:32px;padding:0 14px;font-size:11px;white-space:nowrap;">Import leave request</button>\n    </div>`;
}

function _attLeaveImportModalHTML() {
    return '<div id="modal-leave-import" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-leave-import\')"><div class="modal" style="width:min(980px,calc(100vw - 32px));max-width:980px;"><div class="modal-title">Import Leave Request</div><div style="display:grid;grid-template-columns:minmax(260px,1fr) minmax(320px,1.3fr);gap:14px;align-items:start;margin:14px 0;"><div style="display:flex;flex-direction:column;gap:12px;"><div style="font-size:12px;font-weight:600;">Import leave Excel</div><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><input type="file" id="leave-import-file" accept=".xlsx,.xls" style="font-size:11px;max-width:220px;"><button class="btn btn-accent btn-sm" onclick="importLeaveAttendanceExcel()">Import leave Excel</button></div><div style="font-size:11px;color:var(--text3);line-height:1.6;">Use the exported leave workbook, or paste copied rows from the leave website. Only approved requests will update attendance.</div></div><div style="display:flex;flex-direction:column;gap:8px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;"><div style="font-size:12px;font-weight:600;">Paste leave rows from website</div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-sm" onclick="pasteLeaveAttendanceClipboard()">Paste clipboard</button><button class="btn btn-accent btn-sm" onclick="importLeaveAttendancePaste()">Import pasted leave</button></div></div><textarea id="leave-paste-textarea" class="filter-input" style="width:100%;min-height:180px;resize:vertical;font-size:11px;line-height:1.45;font-family:\'IBM Plex Mono\',monospace;" placeholder="Paste copied leave table rows or copied page text here..."></textarea></div></div><div id="leave-import-status" style="font-size:11px;min-height:18px;color:var(--text2);margin-bottom:14px;"></div><div style="display:flex;justify-content:flex-end;gap:8px;"><button class="btn" onclick="closeModal(\'modal-leave-import\')">Close</button></div></div></div>';
}

function openLeaveImportModal() {
    document.getElementById("modal-leave-import") || document.body.insertAdjacentHTML("beforeend", _attLeaveImportModalHTML());
    var e = document.getElementById("leave-import-file");
    e && (e.value = "");
    var t = document.getElementById("leave-paste-textarea");
    t && (t.value = ""), _attSetImportStatus(""), document.getElementById("modal-leave-import").classList.add("show");
}

const _ATT_LEAVE_HEADER_GROUPS = {
    requestId: [ "ID đơn xin nghỉ", "ID đơn từ" ],
    employeeCode: [ "Mã NV" ],
    fullName: [ "Họ và tên", "Người dùng" ],
    status: [ "Trạng thái" ],
    leaveType: [ "Lý do" ],
    symbol: [ "Ký hiệu nghỉ" ],
    fromDate: [ "Từ ngày" ],
    toDate: [ "Đến ngày" ],
    shift: [ "Ca được phân bổ vào ngày nghỉ phép" ],
    days: [ "Số ngày" ],
    hours: [ "Số giờ" ],
    weeklyOff: [ "Ngày nghỉ tuần" ]
};

function _attEscapeHtml(e) {
    return String(e || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function _attSetImportStatus(e) {
    var t = document.getElementById("leave-import-status");
    t && (t.innerHTML = e);
}

function _attGetPasteTextarea() {
    var e = document.getElementById("leave-paste-textarea");
    return e && "TEXTAREA" === String(e.tagName || "").toUpperCase() ? e : null;
}

function _attNormalizeLabel(e) {
    return String(e || "").replace(/\u00a0/g, " ").replace(/[đĐ]/g, "d").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function _attLeaveHeaderIndexMap(e) {
    var t = (e || []).map(_attNormalizeLabel), a = {};
    return Object.keys(_ATT_LEAVE_HEADER_GROUPS).forEach(function(e) {
        var n = -1;
        (_ATT_LEAVE_HEADER_GROUPS[e] || []).some(function(e) {
            return -1 !== (n = t.indexOf(_attNormalizeLabel(e)));
        }), -1 !== n && (a[e] = n);
    }), a;
}

function _attExtractDateParts(e) {
    if (null == e || "" === e) return null;
    if ("number" == typeof e && e > 4e4 && e < 6e4) {
        var t = Date.UTC(1899, 11, 30) + 864e5 * Math.round(e), a = new Date(t);
        return {
            day: a.getUTCDate(),
            month: a.getUTCMonth() + 1,
            year: a.getUTCFullYear(),
            dateKey: String(a.getUTCDate()).padStart(2, "0") + "/" + String(a.getUTCMonth() + 1).padStart(2, "0")
        };
    }
    var n = String(e).replace(/\u00a0/g, " ").match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!n) return null;
    var r = parseInt(n[3], 10);
    return r < 100 && (r += 2e3), {
        day: parseInt(n[1], 10),
        month: parseInt(n[2], 10),
        year: r,
        dateKey: String(parseInt(n[1], 10)).padStart(2, "0") + "/" + String(parseInt(n[2], 10)).padStart(2, "0")
    };
}

function _attWorkingMonthKeyForDate(e) {
    var t = e.month, a = e.year;
    return e.day >= 25 && (t += 1) > 12 && (t = 1, a += 1), a + "-" + String(t).padStart(2, "0");
}

function _attEnumerateDateRange(e, t) {
    if (!e) return [];
    var a = new Date(e.year, e.month - 1, e.day), n = t ? new Date(t.year, t.month - 1, t.day) : new Date(a);
    n < a && (n = new Date(a));
    for (var r = [], o = new Date(a); o <= n; o.setDate(o.getDate() + 1)) r.push({
        day: o.getDate(),
        month: o.getMonth() + 1,
        year: o.getFullYear(),
        dateKey: String(o.getDate()).padStart(2, "0") + "/" + String(o.getMonth() + 1).padStart(2, "0")
    });
    return r;
}

function _attNormalizeShift(e) {
    var t = String(e || "").toUpperCase().trim();
    if (!t) return "";
    var a = t.match(/\bCA\s*([ADE])\b/);
    return a || (a = t.match(/\b([ADE])\b/)) ? a[1] : -1 !== [ "A", "D", "E" ].indexOf(t.charAt(0)) ? t.charAt(0) : "";
}

function _attLeaveBaseCode(e) {
    var t = String(e.symbol || "").toUpperCase().trim(), a = _attNormalizeLabel(e.leaveType || "");
    return "KL" === t || -1 !== a.indexOf("khong luong") ? "U" : "S" === t || -1 !== a.indexOf("bhxh") || -1 !== a.indexOf("nghi benh") ? "S" : "L" === t || -1 !== a.indexOf("social") || -1 !== a.indexOf("nghi hieu hi") || -1 !== a.indexOf("hieu hi") || -1 !== a.indexOf("nghi tang che huong luong") || -1 !== a.indexOf("tang che") || -1 !== a.indexOf("tu than phu mau") || -1 !== a.indexOf("personal") ? "L" : "P" === t || -1 !== a.indexOf("phep nam") || -1 !== a.indexOf("nghi phep") ? "A" : "";
}

function _attHalfType(e) {
    var t = _attNormalizeLabel(e);
    return -1 !== t.indexOf("nua ca dau") ? 2 : -1 !== t.indexOf("nua ca cuoi") ? 1 : 0;
}

function _attHalfDayCode(e, t, a) {
    return t && a ? "A" === e ? t + a : e + t + a : "";
}

function _attWeeklyOffDaySet(e) {
    var t = _attNormalizeLabel(e), a = {};
    return t ? (/(^|[^a-z0-9])cn([^a-z0-9]|$)|chu nhat/.test(t) && (a[0] = !0), /(^|[^a-z0-9])t2([^a-z0-9]|$)|thu 2/.test(t) && (a[1] = !0), 
    /(^|[^a-z0-9])t3([^a-z0-9]|$)|thu 3/.test(t) && (a[2] = !0), /(^|[^a-z0-9])t4([^a-z0-9]|$)|thu 4/.test(t) && (a[3] = !0), 
    /(^|[^a-z0-9])t5([^a-z0-9]|$)|thu 5/.test(t) && (a[4] = !0), /(^|[^a-z0-9])t6([^a-z0-9]|$)|thu 6/.test(t) && (a[5] = !0), 
    /(^|[^a-z0-9])t7([^a-z0-9]|$)|thu 7/.test(t) && (a[6] = !0), a) : a;
}

function _attCanonicalLeaveRow(e) {
    return {
        requestId: e.requestId || "",
        employeeCode: e.employeeCode || "",
        fullName: e.fullName || "",
        status: e.status || "",
        leaveType: e.leaveType || "",
        symbol: e.symbol || "",
        fromDate: e.fromDate || "",
        toDate: e.toDate || "",
        shift: e.shift || "",
        days: e.days || "",
        hours: e.hours || "",
        weeklyOff: e.weeklyOff || ""
    };
}

function _attDescribeLeaveRow(e) {
    var t = [], a = String(e.requestId || "").trim(), n = String(e.fullName || "").trim(), r = String(e.employeeCode || "").trim(), o = String(e.leaveType || e.symbol || "").trim(), s = String(e.fromDate || "").trim(), i = String(e.toDate || "").trim();
    return a && t.push("#" + a), n ? t.push(n) : r && t.push(r), !r || n && r === n || t.push("(" + r + ")"), 
    o && t.push("- " + o), (s || i) && t.push("- " + (s || "?") + " -> " + (i || s || "?")), 
    t.join(" ");
}

function _attNormalizedPersonName(e) {
    return _attNormalizeLabel(e || "").replace(/\s+/g, " ").trim();
}

function _attExplainUnmatchedUser(e, t) {
    var a = String(e || "").trim(), n = String(t || "").trim(), r = _attNormalizedPersonName(n);
    if (!a && !n) return "missing both employee code and full name";
    if (a) {
        var o = Object.entries(state.staffInfo || {}).find(function(e) {
            return String((e[1] || {}).empNo || "").trim() === a;
        });
        if (!o) return n ? "employee code not found; full name also did not match any app user" : "employee code not found in staff info";
        if (!state.users.find(function(e) {
            return e.username === o[0];
        })) return "employee code matched staff info but no app user exists";
    }
    return n ? state.users.find(function(e) {
        return _attNormalizedPersonName(e.name || "") === r;
    }) ? "matched by name" : Object.entries(state.staffInfo || {}).find(function(e) {
        return _attNormalizedPersonName((e[1] || {}).name || "") === r;
    }) ? "name matched staff info but no app user exists" : a ? "employee code and full name did not match any app user" : "full name did not match any app user" : "employee code did not map to an app user";
}

function _attRowsFromSheetMatrix(e, t) {
    var a = !1 !== (t = t || {}).requireStatus;
    if (!e || !e.length) return {
        rows: [],
        error: "Empty file."
    };
    for (var n = -1, r = null, o = 0; o < Math.min(e.length, 5); o++) {
        var s = _attLeaveHeaderIndexMap(e[o] || []);
        if (!(void 0 === s.fullName && void 0 === s.employeeCode || a && void 0 === s.status || void 0 === s.fromDate || void 0 === s.toDate || void 0 === s.requestId || void 0 === s.leaveType && void 0 === s.symbol)) {
            n = o, r = s;
            break;
        }
    }
    if (-1 === n || !r) return {
        rows: [],
        error: "Leave import headers were not detected."
    };
    var i = [], l = 0;
    return e.slice(n + 1).forEach(function(e) {
        if (e && e.length) {
            var t = {};
            Object.keys(r).forEach(function(a) {
                t[a] = e[r[a]];
            });
            var n = _attCanonicalLeaveRow(t);
            (n.requestId || n.employeeCode || n.fullName) && (n.requestId && (n.employeeCode || n.fullName) && (!a || n.status) && n.fromDate && n.toDate && (n.leaveType || n.symbol) ? i.push(n) : l += 1);
        }
    }), !i.length && l ? {
        rows: [],
        error: "Pasted leave rows are misaligned or missing required columns."
    } : l ? {
        rows: [],
        error: "Pasted leave data is misaligned. Please copy the website table with headers before importing."
    } : {
        rows: i,
        error: ""
    };
}

function _attDelimitedCells(e, t) {
    return "\t" === t ? String(e).split("\t") : "spaces" === t ? String(e).trim().split(/\s{2,}/) : String(e).split(t);
}

function _attRowsFromWrappedWebsiteText(e) {
    var t = String(e || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map(function(e) {
        return String(e || "").trim();
    }).filter(Boolean);
    if (!t.length) return {
        rows: [],
        error: "Paste some leave rows first."
    };
    var a = [], n = null;
    if (t.forEach(function(e) {
        if (e.match(/^(\d{3,})\s+(.+)$/)) return n && a.push(n), void (n = [ e ]);
        n && n.push(e);
    }), n && a.push(n), !a.length) return {
        rows: [],
        error: "Pasted leave data is misaligned. Please copy the website rows."
    };
    var r = [], o = 0;
    return a.forEach(function(e) {
        var t = (e[0] || "").match(/^(\d{3,})\s+(.+)$/);
        if (t) {
            for (var a, n = t[1], s = t[2].trim(), i = e.slice(1).join(" ").replace(/\s+/g, " ").trim(), l = /(?:Nửa ca (?:đầu|cuối)\s+)?\d{1,2}\/\d{1,2}\/\d{4}/gi, d = []; (a = l.exec(i)) && (d.push({
                text: a[0],
                index: a.index
            }), !(d.length >= 2)); ) ;
            if (d.length < 2) o += 1; else {
                var p = i.slice(0, d[0].index).trim(), c = i.slice(d[1].index + d[1].text.length).trim();
                if (p && c) {
                    var f = c.match(/\b(?:CA\s*)?([ADE])\b/i), u = c.match(/\b(KL|P|S|L)\b/i), m = c.match(/(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/), g = c;
                    f && (g = g.replace(f[0], " ")), u && (g = g.replace(u[0], " ")), m && (g = g.replace(m[1], " ")), 
                    g = g.replace(/\s+/g, " ").trim();
                    var v = _attCanonicalLeaveRow({
                        requestId: n,
                        fullName: s,
                        leaveType: p,
                        fromDate: d[0].text,
                        toDate: d[1].text,
                        shift: f ? f[1].toUpperCase() : "",
                        symbol: u ? u[1].toUpperCase() : "",
                        days: m ? m[1] : "",
                        weeklyOff: g
                    });
                    v.requestId && v.fullName && v.fromDate && v.toDate && (v.leaveType || v.symbol) ? r.push(v) : o += 1;
                } else o += 1;
            }
        } else o += 1;
    }), r.length ? {
        rows: r,
        error: ""
    } : {
        rows: [],
        error: o ? "Pasted leave data is misaligned. Please copy the website rows." : "Paste some leave rows first."
    };
}

function _attRowsFromClipboardText(e) {
    var t = String(e || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!t) return {
        rows: [],
        error: "Paste some leave rows first."
    };
    var a = t.split("\n").map(function(e) {
        return e.trimEnd();
    }).filter(Boolean), n = a.some(function(e) {
        return -1 !== e.indexOf("\t");
    }), r = a.some(function(e) {
        return -1 !== e.indexOf("|");
    });
    if (n || r) {
        var o = n ? "\t" : "|", s = _attRowsFromSheetMatrix(a.map(function(e) {
            return _attDelimitedCells(e, o).map(function(e) {
                return String(e || "").trim();
            });
        }), {
            requireStatus: !1
        });
        return s.error ? (i = _attRowsFromWrappedWebsiteText(t)).error ? {
            rows: [],
            error: i.error || s.error || "Pasted leave data is misaligned. Please copy the website table with headers."
        } : i : s;
    }
    var i, l = t.split(/\n{2,}/).map(function(e) {
        return e.trim();
    }).filter(Boolean), d = [];
    return l.forEach(function(e) {
        var t = {};
        Object.keys(_ATT_LEAVE_HEADER_GROUPS).forEach(function(a) {
            (_ATT_LEAVE_HEADER_GROUPS[a] || []).some(function(n) {
                var r = new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:\\-]?\\s*(.+)", "i"), o = e.match(r);
                return !!o && (t[a] = o[1].split("\n")[0].trim(), !0);
            });
        }), (t.requestId || t.employeeCode || t.fullName) && t.fromDate && t.toDate && (t.fullName || t.employeeCode) && (t.leaveType || t.symbol) && d.push(_attCanonicalLeaveRow(t));
    }), d.length ? {
        rows: d,
        error: ""
    } : (i = _attRowsFromWrappedWebsiteText(t)).error ? {
        rows: [],
        error: "Pasted leave data is misaligned. Please copy the website table with headers or paste labeled leave details."
    } : i;
}

function _attFindMatchedUser(e, t) {
    var a = String(e || "").trim(), n = String(t || "").trim(), r = _attNormalizedPersonName(n), o = null;
    if (a) {
        var s = Object.entries(state.staffInfo || {}).find(function(e) {
            return String((e[1] || {}).empNo || "").trim() === a;
        });
        s && (o = state.users.find(function(e) {
            return e.username === s[0];
        }) || {
            username: s[0],
            name: s[1].name || n,
            id: null
        });
    }
    if (!o && n && (o = state.users.find(function(e) {
        return _attNormalizedPersonName(e.name || "") === r;
    }) || null), !o && n) {
        var i = Object.entries(state.staffInfo || {}).find(function(e) {
            return _attNormalizedPersonName((e[1] || {}).name || "") === r;
        });
        i && (o = {
            username: i[0],
            name: i[1].name || n,
            id: null
        });
    }
    return o;
}

function _attIsApprovedStatus(e) {
    var t = _attNormalizeLabel(e);
    return "da duyet" === t || -1 !== t.indexOf("approved");
}

function _attNormalizeLeaveCells(e, t) {
    var a = String(e.requestId || "").trim(), n = _attFindMatchedUser(e.employeeCode, e.fullName);
    if (!a) return {
        error: "Missing request ID."
    };
    if (!n) return {
        requestId: a,
        skipped: "unmatched",
        unmatchedReason: _attExplainUnmatchedUser(e.employeeCode, e.fullName)
    };
    if ("paste" !== t && !_attIsApprovedStatus(e.status)) return {
        requestId: a,
        skipped: "status",
        user: n
    };
    if ("paste" === t && e.status && !_attIsApprovedStatus(e.status)) return {
        requestId: a,
        skipped: "status",
        user: n
    };
    var r = _attLeaveBaseCode(e);
    if (!r) return {
        requestId: a,
        skipped: "type",
        user: n
    };
    var o = _attExtractDateParts(e.fromDate), s = _attExtractDateParts(e.toDate) || o;
    if (!o || !s) return {
        error: "Missing leave date.",
        requestId: a,
        user: n
    };
    var i = _attNormalizeShift(e.shift), l = _attEnumerateDateRange(o, s);
    if (!l.length) return {
        error: "No dates in range.",
        requestId: a,
        user: n
    };
    var d = String(e.detailRange || "");
    d || (d = String(e.fromDate || "") + " - " + String(e.toDate || ""));
    var p = d.split(/\s*[\u2012\u2013\u2014-]+\s*/).filter(Boolean), c = p.length ? _attHalfType(p[0]) : 0, f = p.length > 1 ? _attHalfType(p[1]) : c, u = p.length ? _attExtractDateParts(p[0]) : null, m = p.length > 1 ? _attExtractDateParts(p[1]) : u, g = _attWeeklyOffDaySet(e.weeklyOff), v = [];
    return l.forEach(function(e, t) {
        var a = r, o = new Date(e.year, e.month - 1, e.day).getDay(), s = 0 === t, d = t === l.length - 1;
        "A" === r && g[o] ? a = "0" : 1 === l.length && c && f ? c === f && (a = _attHalfDayCode(r, i, c)) : (s && c && u && u.dateKey === e.dateKey && (a = _attHalfDayCode(r, i, c)), 
        d && f && m && m.dateKey === e.dateKey && (a = _attHalfDayCode(r, i, f)), s && d && c && f && c !== f && (a = r)), 
        a && v.push({
            username: n.username,
            dateKey: e.dateKey,
            monthKey: _attWorkingMonthKeyForDate(e),
            code: a
        });
    }), v.length ? {
        requestId: a,
        user: n,
        writes: v,
        fingerprint: JSON.stringify([ e.employeeCode, e.fullName, e.status, e.leaveType, e.symbol, e.fromDate, e.toDate, e.shift, e.days, e.hours, e.weeklyOff ])
    } : {
        error: "No attendance code generated.",
        requestId: a,
        user: n
    };
}

function _attCellSourceKey(e, t, a) {
    return e + "|" + t + "|" + a;
}

function _attEnsureLeaveImportState() {
    state.leaveImportHistory || (state.leaveImportHistory = {}), state.leaveImportCellSources || (state.leaveImportCellSources = {});
}

function _attRemoveImportedRequest(e) {
    _attEnsureLeaveImportState();
    var t = state.leaveImportHistory[e];
    return !(!t || !t.writes) && (t.writes.forEach(function(t) {
        var a = _attCellSourceKey(t.username, t.monthKey, t.dateKey);
        state.leaveImportCellSources[a] === e && (state.monthlyAttendance[t.username] || (state.monthlyAttendance[t.username] = {}), 
        state.monthlyAttendance[t.username][t.monthKey] || (state.monthlyAttendance[t.username][t.monthKey] = {}), 
        t.previousCode ? state.monthlyAttendance[t.username][t.monthKey][t.dateKey] = t.previousCode : delete state.monthlyAttendance[t.username][t.monthKey][t.dateKey], 
        t.previousSource ? state.leaveImportCellSources[a] = t.previousSource : delete state.leaveImportCellSources[a]);
    }), delete state.leaveImportHistory[e], !0);
}

function _attLeaveConflictHtml(e) {
    var t = [], a = {}, n = {};
    if ((e || []).forEach(function(e) {
        e && e.username && e.dateKey && (n[e.username + "|" + e.dateKey] = !0);
    }), Object.keys(state.logbook || {}).forEach(function(e) {
        var a = state.logbook[e];
        if (a && !a._deleted && (a.start || a.end)) {
            var r = e.split("_"), o = parseInt(r[0], 10), s = r[1], i = state.users.find(function(e) {
                return e.id === o;
            });
            if (i && (!Object.keys(n).length || n[i.username + "|" + s])) {
                var l = "function" == typeof _getMonthlyAttendanceCode ? _getMonthlyAttendanceCode(i.username, s) : "";
                if (l) {
                    var d = _parseAttCode(l);
                    !d || "OFF" !== d.type && "HD1" !== d.type && "HD2" !== d.type || t.push({
                        name: i.name || i.username || "Unknown",
                        dk: s,
                        code: l,
                        reason: d.reason || d.type
                    });
                }
            }
        }
    }), !t.length) return "";
    t.forEach(function(e) {
        a[e.name] || (a[e.name] = []), a[e.name].push(e);
    });
    var r = Object.keys(a).sort().map(function(e) {
        var t = a[e].map(function(e) {
            return _attEscapeHtml(e.dk) + " (" + _attEscapeHtml(e.code) + ": " + _attEscapeHtml(e.reason) + ")";
        });
        return "<div><b>" + _attEscapeHtml(e) + "</b>: " + t.join(" · ") + "</div>";
    }).join("");
    return '<div style="margin-top:10px;padding:8px 12px;background:var(--D-bg);border:1px solid var(--err);border-radius:6px;font-size:11px;color:var(--err);line-height:1.8;">⚠ <b>' + t.length + " retroactive conflict" + (t.length > 1 ? "s" : "") + " found</b> - time was already logged on these OFF/half-day dates:<br>" + r + '<br><span style="color:var(--text3);">Go to Logbook to review and clear these entries.</span></div>';
}

function _attApplyLeaveImport(e, t) {
    _attEnsureLeaveImportState(), state.monthlyAttendance || (state.monthlyAttendance = {});
    var a = {
        total: e.length,
        applied: 0,
        replaced: 0,
        skippedStatus: 0,
        skippedUnmatched: 0,
        skippedType: 0,
        parseErrors: 0
    }, n = [], r = [], o = [];
    e.forEach(function(e) {
        var s = _attNormalizeLeaveCells(e, t);
        if (s.error) return a.parseErrors += 1, void r.push((e.fullName || e.employeeCode || e.requestId || "Unknown row") + ": " + s.error);
        if ("unmatched" === s.skipped) return a.skippedUnmatched += 1, void n.push({
            label: _attDescribeLeaveRow(e) || "Unknown user",
            reason: s.unmatchedReason || "could not match to any app user"
        });
        if ("status" !== s.skipped) {
            if ("type" === s.skipped) return a.skippedType += 1, void r.push((e.fullName || e.requestId || "Unknown row") + ": unsupported leave type.");
            _attRemoveImportedRequest(s.requestId) && (a.replaced += 1);
            var i = [];
            s.writes.forEach(function(e) {
                state.monthlyAttendance[e.username] || (state.monthlyAttendance[e.username] = {}), 
                state.monthlyAttendance[e.username][e.monthKey] || (state.monthlyAttendance[e.username][e.monthKey] = {});
                var t = _attCellSourceKey(e.username, e.monthKey, e.dateKey), a = state.monthlyAttendance[e.username][e.monthKey][e.dateKey] || "", n = state.leaveImportCellSources[t] || "";
                state.monthlyAttendance[e.username][e.monthKey][e.dateKey] = e.code, state.leaveImportCellSources[t] = s.requestId, 
                i.push({
                    username: e.username,
                    monthKey: e.monthKey,
                    dateKey: e.dateKey,
                    code: e.code,
                    previousCode: a,
                    previousSource: n
                }), o.push({
                    username: e.username,
                    monthKey: e.monthKey,
                    dateKey: e.dateKey,
                    code: e.code
                });
            }), state.leaveImportHistory[s.requestId] = {
                requestId: s.requestId,
                username: s.user.username,
                sourceType: t,
                fingerprint: s.fingerprint,
                writes: i,
                importedAt: Date.now()
            }, a.applied += 1;
        } else a.skippedStatus += 1;
    }), save(), "function" == typeof syncWrite && syncWrite();
    var s = '<span style="color:var(--ok);">✓ ' + a.applied + " approved request" + (1 !== a.applied ? "s" : "") + ' applied</span> <span style="color:var(--text3);">from ' + a.total + " row" + (1 !== a.total ? "s" : "") + " · replaced " + a.replaced + " · skipped status " + a.skippedStatus + " · unmatched " + a.skippedUnmatched + " · unsupported " + a.skippedType + " · errors " + a.parseErrors + "</span>";
    n.length && (s += '<div style="margin-top:6px;color:var(--warn);">Unmatched:</div><div style="margin-top:4px;color:var(--warn);font-size:11px;line-height:1.6;">' + n.slice(0, 8).map(function(e) {
        return "• " + _attEscapeHtml(e.label) + " — " + _attEscapeHtml(e.reason);
    }).join("<br>") + (n.length > 8 ? "<br>..." : "") + "</div>"), r.length && (s += '<div style="margin-top:6px;color:var(--err);">Issues: ' + _attEscapeHtml(r.slice(0, 4).join(" | ")) + (r.length > 4 ? " ..." : "") + "</div>"), 
    s += _attLeaveConflictHtml(o), nav("staff"), _attSetImportStatus(s);
}

function importLeaveAttendanceExcel() {
    var e = document.getElementById("leave-import-file");
    if (e && e.files && e.files[0]) {
        _attSetImportStatus('<span style="color:var(--text2);">Reading leave Excel...</span>');
        var t = new FileReader;
        t.onload = function(e) {
            try {
                var t = XLSX.read(e.target.result, {
                    type: "array",
                    cellDates: !1
                }), a = t.Sheets[t.SheetNames[0]], n = _attRowsFromSheetMatrix(XLSX.utils.sheet_to_json(a, {
                    header: 1,
                    defval: "",
                    raw: !0
                }));
                if (n.error) return void _attSetImportStatus('<span style="color:var(--err);">' + _attEscapeHtml(n.error) + "</span>");
                _attApplyLeaveImport(n.rows, "excel");
            } catch (e) {
                _attSetImportStatus('<span style="color:var(--err);">Error: ' + _attEscapeHtml(e.message) + "</span>");
            }
        }, t.readAsArrayBuffer(e.files[0]);
    } else _attSetImportStatus('<span style="color:var(--err);">Select a leave Excel file first.</span>');
}

async function pasteLeaveAttendanceClipboard() {
    var e = _attGetPasteTextarea();
    if (e) try {
        e.value = await navigator.clipboard.readText(), _attSetImportStatus('<span style="color:var(--text2);">Clipboard pasted. Review it, then click "Import pasted leave".</span>');
    } catch (e) {
        _attSetImportStatus('<span style="color:var(--err);">Clipboard access failed. Paste into the textbox manually.</span>');
    } else _attSetImportStatus('<span style="color:var(--err);">Paste area was not found. Refresh Staff Attendance and try again.</span>');
}

function importLeaveAttendancePaste() {
    var e = _attGetPasteTextarea();
    if (e) {
        var t = _attRowsFromClipboardText(e ? e.value : "");
        t.error ? _attSetImportStatus('<span style="color:var(--err);">' + _attEscapeHtml(t.error) + "</span>") : (_attSetImportStatus('<span style="color:var(--text2);">Parsing pasted leave...</span>'), 
        _attApplyLeaveImport(t.rows, "paste"));
    } else _attSetImportStatus('<span style="color:var(--err);">Paste area was not found. Refresh Staff Attendance and try again.</span>');
}

function clearMonthlyAttendance(e, t) {
    const a = new Date(e, t - 1).toLocaleString("en-US", {
        month: "long",
        year: "numeric"
    });
    if (!confirm(`Clear attendance data for ${a}?`)) return;
    const n = `${e}-${String(t).padStart(2, "0")}`;
    state.monthlyAttendance && Object.keys(state.monthlyAttendance).forEach(e => {
        state.monthlyAttendance[e] && delete state.monthlyAttendance[e][n];
    }), save(), nav("staff");
}

var _ssVisibleUsers = [], _ssManagerSwap = {
    username: "",
    day: ""
};

function _ssCanManageSchedule() {
    return isLeader(currentUser) || isTraining(currentUser);
}

function _ssIsFutureDayoff(e) {
    return _isFutureDayoff(e, 1);
}

function _ssManagerIgnoreModalHTML() {
    return '<div id="modal-staff-dayoff-ignore" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-staff-dayoff-ignore\')"><div class="modal" style="width:420px;"><div class="modal-title">Direct Swap Ignored</div><div id="ss-manager-ignore-msg" style="font-size:13px;line-height:1.6;color:var(--text2);margin:14px 0 18px 0;"></div><div style="display:flex;justify-content:flex-end;"><button class="btn btn-accent" onclick="closeModal(\'modal-staff-dayoff-ignore\')">OK</button></div></div></div>';
}

function _ssShowManagerIgnoreModal(e) {
    document.getElementById("modal-staff-dayoff-ignore") || document.body.insertAdjacentHTML("beforeend", _ssManagerIgnoreModalHTML()), 
    document.getElementById("ss-manager-ignore-msg").textContent = e, document.getElementById("modal-staff-dayoff-ignore").classList.add("show");
}

function _ssGetSwapGroup(e) {
    if (!e) return "";
    var t = e.role || (state.staffInfo[e.username] || {}).role || "", a = e.team || (state.staffInfo[e.username] || {}).team || "", n = _resolveRole(t, a) || t || "";
    return "Data Analyst Leader" === n || "Data Analyst Supervisor" === n ? "lead" : "Training Manager" === n || "Training Assistant" === n ? "training" : "Sr Data Supervisor" === n ? "sr-ds" : "Data Supervisor" === n ? "ds" : "Data Analyst" === n || "Sr Data Analyst" === n ? "da" : "";
}

function _ssManagerSwapModalHTML() {
    return '<div id="modal-staff-dayoff-swap" class="modal-overlay" onclick="if(event.target===this)closeModal(\'modal-staff-dayoff-swap\')"><div class="modal" style="width:440px;"><div class="modal-title">Apply Day-Off Swap</div><div style="margin-bottom:12px;"><div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Selected staff day off</div><div id="ss-manager-swap-source" style="font-size:14px;font-weight:700;color:var(--accent);"></div></div><div style="margin-bottom:12px;"><div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Swap with visible staff</div><select id="ss-manager-target-user" class="login-select" style="width:100%;font-size:13px;" onchange="_ssManagerSwapUpdateDates()"><option value="">- Select person -</option></select></div><div id="ss-manager-target-date-wrap" style="margin-bottom:12px;"></div><div id="ss-manager-swap-msg" style="display:none;margin-bottom:10px;padding:8px 10px;background:rgba(239,68,68,.1);border-left:3px solid var(--err);border-radius:4px;font-size:12px;color:var(--err);"></div><div style="margin-bottom:16px;"><div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Reason (optional)</div><input id="ss-manager-reason" class="login-input" style="width:100%;box-sizing:border-box;font-size:13px;" placeholder="e.g. coverage adjustment" /></div><div style="display:flex;gap:8px;justify-content:flex-end;"><button class="btn" onclick="closeModal(\'modal-staff-dayoff-swap\')">Cancel</button><button class="btn btn-accent" id="ss-manager-submit" onclick="_ssSubmitManagerDayoffSwap()">Apply Now</button></div></div></div>';
}

function _ssOpenManagerDayoffSwap(e, t) {
    if (_ssCanManageSchedule()) if (_ssIsFutureDayoff(t)) if (_getUserWeekShiftSummary(e, t, t).distinctShifts.length > 1) {
        _ssShowManagerIgnoreModal((state.users.find(function(t) {
            return t.username === e;
        }) || {
            name: e
        }).name + " changes shift in this week, so direct schedule swap is ignored.");
    } else {
        document.getElementById("modal-staff-dayoff-swap") || document.body.insertAdjacentHTML("beforeend", _ssManagerSwapModalHTML()), 
        _ssManagerSwap.username = e, _ssManagerSwap.day = t, document.getElementById("ss-manager-reason").value = "", 
        document.getElementById("ss-manager-target-date-wrap").innerHTML = "", document.getElementById("ss-manager-swap-msg").style.display = "none", 
        document.getElementById("ss-manager-submit").disabled = !1, document.getElementById("ss-manager-submit").style.opacity = "";
        var a = state.users.find(function(t) {
            return t.username === e;
        }) || {
            name: e
        };
        document.getElementById("ss-manager-swap-source").textContent = a.name + " - " + t + " (" + getWkDay(t) + ")";
        var n = _ssGetSwapGroup(a), r = _ssVisibleUsers.filter(function(t) {
            return !(!t || t.username === e) && (!(!n || _ssGetSwapGroup(t) !== n) && Object.keys(state.staffSchedule[t.username] || {}).some(function(e) {
                return _ssIsFutureDayoff(e) && "0" === _getSched(t.username, e);
            }));
        });
        document.getElementById("ss-manager-target-user").innerHTML = '<option value="">- Select person -</option>' + r.map(function(e) {
            return '<option value="' + e.username + '">' + e.name + " (" + (e.team || "?") + ")</option>";
        }).join(""), document.getElementById("modal-staff-dayoff-swap").classList.add("show");
    } else toast("Direct schedule swap is only available for future day-offs.", "err");
}

function _ssManagerSwapUpdateDates() {
    var e = document.getElementById("ss-manager-target-user").value, t = document.getElementById("ss-manager-target-date-wrap");
    if (document.getElementById("ss-manager-swap-msg").style.display = "none", e && _ssManagerSwap.day) {
        var a = Object.keys(state.staffSchedule[e] || {}).filter(function(t) {
            return _ssIsFutureDayoff(t) && "0" === _getSched(e, t);
        });
        0 !== (a = _sortDateKeys(a)).length ? t.innerHTML = '<div style="font-size:12px;color:var(--text2);margin-bottom:4px;">Their future day off</div><select id="ss-manager-target-date" class="login-select" style="width:100%;font-size:13px;" onchange="_ssManagerSwapValidate()"><option value="">- Select date -</option>' + a.map(function(e) {
            return '<option value="' + e + '">' + e + " (" + getWkDay(e) + ")</option>";
        }).join("") + "</select>" : t.innerHTML = '<div style="font-size:12px;color:var(--text3);">No future day off available for this person.</div>';
    } else t.innerHTML = "";
}

function _ssManagerSwapValidate() {
    var e = document.getElementById("ss-manager-target-user").value, t = document.getElementById("ss-manager-target-date"), a = t ? t.value : "", n = document.getElementById("ss-manager-swap-msg"), r = document.getElementById("ss-manager-submit");
    if (!(_ssManagerSwap.username && _ssManagerSwap.day && e && a)) return n.style.display = "none", 
    void (r && (r.disabled = !1, r.style.opacity = ""));
    var o = _checkManagerDirectDayoffSwapValid(_ssManagerSwap.username, _ssManagerSwap.day, e, a);
    if (!o.ok) return "shift-transition" === o.blockType ? (n.style.display = "none", 
    void (r && (r.disabled = !1, r.style.opacity = ""))) : (n.textContent = "! " + o.reason, 
    n.style.display = "block", void (r && (r.disabled = !0, r.style.opacity = "0.5")));
    n.style.display = "none", r && (r.disabled = !1, r.style.opacity = "");
}

function _ssSubmitManagerDayoffSwap() {
    var e = document.getElementById("ss-manager-target-user").value, t = document.getElementById("ss-manager-target-date"), a = t ? t.value : "", n = (document.getElementById("ss-manager-reason").value || "").trim();
    if (_ssManagerSwap.username && _ssManagerSwap.day) if (e && a) {
        var r = _checkManagerDirectDayoffSwapValid(_ssManagerSwap.username, _ssManagerSwap.day, e, a);
        if (!r.ok) return "shift-transition" === r.blockType ? (closeModal("modal-staff-dayoff-swap"), 
        void _ssShowManagerIgnoreModal(r.reason)) : void toast("Cannot apply swap: " + r.reason, "err");
        var o = state.users.find(function(e) {
            return e.username === _ssManagerSwap.username;
        }), s = state.users.find(function(t) {
            return t.username === e;
        });
        if (o && s) _createDayoffSwapRequest({
            requesterUser: o,
            targetUser: s,
            myDate: _ssManagerSwap.day,
            theirDate: a,
            reason: n,
            status: "approved",
            resolvedBy: currentUser.id,
            resolvedAt: Date.now(),
            source: "staff-schedule-manager",
            requesterShift: r.sourceShift || "",
            targetShift: r.targetShift || "",
            applyImmediately: !0
        }) ? ("function" == typeof syncWrite ? syncWrite() : save(), closeModal("modal-staff-dayoff-swap"), 
        toast("Day-off swap applied. Google Sheet writeback will follow the sync flow.", "ok"), 
        nav("staff")) : toast("Could not create the schedule change request.", "err"); else toast("Unable to find the selected staff.", "err");
    } else toast("Select the swap person and their day off.", "err"); else toast("Select a day-off cell first.", "err");
}

function renderStaffRows(e, t) {
    _ssVisibleUsers = (e || []).slice();
    var a = !isLeader(currentUser) && !isTraining(currentUser), n = _ssCanManageSchedule(), r = (new Date).setHours(0, 0, 0, 0), o = (new Date).getFullYear();
    return e.map(function(e) {
        var s = e.role || (state.staffInfo[e.username] || {}).role || "", i = e.username === currentUser.username && a;
        return '<tr><td class="mono" style="font-size:11px;position:sticky;left:0;z-index:2;background:var(--bg3);min-width:60px;width:60px;">' + (e.team || "—") + '</td><td style="font-weight:600;position:sticky;left:60px;z-index:2;background:var(--bg3);min-width:200px;width:200px;">' + e.name + '</td><td class="mono" style="color:var(--accent);font-size:11px;position:sticky;left:260px;z-index:2;background:var(--bg3);min-width:130px;width:130px;">' + (e.username || "") + '</td><td style="font-size:11px;color:' + _roleColor(s, e.team) + ';position:sticky;left:390px;z-index:2;background:var(--bg3);min-width:140px;width:140px;box-shadow:3px 0 6px rgba(0,0,0,.12);">' + (getRoleInfo(s, e.team).label || _resolveRole(s, e.team) || "—") + "</td>" + t.map(function(t) {
            var a = _getSched(e.username, t), s = t === _ssFilterDk && "All" !== _ssShiftFilter ? "background:rgba(31,102,241,0.06) !important;" : "";
            if (n && "0" === a && _ssIsFutureDayoff(t)) return '<td class="c" style="cursor:pointer;' + s + '" onclick="_ssOpenManagerDayoffSwap(\'' + e.username + "','" + t + '\')" title="Apply day-off swap"><span class="sh sh-0">-</span><div style="font-size:8px;color:var(--accent);margin-top:1px;line-height:1;">SW</div></td>';
            if (i && "0" === a) {
                var l = t.split("/"), d = new Date(o, parseInt(l[1]) - 1, parseInt(l[0]));
                if (Math.floor((d - r) / 864e5) >= 2) return '<td class="c" style="cursor:pointer;' + s + '" onclick="openDayoffSwapModal(\'' + t + '\')" title="Request day-off swap"><span class="sh sh-0">—</span><div style="font-size:8px;color:var(--accent);margin-top:1px;line-height:1;">↔</div></td>';
            }
            return '<td class="c" style="' + s + '"><span class="sh sh-' + a + '">' + ("0" === a ? "—" : a) + "</span></td>";
        }).join("") + "</tr>";
    }).join("");
}

var _STAFF_SORT_RANK = {
    "Training Manager": 1,
    "Training Assistant": 2,
    "Data Analyst Leader": 3,
    Leader: 3,
    "Data Analyst Supervisor": 4,
    Supervisor: 4,
    "Sr Data Supervisor": 5,
    "Data Supervisor": 6,
    "Sr Data Analyst": 7,
    "Data Analyst": 8
};

function _sortStaffUsers(e) {
    var t = function(e) {
        if (!e) return 99;
        var t = String(e).toUpperCase();
        return 0 === t.indexOf("DAL") ? 1 : 0 === t.indexOf("DAS") ? 2 : 0 === t.indexOf("SDS") ? 3 : 0 === t.indexOf("I-SDS") ? 4 : 0 === t.indexOf("DS") ? 5 : 0 === t.indexOf("SR") ? 6 : 0 === t.indexOf("DA") ? 7 : 99;
    };
    return e.filter(function(e) {
        var t = e.role || (state.staffInfo[e.username] || {}).role || "";
        return !!_resolveRole(t, e.team);
    }).sort(function(e, a) {
        var n = e.role || (state.staffInfo[e.username] || {}).role || "", r = a.role || (state.staffInfo[a.username] || {}).role || "", o = _resolveRole(n, e.team) || n, s = _resolveRole(r, a.team) || r, i = _STAFF_SORT_RANK[o] || 99, l = _STAFF_SORT_RANK[s] || 99;
        if (i !== l) return i - l;
        var d = e.team || "", p = a.team || "", c = t(d), f = t(p);
        if (c !== f) return c - f;
        var u = d.match(/\d+/), m = p.match(/\d+/), g = u ? parseInt(u[0], 10) : 0, v = m ? parseInt(m[0], 10) : 0;
        return g !== v ? g - v : d !== p ? d.localeCompare(p) : (e.name || "").localeCompare(a.name || "");
    });
}

function _liveFilter() {
    var e = {};
    Object.values(state.staffSchedule || {}).forEach(function(t) {
        Object.keys(t || {}).forEach(function(t) {
            /^\d{2}\/\d{2}$/.test(t) && t.split("/")[1] === _schedMonth && (e[t] = 1);
        });
    });
    const t = _sortDateKeys(Object.keys(e));
    var a = isTraining(currentUser);
    const n = state.users.filter(e => {
        if ("tuan.mai" === e.username || "nhon.bui" === e.username) return !1;
        var t = e.role || (state.staffInfo[e.username] || {}).role || "", n = (_resolveRole(t, e.team) || "").toLowerCase(), r = (e.team || "").toUpperCase().charAt(0), o = isTraining(e) || n.includes("training") || "T" === r;
        if (!a && o) return !1;
        var s = _attNormalizeLabel(staffFilters.search || "");
        return !s || (_attNormalizeLabel(e.team || "").includes(s) || _attNormalizeLabel(e.name || "").includes(s) || _attNormalizeLabel(e.username || "").includes(s) || _attNormalizeLabel(n).includes(s));
    });
    var r;
    r = _ssFilterDk && "All" !== _ssShiftFilter ? n.filter(function(e) {
        return (_getSched(e.username, _ssFilterDk) || "").charAt(0) === _ssShiftFilter;
    }) : "All" === _ssShiftFilter ? n : n.filter(function(e) {
        return t.some(function(t) {
            return (_getSched(e.username, t) || "").charAt(0) === _ssShiftFilter;
        });
    });
    const o = document.getElementById("staff-tbody");
    o && (o.innerHTML = renderStaffRows(_sortStaffUsers(r), t));
    const s = document.querySelector("#staff-subtab-content .page-sub");
    s && (s.textContent = `${r.length} staff`);
}

var _POS_MAP = {
    "training manager": "Agent Training Manager",
    "training assistant": "Agent Training Assistant",
    "data analyst leader": "Data Analyst Leader",
    "data analyst supervisor": "Data Analyst Supervisor",
    leader: "Data Analyst Leader",
    supervisor: "Data Analyst Supervisor",
    "sr data supervisor": "Sr Data Supervisor",
    "sr data analyst": "Sr Data Analyst",
    "data supervisor": "Data Supervisor",
    "data analyst": "Data Analyst",
    "inspection manager": "Admin"
};

function importExcelStaffInfo() {
    const e = document.getElementById("excel-file-input"), t = document.getElementById("excel-import-status");
    if (!e || !e.files || !e.files[0]) return void (t.innerHTML = '<span style="color:var(--err);">⚠ Please choose a file first.</span>');
    const a = e.files[0];
    t.innerHTML = '<span style="color:var(--text2);">Reading file…</span>';
    const n = new FileReader;
    n.onload = e => {
        try {
            if ("undefined" == typeof XLSX) return void (t.innerHTML = '<span style="color:var(--err);">SheetJS not loaded. Check internet connection.</span>');
            const n = XLSX.read(e.target.result, {
                type: "array"
            }), r = n.Sheets[n.SheetNames[0]], o = XLSX.utils.sheet_to_json(r, {
                defval: ""
            });
            if (!o.length) return void (t.innerHTML = '<span style="color:var(--err);">⚠ No rows found in sheet.</span>');
            const s = o[0], i = Object.keys(s);
            function a(e) {
                return i.find(t => t.toLowerCase().replace(/\s+/g, "").replace(/\n/g, "").includes(e.toLowerCase())) || null;
            }
            const l = a("name"), d = a("username"), p = a("gender"), c = a("birth") || a("dob"), f = a("position") || a("role"), u = a("employee") || a("empno") || a("number"), m = a("active"), g = a("phone");
            if (!l || !d) return void (t.innerHTML = `<span style="color:var(--err);">⚠ Could not find Name/Username columns. Found: ${i.slice(0, 6).join(", ")}</span>`);
            let v = 0;
            o.forEach(e => {
                const t = String(e[d] || "").trim(), a = String(e[l] || "").trim();
                if (!t || !a) return;
                const n = String(e[p] || "").trim().toLowerCase(), r = n.includes("female") || "f" === n ? "F" : n.includes("male") || "m" === n ? "M" : "", o = String(e[c] || "").trim(), s = String(e[f] || "").trim(), i = _POS_MAP[s.toLowerCase()] || s, y = String(e[u] || "").trim(), h = String(e[g] || "").trim(), x = m ? e[m] : void 0, b = !1 !== x && ("string" != typeof x || ![ "false", "no", "inactive", "0" ].includes(x.toLowerCase())), w = state.staffInfo[t] || {};
                DB.setStaffInfo(t, Object.assign({}, w, {
                    empNo: y,
                    name: a,
                    gender: r,
                    dob: o,
                    role: i,
                    active: b,
                    phone: h
                }));
                const _ = state.users.find(e => e.username === t);
                _ && r && (_.gender = r), v++;
            }), state._usersUpdatedAt = Date.now(), "function" == typeof syncWrite ? syncWrite() : save(), 
            buildDatalist(), t.innerHTML = `<span style="color:var(--ok);">✓ Imported ${v} records. Syncing to cloud…</span>`;
            const y = document.getElementById("staff-info-tbody");
            y && (y.innerHTML = _renderStaffInfoRows(""));
        } catch (h) {
            t.innerHTML = `<span style="color:var(--err);">Parse error: ${h.message}</span>`;
        }
    }, n.readAsArrayBuffer(a);
}
