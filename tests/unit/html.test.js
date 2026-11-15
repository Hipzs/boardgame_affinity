import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, fr, html, raw } from "../../web/ui/html.js";

const esc = "&lt;b&gt;&quot;x&quot;&lt;/b&gt;";
const name = `<b>"x"</b>`;

test("escapeHtml / fr", () => {
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
  assert.equal(fr(6.5), "6,5");
});
test("html : valeurs échappées", () => {
  assert.equal(String(html`<p title="${name}">${name}</p>`), `<p title="${esc}">${esc}</p>`);
});
test("html : raw et gabarits imbriqués conservés, tableaux joints", () => {
  assert.equal(String(html`<i>${raw("<b>ok</b>")}</i>`), "<i><b>ok</b></i>");
  const items = ["a", "<"].map((x) => html`<li>${x}</li>`);
  const list = html`<ul>${items}</ul>`;
  assert.equal(String(list), "<ul><li>a</li><li>&lt;</li></ul>");
});
test("html : null et false ignorés, 0 conservé", () => {
  const v = [null, false, 0];
  assert.equal(String(html`[${v[0]}${v[1]}${v[2]}]`), "[0]");
});
