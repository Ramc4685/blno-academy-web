import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../AppsScript.gs", import.meta.url), "utf8");

function makeSheet(values) {
  return {
    getDataRange() {
      return {
        getValues() {
          return values;
        }
      };
    }
  };
}

function loadApi(sheets) {
  const context = {
    console,
    Date,
    JSON,
    Math,
    Number,
    Object,
    String,
    isNaN,
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) {
            return sheets[name] || null;
          }
        };
      }
    },
    Utilities: {
      formatDate() {
        return "";
      },
      formatString(format, value) {
        return format.replace("%s", value);
      }
    },
    Session: {
      getScriptTimeZone() {
        return "America/Chicago";
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context;
}

function sameRealm(value) {
  return JSON.parse(JSON.stringify(value));
}

const rosterRows = [
  ["Reg", "Child", "Parent", "Phone", "Email", "Skill", "Price", "Session", "Coach", "Status", "May-2026 Enr", "May-2026 Pay", "May-2026 Due"],
  ["", "Ava", "", "", "", "", 100, "Sat 9 AM (Coach - Gowtham)", "", "Active", true, "$80", "$20"],
  ["", "Ben", "", "", "", "", 120, "Sun 10 AM (Coach - Kishore)", "", "Active", true, "$120", ""],
  ["", "Cara", "", "", "", "", 90, "Sat 9 AM (Coach - Gowtham)", "", "Dropped", true, "$90", ""]
];

{
  const api = loadApi({ Roster: makeSheet(rosterRows) });
  api.BLNO_API.coachPayoutPct = { Gowtham: "50%", Kishore: 0.4 };

  const coachResult = api.blnoCoachRoster_({ role: "coach", coach: "Gowtham" }, "May-2026");
  assert.equal(coachResult.sessions.length, 1);
  assert.equal(coachResult.sessions[0].enrolled.length, 1);
  assert.equal(coachResult.payout, 50);

  const adminRows = api.blnoAdminCoaches_({ role: "admin" }, "May-2026");
  assert.deepEqual(
    sameRealm(
      adminRows.map((row) => [row.coach, row.kids, row.revenue, row.pct, row.payout])
    ),
    [
      ["Gowtham", 1, 100, 0.5, 50],
      ["Kishore", 1, 120, 0.4, 48]
    ]
  );
}

{
  const api = loadApi({ Roster: makeSheet(rosterRows) });
  api.BLNO_API.coachPayoutPct = {};

  const coachResult = api.blnoCoachRoster_({ role: "coach", coach: "Gowtham" }, "May-2026");
  assert.equal(coachResult.payout, null);

  const adminRows = api.blnoAdminCoaches_({ role: "admin" }, "May-2026");
  const gowtham = adminRows.find((row) => row.coach === "Gowtham");
  assert.equal(gowtham.pct, null);
  assert.equal(gowtham.payout, null);
}

{
  const payslipRows = [
    ["Month", "Coach", "Kids", "Expected Revenue", "Payout %", "Payout"],
    ["May-2026", "Gowtham", 2, 200, "60%", ""]
  ];
  const api = loadApi({
    Roster: makeSheet(rosterRows),
    Coach_Payslip: makeSheet(payslipRows)
  });
  api.BLNO_API.coachPayoutPct = { Gowtham: "50%", Kishore: 0.4 };

  const adminRows = api.blnoAdminCoaches_({ role: "admin" }, "May-2026");
  assert.deepEqual(
    sameRealm(
      adminRows.map((row) => [row.coach, row.kids, row.revenue, row.pct, row.payout])
    ),
    [
      ["Gowtham", 2, 200, 0.6, 120],
      ["Kishore", 1, 120, 0.4, 48]
    ]
  );
}
