/**
 * BLno Badminton Academy — Read-only Web App API
 *
 * Paste this into the existing Sheet Apps Script project alongside the
 * automation code. It intentionally avoids the existing global constants.
 *
 * Required edits before deployment:
 *   - BLNO_API.expectedClientId
 *   - BLNO_API.coachEmails
 *   - BLNO_API.adminEmails if more admins are needed
 */

var BLNO_API = {
  sheetId: "1kc8KTKXM2jBJIkXeEZoyBXHQ7fVfMYb3EiqkHJtOwAg",
  expectedClientId: "776947524108-mb972fjd6gs9b813rt0tl80lhk8qej3l.apps.googleusercontent.com",
  adminEmails: ["ramchand4685@gmail.com"],
  coachEmails: {
    "gowtham@example.com": "Gowtham",
    "kishore@example.com": "Kishore"
  },
  capacity: 15,
  currentMonth: "May-2026",
  tabs: {
    roster: "Roster",
    dashboard: "Dashboard",
    dues: "Dues_Followup",
    coachPayslip: "Coach_Payslip",
    attendanceSummary: "Attendance_Summary",
    moveLog: "Move_Log"
  }
};

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || "me";
    var auth = blnoAuthorize_(params.id_token);
    blnoLogCall_(auth.email, action);

    var data;
    if (action === "me") data = blnoMe_(auth);
    else if (action === "parent_kids") data = blnoParentKids_(auth);
    else if (action === "coach_roster") data = blnoCoachRoster_(auth, params.month || BLNO_API.currentMonth);
    else if (action === "admin_dashboard") data = blnoAdminDashboard_(auth, params.month || BLNO_API.currentMonth);
    else if (action === "admin_dues") data = blnoAdminDues_(auth, params.filter || "all");
    else if (action === "admin_sessions") data = blnoAdminSessions_(auth, params.month || BLNO_API.currentMonth);
    else if (action === "admin_coaches") data = blnoAdminCoaches_(auth, params.month || BLNO_API.currentMonth);
    else throw new Error("Unknown action: " + action);

    return blnoJson_({ ok: true, data: data });
  } catch (err) {
    return blnoJson_({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

function blnoJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function blnoAuthorize_(token) {
  if (!token) throw new Error("Missing Google ID token.");
  var url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token);
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error("Invalid Google ID token.");

  var data = JSON.parse(response.getContentText());
  if (data.aud !== BLNO_API.expectedClientId) throw new Error("Token audience does not match this app.");
  if (String(data.email_verified) !== "true") throw new Error("Google account email is not verified.");

  var email = String(data.email || "").toLowerCase();
  var role = "";
  var coach = "";
  var kids = [];

  if (BLNO_API.adminEmails.map(blnoLower_).indexOf(email) >= 0) {
    role = "admin";
  } else if (BLNO_API.coachEmails[email]) {
    role = "coach";
    coach = BLNO_API.coachEmails[email];
  } else {
    kids = blnoKidsForEmail_(email);
    if (kids.length) role = "parent";
  }

  if (!role) throw new Error("This Google account is not allowed for the academy portal.");
  return { email: email, role: role, coach: coach, kids: kids };
}

function blnoMe_(auth) {
  return {
    role: auth.role,
    email: auth.email,
    allowedKids: auth.kids.map(function (kid) { return kid.name; }),
    allowedCoach: auth.coach || ""
  };
}

function blnoParentKids_(auth) {
  if (auth.role !== "parent" && auth.role !== "admin") throw new Error("Parent access required.");
  var roster = blnoRoster_();
  var rows = auth.role === "admin" ? roster.rows : auth.kids.map(function (kid) { return kid.row; });
  var attendance = blnoAttendanceMap_();
  var moves = blnoMoveMap_();

  return rows.map(function (row) {
    var name = row.childName;
    var monthly = roster.months.map(function (month) {
      var m = row.monthly[month] || {};
      return {
        month: month,
        enrolled: !!m.enrolled,
        paid: blnoNumber_(m.pay),
        due: blnoNumber_(m.due),
        attendancePct: blnoAttendanceFor_(attendance, name, month)
      };
    });
    var current = monthly.length ? monthly[monthly.length - 1] : {};
    var totalDue = monthly.reduce(function (sum, m) { return sum + blnoNumber_(m.due); }, 0);
    return {
      name: name,
      age: row.age || "",
      session: row.session,
      coach: row.coach,
      skill: row.skill,
      price: blnoNumber_(row.price),
      status: row.status,
      currentMonth: current,
      monthly: monthly,
      attendancePct: blnoAttendanceFor_(attendance, name, current.month),
      totalDue: totalDue,
      moves: moves[name] || []
    };
  });
}

function blnoCoachRoster_(auth, month) {
  if (auth.role !== "coach" && auth.role !== "admin") throw new Error("Coach access required.");
  if (month === "all") return { payslip: blnoCoachPayslipHistory_(auth) };
  var coach = auth.role === "coach" ? auth.coach : "";
  var sessions = blnoSessionRows_(month, coach);
  var payoutRows = blnoCoachPayRows_(month, coach);
  var payout = payoutRows.reduce(function (sum, row) { return sum + blnoNumber_(row.payout); }, 0);
  return { sessions: sessions, payout: payout };
}

function blnoAdminDashboard_(auth, month) {
  blnoRequireAdmin_(auth);
  var parsed = blnoDashboardFromSheet_(month);
  if (parsed) return parsed;

  var roster = blnoRoster_();
  var kids = 0;
  var collected = 0;
  var dues = 0;
  roster.rows.forEach(function (row) {
    var m = row.monthly[month] || {};
    if (m.enrolled) kids++;
    collected += blnoNumber_(m.pay);
    dues += blnoNumber_(m.due);
  });
  return { kids: kids, expected: collected + dues, collected: collected, dues: dues, profit: 0, trend: [] };
}

function blnoAdminDues_(auth, filter) {
  blnoRequireAdmin_(auth);
  var sheet = blnoSheet_(BLNO_API.tabs.dues);
  if (!sheet) return [];
  var table = blnoTable_(sheet);
  return table.rows.map(function (row) {
    var kid = blnoPick_(row, ["Kid", "Child", "Child Name", "Name"]);
    var parent = blnoPick_(row, ["Parent", "Parent Name"]);
    var phone = blnoPick_(row, ["Phone", "Mobile"]);
    var totalDue = blnoNumber_(blnoPick_(row, ["Total Due", "Due", "Outstanding"]));
    var status = blnoPick_(row, ["Status"]);
    var message = blnoPick_(row, ["Message", "Reminder", "WhatsApp"]);
    if (!message) {
      message = "Hi " + parent + ", this is a reminder that " + kid + " has " +
        Utilities.formatString("$%s", totalDue) + " outstanding for BLno Badminton Academy. Thank you.";
    }
    return { kid: kid, parent: parent, phone: phone, totalDue: totalDue, status: status, message: message };
  }).filter(function (row) { return row.totalDue > 0; });
}

function blnoAdminSessions_(auth, month) {
  blnoRequireAdmin_(auth);
  return blnoSessionRows_(month, "");
}

function blnoAdminCoaches_(auth, month) {
  blnoRequireAdmin_(auth);
  return blnoCoachPayRows_(month, "");
}

function blnoRoster_() {
  var sheet = blnoSheet_(BLNO_API.tabs.roster);
  if (!sheet) throw new Error("Roster tab not found.");
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  var months = blnoMonthKeys_(headers);
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var raw = values[i];
    if (!raw[1]) continue;
    var monthly = {};
    months.forEach(function (month) {
      monthly[month] = {
        enrolled: blnoTruthy_(raw[headers.indexOf(month + " Enr")]),
        pay: raw[headers.indexOf(month + " Pay")],
        due: raw[headers.indexOf(month + " Due")],
        override: headers.indexOf(month + " Session Override") >= 0 ? raw[headers.indexOf(month + " Session Override")] : ""
      };
    });
    rows.push({
      raw: raw,
      rowNumber: i + 1,
      regDate: raw[0],
      childName: raw[1],
      parentName: raw[2],
      phone: raw[3],
      email: String(raw[4] || "").toLowerCase(),
      skill: raw[5],
      price: raw[6],
      session: raw[7],
      coach: raw[8],
      status: raw[9],
      age: blnoPickByHeader_(headers, raw, ["Age"]),
      monthly: monthly
    });
  }
  return { headers: headers, months: months, rows: rows };
}

function blnoKidsForEmail_(email) {
  return blnoRoster_().rows.filter(function (row) {
    return row.email === email;
  }).map(function (row) {
    return { name: row.childName, row: row };
  });
}

function blnoSessionRows_(month, coachFilter) {
  var roster = blnoRoster_();
  var attendance = blnoAttendanceMap_();
  var sessions = {};
  roster.rows.forEach(function (row) {
    var m = row.monthly[month] || {};
    if (!m.enrolled || String(row.status).toLowerCase() === "dropped") return;
    var session = m.override || row.session;
    var coach = blnoCoachFromSession_(session) || row.coach;
    if (coachFilter && coach !== coachFilter) return;
    if (!sessions[session]) {
      sessions[session] = { name: session, enrolled: [], capacity: BLNO_API.capacity, utilization: 0 };
    }
    sessions[session].enrolled.push({
      name: row.childName,
      age: row.age || "",
      paid: blnoNumber_(m.due) <= 0 && blnoNumber_(m.pay) > 0,
      attendancePct: blnoAttendanceFor_(attendance, row.childName, month)
    });
  });
  return Object.keys(sessions).sort().map(function (key) {
    var session = sessions[key];
    session.enrolled.sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    session.utilization = session.enrolled.length / session.capacity;
    session.cap = session.capacity;
    session.util = session.utilization;
    return session;
  });
}

function blnoCoachPayRows_(month, coachFilter) {
  var sheet = blnoSheet_(BLNO_API.tabs.coachPayslip);
  if (!sheet) return [];
  var table = blnoTable_(sheet);
  return table.rows.map(function (row) {
    return {
      coach: blnoPick_(row, ["Coach"]),
      month: blnoPick_(row, ["Month"]) || month,
      kids: blnoNumber_(blnoPick_(row, ["Kids", "Kids Count", "Enrolled"])),
      revenue: blnoNumber_(blnoPick_(row, ["Expected Revenue", "Revenue"])),
      pct: blnoPct_(blnoPick_(row, ["Payout %", "Pct", "Payout Percent"])),
      payout: blnoNumber_(blnoPick_(row, ["Payout", "Payout $", "Payout Amount"]))
    };
  }).filter(function (row) {
    var monthMatches = !month || month === "all" || row.month === month;
    var coachMatches = !coachFilter || row.coach === coachFilter;
    return monthMatches && coachMatches;
  });
}

function blnoCoachPayslipHistory_(auth) {
  return blnoCoachPayRows_("all", auth.role === "coach" ? auth.coach : "");
}

function blnoDashboardFromSheet_(month) {
  var sheet = blnoSheet_(BLNO_API.tabs.dashboard);
  if (!sheet) return null;
  var table = blnoTable_(sheet);
  var found = null;
  table.rows.forEach(function (row) {
    var rowMonth = blnoPick_(row, ["Month"]);
    if (rowMonth === month) {
      found = {
        kids: blnoNumber_(blnoPick_(row, ["Kids", "Enrolled Kids", "Enrolled"])),
        expected: blnoNumber_(blnoPick_(row, ["Expected", "Expected Income"])),
        collected: blnoNumber_(blnoPick_(row, ["Collected", "Collected Income"])),
        dues: blnoNumber_(blnoPick_(row, ["Dues", "Outstanding Dues"])),
        profit: blnoNumber_(blnoPick_(row, ["Profit"])),
        trend: []
      };
    }
  });
  if (!found) return null;
  found.trend = table.rows.map(function (row) {
    return {
      month: blnoPick_(row, ["Month"]),
      kids: blnoNumber_(blnoPick_(row, ["Kids", "Enrolled Kids", "Enrolled"])),
      collected: blnoNumber_(blnoPick_(row, ["Collected", "Collected Income", "Revenue"]))
    };
  }).filter(function (row) { return row.month; });
  return found;
}

function blnoAttendanceMap_() {
  var sheet = blnoSheet_(BLNO_API.tabs.attendanceSummary);
  var map = {};
  if (!sheet) return map;
  var table = blnoTable_(sheet);
  table.rows.forEach(function (row) {
    var kid = blnoPick_(row, ["Kid", "Child", "Child Name", "Name"]);
    var month = blnoPick_(row, ["Month"]);
    var pct = blnoPct_(blnoPick_(row, ["Attendance %", "Attendance", "Pct"]));
    if (!kid || !month) return;
    map[kid + "|" + month] = pct;
  });
  return map;
}

function blnoAttendanceFor_(map, kid, month) {
  if (!kid || !month) return null;
  return map[kid + "|" + month] === undefined ? null : map[kid + "|" + month];
}

function blnoMoveMap_() {
  var sheet = blnoSheet_(BLNO_API.tabs.moveLog);
  var map = {};
  if (!sheet) return map;
  var table = blnoTable_(sheet);
  table.rows.forEach(function (row) {
    var kid = blnoPick_(row, ["Kid", "Child", "Child Name"]);
    if (!kid) return;
    if (!map[kid]) map[kid] = [];
    map[kid].push({
      timestamp: blnoPick_(row, ["Timestamp"]),
      month: blnoPick_(row, ["Effective Month", "Month"]),
      from: blnoPick_(row, ["From"]),
      to: blnoPick_(row, ["To"]),
      type: blnoPick_(row, ["Type"])
    });
  });
  return map;
}

function blnoTable_(sheet) {
  var values = sheet.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };
  var headerIndex = 0;
  for (var r = 0; r < Math.min(values.length, 10); r++) {
    if (values[r].filter(String).length >= 2) {
      headerIndex = r;
      break;
    }
  }
  var headers = values[headerIndex].map(function (h) { return String(h || "").trim(); });
  var rows = [];
  for (var i = headerIndex + 1; i < values.length; i++) {
    var raw = values[i];
    if (!raw.filter(String).length) continue;
    var obj = {};
    headers.forEach(function (h, c) {
      if (h) obj[h] = raw[c];
    });
    rows.push(obj);
  }
  return { headers: headers, rows: rows };
}

