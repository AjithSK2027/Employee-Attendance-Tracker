/**
 * Employee Attendance & Operations Tracker
 * Bound Apps Script backend for the spreadsheet created during setup.
 *
 * Deployment requirements:
 *   Execute as: User accessing the web app
 *   Who has access: Anyone with a Google account (if available)
 *
 * Share the spreadsheet only with the administrator account. The script
 * additionally checks the signed-in account email against ADMIN_EMAIL.
 */

const ADMIN_EMAIL = "caffeineeighteen@gmail.com";

const TABLES = {
  attendance: {
    sheet: "Attendance",
    headers: ["Record ID", "Date", "Employee ID", "Employee Name", "Attendance Status", "Check-in Time", "Sales Closing Time", "Final Logout Time", "Admin Notes", "Last Updated"]
  },
  notes: {
    sheet: "Whereabouts Notes",
    headers: ["Note ID", "Date", "Time", "Employee ID", "Employee Name", "Note", "Updated By"]
  },
  absences: {
    sheet: "Absence Records",
    headers: ["Record ID", "Date", "Employee ID", "Employee Name", "Reason Category", "Additional Remarks", "Recorded By", "Recorded At"]
  },
  audit: {
    sheet: "Audit Log",
    headers: ["Log ID", "Timestamp", "Admin", "Action", "Employee ID", "Record ID", "Previous Value", "New Value"]
  }
};

function doGet(e) {
  try {
    const email = requireAdmin_();
    const data = readSnapshot_();
    data.authenticatedAs = email;
    const callback = e && e.parameter && e.parameter.callback;
    if (!callback || !/^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
      return ContentService.createTextOutput(JSON.stringify({ ok: true, data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    return ContentService.createTextOutput(callback + "(" + JSON.stringify({ ok: true, data: data }) + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (error) {
    const callback = e && e.parameter && e.parameter.callback;
    const payload = { ok: false, error: String(error.message || error) };
    const output = callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)
      ? callback + "(" + JSON.stringify(payload) + ");"
      : JSON.stringify(payload);
    return ContentService.createTextOutput(output)
      .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const email = requireAdmin_();
    const body = JSON.parse(e && e.postData && e.postData.contents || "{}");
    if (body.action !== "syncSnapshot" || !body.data) {
      throw new Error("Unsupported request.");
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      const result = saveSnapshot_(body.data, email);
      return jsonOutput_({ ok: true, result: result });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error.message || error) });
  }
}

function requireAdmin_() {
  const email = Session.getActiveUser().getEmail();
  if (!email) {
    throw new Error("Google could not identify the signed-in account. Deploy the web app to execute as the accessing user and sign in with the administrator account.");
  }
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error("Access denied for " + email);
  }
  return email;
}

function readSnapshot_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const employeesSheet = ss.getSheetByName("Employees");
  if (!employeesSheet) throw new Error("Employees sheet not found. Run the setupAttendanceSystem function first.");

  const employees = rowsAsObjects_(employeesSheet, ["Employee ID", "Employee Name", "Role", "Active"])
    .filter(row => row["Employee ID"])
    .map(row => ({
      id: String(row["Employee ID"]),
      name: String(row["Employee Name"]),
      role: String(row["Role"] || ""),
      active: row.Active !== false && String(row.Active).toLowerCase() !== "false"
    }));

  return {
    employees: employees,
    attendance: readTable_("attendance").map(row => {
      const absence = readTable_("absences").find(item => item.Date === row.Date && item["Employee ID"] === row["Employee ID"]);
      return {
        id: row["Record ID"], date: row.Date, employeeId: row["Employee ID"],
        status: row["Attendance Status"], checkin: row["Check-in Time"],
        salesClose: row["Sales Closing Time"], logout: row["Final Logout Time"],
        note: row["Admin Notes"], updatedAt: row["Last Updated"],
        absenceReason: absence ? absence["Reason Category"] : "",
        absenceRemarks: absence ? absence["Additional Remarks"] : ""
      };
    }),
    notes: readTable_("notes").map(row => ({
      id: row["Note ID"], date: row.Date, time: row.Time,
      employeeId: row["Employee ID"], note: row.Note, updatedBy: row["Updated By"]
    })),
    absences: readTable_("absences").map(row => ({
      id: row["Record ID"], date: row.Date, employeeId: row["Employee ID"],
      reason: row["Reason Category"], remarks: row["Additional Remarks"],
      recordedBy: row["Recorded By"], recordedAt: row["Recorded At"]
    })),
    audit: readTable_("audit").map(row => ({
      id: row["Log ID"], timestamp: row.Timestamp, admin: row.Admin,
      action: row.Action, employeeId: row["Employee ID"], recordId: row["Record ID"],
      previousValue: row["Previous Value"], newValue: row["New Value"]
    }))
  };
}

function saveSnapshot_(data, adminEmail) {
  const employees = readSnapshot_().employees;
  const employeeById = {};
  employees.forEach(employee => employeeById[employee.id] = employee);

  const counts = { attendance: 0, notes: 0, absences: 0, audit: 0 };
  (data.attendance || []).forEach(record => {
    const employee = employeeById[String(record.employeeId)];
    if (!employee || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.date))) return;
    upsertById_("attendance", String(record.id || Utilities.getUuid()), [
      String(record.id || Utilities.getUuid()), String(record.date), employee.id, employee.name,
      record.status === "Absent" ? "Absent" : "Present",
      String(record.checkin || ""), String(record.salesClose || ""), String(record.logout || ""),
      String(record.status === "Absent" ? "" : record.note || "").slice(0, 1000),
      new Date().toISOString()
    ]);
    counts.attendance++;
  });

  (data.notes || []).forEach(note => {
    const employee = employeeById[String(note.employeeId)];
    if (!employee || !/^\d{4}-\d{2}-\d{2}$/.test(String(note.date))) return;
    appendIfNew_("notes", String(note.id || Utilities.getUuid()), [
      String(note.id || Utilities.getUuid()), String(note.date), String(note.time || ""),
      employee.id, employee.name, String(note.note || "").slice(0, 300), adminEmail
    ]);
    counts.notes++;
  });

  (data.absences || []).forEach(absence => {
    const employee = employeeById[String(absence.employeeId)];
    if (!employee || !/^\d{4}-\d{2}-\d{2}$/.test(String(absence.date))) return;
    upsertById_("absences", String(absence.id || Utilities.getUuid()), [
      String(absence.id || Utilities.getUuid()), String(absence.date), employee.id, employee.name,
      String(absence.reason || ""), String(absence.remarks || "").slice(0, 1000),
      adminEmail, String(absence.recordedAt || new Date().toISOString())
    ]);
    counts.absences++;
  });

  (data.audit || []).forEach(entry => {
    const employee = employeeById[String(entry.employeeId)];
    appendIfNew_("audit", String(entry.id || Utilities.getUuid()), [
      String(entry.id || Utilities.getUuid()), new Date().toISOString(), adminEmail,
      String(entry.action || "Updated record"), employee ? employee.id : "",
      String(entry.recordId || ""), String(entry.previousValue || "").slice(0, 500),
      String(entry.newValue || "").slice(0, 500)
    ]);
    counts.audit++;
  });

  SpreadsheetApp.flush();
  return counts;
}

