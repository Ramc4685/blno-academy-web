import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const code = readFileSync(new URL("../js/ui.js", import.meta.url), "utf8");
const context = { window: {}, Number, String };
context.window.document = { getElementById: () => null };
vm.createContext(context);
vm.runInContext(code, context);

assert.equal(context.window.UI.money(60), "$60");
assert.equal(context.window.UI.money(-5), "-$5");
assert.equal(context.window.UI.pct(0.875), "88%");
assert.equal(context.window.UI.pct(null), "No attendance");
assert.equal(context.window.UI.escapeHtml('<b>"kid"</b>'), "&lt;b&gt;&quot;kid&quot;&lt;/b&gt;");
