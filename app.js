(() => {
  "use strict";
  const EMPLOYEES = [
    { id: "EMP001", name: "Karthik", role: "Homestay Operations" },
    { id: "EMP002", name: "Koushik", role: "Sales" }
  ];
  const $ = (id) => document.getElementById(id);
  const config = window.APP_CONFIG || { API_URL: "" };
  const storageKey = "attendance-tracker-demo-v1";
  const now = new Date();
  const localDate = (date = new Date()) => {
    const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
    return y + "-" + m + "-" + d;
  };
  const currentTime = () => String(new Date().getHours()).padStart(2,"0") + ":" + String(new Date().getMinutes()).padStart(2,"0");
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
  let db = loadDb();

  function loadDb() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      if (parsed && Array.isArray(parsed.attendance) && Array.isArray(parsed.notes)) return parsed;
    } catch (error) { console.warn("Could not read local records", error); }
    return { attendance: [], notes: [], absences: [], audit: [] };
  }
  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(db));
    // Backend integration is intentionally disabled until a deployed API URL is configured.
    if (config.API_URL) syncToBackend();
  }
  async function syncToBackend() {
    try {
      const response = await fetch(config.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "syncSnapshot", data: db }) });
      if (!response.ok) throw new Error("Backend returned " + response.status);
      $("connectionText").textContent = "Connected";
      $("connectionText").previousElementSibling.style.background = "#29a46d";
    } catch (error) {
      console.error(error);
      $("connectionText").textContent = "Sync unavailable";
    }
  }
  const getRecord = (date, employeeId) => db.attendance.find(r => r.date === date && r.employeeId === employeeId);
  function audit(action, employeeId, recordId, previousValue, newValue) {
    db.audit.push({ id: uid(), timestamp: new Date().toISOString(), admin: "Administrator", action, employeeId, recordId, previousValue: previousValue || "", newValue: newValue || "" });
  }
  function formatTime(value) {
    if (!value) return "—";
    const [h,m] = value.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    return (h % 12 || 12) + ":" + String(m).padStart(2,"0") + " " + suffix;
  }
  function showToast(message) {
    $("toast").textContent = message;
    $("toast").classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => $("toast").classList.remove("show"), 2500);
  }
  function initials(name) { return name.split(" ").map(x => x[0]).join("").slice(0,2); }
  function render() {
    const date = $("workDate").value;
    const records = EMPLOYEES.map(emp => ({ emp, record: getRecord(date, emp.id) }));
    const present = records.filter(x => x.record?.status === "Present").length;
    const absent = records.filter(x => x.record?.status === "Absent").length;
    $("presentCount").textContent = present;
    $("absentCount").textContent = absent;
    $("unmarkedCount").textContent = EMPLOYEES.length - present - absent;
    $("attendanceRate").textContent = present + absent ? Math.round(present/(present+absent)*100) + "%" : "—";
    $("employeeCountLabel").textContent = EMPLOYEES.length + " employees";
    $("employeeGrid").innerHTML = records.map(({emp,record}) => {
      const status = record?.status || "Not marked";
      const cls = status === "Present" ? "present" : status === "Absent" ? "absent" : "unmarked";
      return `<article class="employee-card">
        <div class="employee-top"><div class="employee-person"><div class="employee-avatar">${initials(emp.name)}</div><div><h3>${emp.name}</h3><span class="employee-role">${emp.role}</span></div></div><span class="status ${cls}">${status}</span></div>
        <div class="time-grid"><div class="time-item"><span>CHECK-IN</span><strong>${formatTime(record?.checkin)}</strong></div><div class="time-item"><span>SALES CLOSE</span><strong>${formatTime(record?.salesClose)}</strong></div><div class="time-item"><span>FINAL LOGOUT</span><strong>${formatTime(record?.logout)}</strong></div></div>
        <div class="employee-note">${escapeHtml(record?.note || record?.absenceReason || "No additional notes")}</div>
        <div class="card-actions"><button class="secondary-btn" data-action="note" data-id="${emp.id}">＋ Add whereabouts</button><button class="primary-btn" data-action="attendance" data-id="${emp.id}">${record ? "Edit attendance" : "Mark attendance"}</button></div>
      </article>`;
    }).join("");
    renderTimeline();
    renderHistory();
    renderReports();
    fillEmployeeSelects();
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function fillEmployeeSelects() {
    const options = EMPLOYEES.map(e => `<option value="${e.id}">${e.name}</option>`).join("");
    $("noteEmployee").innerHTML = options;
    $("historyEmployee").innerHTML = '<option value="">All employees</option>' + options;
  }
  function renderTimeline() {
    const date = $("workDate").value;
    const entries = db.notes.filter(n => n.date === date).sort((a,b) => a.time.localeCompare(b.time));
    $("todayTimeline").innerHTML = entries.length ? entries.map(n => {
      const emp = EMPLOYEES.find(e => e.id === n.employeeId);
      return `<div class="timeline-entry"><span class="timeline-time">${formatTime(n.time)}</span><i class="timeline-pin"></i><div class="timeline-copy"><strong>${escapeHtml(n.note)}</strong><span>${emp ? emp.name : "Employee"}</span></div><small>Admin entry</small></div>`;
    }).join("") : '<div class="empty-state">No whereabouts updates recorded yet.</div>';
  }
  function openAttendance(employeeId) {
    const emp = EMPLOYEES.find(e => e.id === employeeId), record = getRecord($("workDate").value, employeeId);
    $("modalEmployeeName").textContent = emp.name;
    $("modalEmployeeId").value = employeeId;
    $("attendanceStatus").value = record?.status || "Present";
    $("checkinTime").value = record?.checkin || "";
    $("salesClosingTime").value = record?.salesClose || "14:00";
    $("finalLogoutTime").value = record?.logout || "";
    $("adminNotes").value = record?.note || "";
    $("absenceReason").value = record?.absenceReason || "";
    $("absenceRemarks").value = record?.absenceRemarks || "";
    toggleAttendanceFields();
    $("attendanceDialog").showModal();
  }
  function toggleAttendanceFields() {
    const absent = $("attendanceStatus").value === "Absent";
    $("presentFields").hidden = absent;
    $("absenceFields").hidden = !absent;
  }
  $("attendanceStatus").addEventListener("change", toggleAttendanceFields);
  function saveAttendance(event) {
    event.preventDefault();
    const id = $("modalEmployeeId").value, date = $("workDate").value, status = $("attendanceStatus").value;
    const previous = getRecord(date,id);
    if (status === "Absent" && !$("absenceReason").value) { showToast("Select an absence reason."); $("absenceReason").focus(); return; }
    const record = {
      id: previous?.id || uid(), date, employeeId:id,
      status,
      checkin: status === "Present" ? $("checkinTime").value : "",
      salesClose: status === "Present" ? $("salesClosingTime").value : "",
      logout: status === "Present" ? $("finalLogoutTime").value : "",
      note: status === "Present" ? $("adminNotes").value.trim() : "",
      absenceReason: status === "Absent" ? $("absenceReason").value : "",
      absenceRemarks: status === "Absent" ? $("absenceRemarks").value.trim() : "",
      updatedAt: new Date().toISOString()
    };
    const index = db.attendance.findIndex(r => r.date === date && r.employeeId === id);
    if (index >= 0) db.attendance[index] = record; else db.attendance.push(record);
    if (status === "Absent") {
      db.absences.push({ id:uid(), date, employeeId:id, reason:record.absenceReason, remarks:record.absenceRemarks, recordedAt:record.updatedAt });
    }
    audit(previous ? "Updated attendance" : "Created attendance", id, record.id, previous?.status || "Not marked", status);
    persist(); $("attendanceDialog").close(); render(); showToast("Attendance saved.");
  }
  function addNote(employeeId, time, note) {
    const emp = EMPLOYEES.find(e => e.id === employeeId);
    const item = { id:uid(), date:$("workDate").value, time, employeeId, note:note.trim(), updatedBy:"Administrator" };
    db.notes.push(item);
    audit("Added whereabouts note", employeeId, item.id, "", item.note);
    persist(); renderTimeline(); showToast("Whereabouts update added.");
  }
  $("noteForm").addEventListener("submit", event => {
    event.preventDefault();
    addNote($("noteEmployee").value, $("noteTime").value, $("noteText").value);
    $("noteText").value = "";
  });
  $("employeeGrid").addEventListener("click", event => {
    const btn = event.target.closest("button[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "attendance") openAttendance(btn.dataset.id);
    else {
      $("noteEmployee").value = btn.dataset.id;
      $("noteTime").value = currentTime();
      $("noteText").focus();
      $("noteText").scrollIntoView({ behavior:"smooth", block:"center" });
    }
  });
  $("attendanceForm").addEventListener("submit", saveAttendance);
  $("closeModal").addEventListener("click", () => $("attendanceDialog").close());
  $("cancelModal").addEventListener("click", () => $("attendanceDialog").close());
  $("workDate").addEventListener("change", render);
  document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.toggle("active", x === button));
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === button.dataset.view + "View"));
    if (button.dataset.view === "history") renderHistory();
    if (button.dataset.view === "reports") renderReports();
  }));
  function renderHistory() {
    if (!$("historyRows")) return;
    const from = $("historyFrom").value, to = $("historyTo").value, empId = $("historyEmployee").value;
    const rows = db.attendance.filter(r => (!from || r.date >= from) && (!to || r.date <= to) && (!empId || r.employeeId === empId)).sort((a,b) => b.date.localeCompare(a.date));
    $("historyRows").innerHTML = rows.length ? rows.map(r => {
      const emp = EMPLOYEES.find(e => e.id === r.employeeId);
      const detail = r.status === "Absent" ? [r.absenceReason,r.absenceRemarks].filter(Boolean).join(" — ") : r.note;
      return `<tr><td>${r.date}</td><td>${emp?.name || "—"}</td><td><span class="status ${r.status.toLowerCase()}">${r.status}</span></td><td>${formatTime(r.checkin)}</td><td>${formatTime(r.salesClose)}</td><td>${formatTime(r.logout)}</td><td>${escapeHtml(detail || "—")}</td></tr>`;
    }).join("") : '<tr><td colspan="7" class="empty-cell">No records for selected filters.</td></tr>';
  }
  $("applyHistory").addEventListener("click", renderHistory);
  function monthRecords() {
    const month = $("reportMonth").value;
    return db.attendance.filter(r => r.date.startsWith(month));
  }
  function renderReports() {
    const records = monthRecords();
    const present = records.filter(r => r.status === "Present").length, absent = records.filter(r => r.status === "Absent").length;
    $("reportSummary").innerHTML = `<div class="report-chip"><span>Recorded days</span><strong>${records.length}</strong></div><div class="report-chip"><span>Present entries</span><strong>${present}</strong></div><div class="report-chip"><span>Absent entries</span><strong>${absent}</strong></div>`;
    $("reportRows").innerHTML = EMPLOYEES.map(emp => {
      const own = records.filter(r => r.employeeId === emp.id), p = own.filter(r => r.status === "Present").length, a = own.filter(r => r.status === "Absent").length;
      return `<tr><td>${emp.name}</td><td>${p}</td><td>${a}</td><td>${p+a ? Math.round(p/(p+a)*100)+"%" : "—"}</td></tr>`;
    }).join("");
  }
  function exportCsv() {
    const month = $("reportMonth").value, rows = [["Date","Employee","Status","Check-in","Sales closing","Final logout","Admin note","Absence reason","Absence remarks"]];
    monthRecords().sort((a,b) => a.date.localeCompare(b.date)).forEach(r => {
      const emp = EMPLOYEES.find(e => e.id === r.employeeId);
      rows.push([r.date,emp?.name || "",r.status,r.checkin,r.salesClose,r.logout,r.note,r.absenceReason,r.absenceRemarks]);
    });
    db.notes.filter(n => n.date.startsWith(month)).forEach(n => {
      const emp = EMPLOYEES.find(e => e.id === n.employeeId);
      rows.push([n.date,emp?.name || "","Whereabouts update",n.time,"","",n.note,"",""]);
    });
    const csv = rows.map(row => row.map(value => '"' + String(value ?? "").replace(/"/g,'""') + '"').join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = "attendance-report-" + month + ".csv"; link.click(); URL.revokeObjectURL(url);
  }
  $("exportReport").addEventListener("click", exportCsv);
  $("reportMonth").addEventListener("change", renderReports);
  $("todayLabel").textContent = now.toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
  $("workDate").value = localDate();
  $("noteTime").value = currentTime();
  $("reportMonth").value = localDate().slice(0,7);
  const firstDay = localDate(new Date(now.getFullYear(),now.getMonth(),1));
  $("historyFrom").value = firstDay;
  $("historyTo").value = localDate();
  if (config.API_URL) { $("connectionText").textContent = "Connecting"; syncToBackend(); }
  render();
})();