function readTable_(key) {
  const table = TABLES[key];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(table.sheet);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, table.headers.length).getDisplayValues();
  return values.map(row => {
    const obj = {};
    table.headers.forEach((header, index) => obj[header] = row[index]);
    return obj;
  });
}

function rowsAsObjects_(sheet, headers) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues().map(row => {
    const obj = {};
    headers.forEach((header, index) => obj[header] = row[index]);
    return obj;
  });
}

function ensureTable_(key) {
  const table = TABLES[key];
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(table.sheet);
  if (!sheet) sheet = ss.insertSheet(table.sheet);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, table.headers.length).setValues([table.headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, table.headers.length).setFontWeight("bold");
  }
  return sheet;
}

function upsertById_(key, id, values) {
  const sheet = ensureTable_(key);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const index = ids.indexOf(id);
    if (index >= 0) {
      sheet.getRange(index + 2, 1, 1, values.length).setValues([values]);
      return;
    }
  }
  sheet.appendRow(values);
}

function appendIfNew_(key, id, values) {
  const sheet = ensureTable_(key);
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    if (ids.includes(id)) return;
  }
  sheet.appendRow(values);
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run manually once from the Apps Script editor to verify spreadsheet access. */
function testBackendSetup() {
  const email = Session.getActiveUser().getEmail();
  const snapshot = readSnapshot_();
  Logger.log("Signed-in account: " + email);
  Logger.log("Employees found: " + snapshot.employees.length);
  if (snapshot.employees.length === 0) throw new Error("No employees found.");
}