function blnoMonthKeys_(headers) {
  var seen = {};
  var months = [];
  headers.forEach(function (h) {
    var match = String(h).match(/^(\S+-\d{4}) Pay$/);
    if (match && !seen[match[1]]) {
      seen[match[1]] = true;
      months.push(match[1]);
    }
  });
  return months;
}

function blnoPick_(row, names) {
  for (var i = 0; i < names.length; i++) {
    if (row[names[i]] !== undefined && row[names[i]] !== "") return row[names[i]];
  }
  return "";
}

function blnoPickByHeader_(headers, row, names) {
  for (var i = 0; i < names.length; i++) {
    var idx = headers.indexOf(names[i]);
    if (idx >= 0) return row[idx];
  }
  return "";
}

function blnoSheet_(name) {
  return SpreadsheetApp.openById(BLNO_API.sheetId).getSheetByName(name);
}

function blnoRequireAdmin_(auth) {
  if (auth.role !== "admin") throw new Error("Admin access required.");
}

function blnoLogCall_(email, action) {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), email: email, action: action }));
  } catch (err) {
    Logger.log(email + " " + action);
  }
}

function blnoCoachFromSession_(session) {
  session = String(session || "");
  if (session.indexOf("Gowtham") >= 0) return "Gowtham";
  if (session.indexOf("Kishore") >= 0) return "Kishore";
  return "";
}

function blnoTruthy_(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function blnoNumber_(value) {
  if (value === "" || value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  var cleaned = String(value).replace(/[$,\s]/g, "");
  var n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function blnoPct_(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  var s = String(value).replace("%", "").trim();
  var n = Number(s);
  if (isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

function blnoLower_(value) {
  return String(value || "").toLowerCase();
}
