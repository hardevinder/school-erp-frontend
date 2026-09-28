/* Inventory literal colors in maintained UI sources. Categories are triage hints,
 * not proof that a color is semantic; review the recorded source context. */
const fs = require('fs');
const path = require('path');
const roots = ['src/pages', 'src/components', 'src/styles', 'src/theme'];
const colors = /#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b|rgba?\([^)]*\)|\b(?:white|black|whitesmoke|lightgr[ae]y|navy)\b/gi;
const rows = [];
let scanned = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.(css|jsx?)$/.test(file) || /\.(test|spec)\./.test(file)) continue;
    scanned++;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(colors)) {
      const start = source.lastIndexOf('\n', match.index) + 1;
      const end = source.indexOf('\n', match.index);
      const line = source.slice(start, end < 0 ? source.length : end);
      // Restrict short/minified excerpts to the declaration and its immediate selector.
      const context = source.slice(Math.max(start, match.index - 120), Math.min(end < 0 ? source.length : end, match.index + 120));
      const prefix = source.slice(Math.max(0, match.index - 180), match.index);
      let category = 'review';
      if (/portalThemeRuntime|PortalThemeSettings.jsx/.test(file)) category = 'theme-definition';
      else if (/var\([^)]*$/.test(prefix)) category = 'fallback';
      else if (/color-mix\([^)]*$/.test(prefix)) category = 'mix-endpoint';
      else if (/\/Pdf|\/Printable\/|\/ReportCards\//i.test(file)) category = 'document';
      else if (/success|danger|warning|error|invalid|required|critical|positive|negative|overdue|paid|present|absent|holiday|leave|status|grade|marks|score|rank|chart|legend|is-live|online|offline|green|red|orange|amber|role--|tone-/i.test(context)) category = 'semantic-candidate';
      else if (/fill=|stroke=|stop-color=|mixHex\(|fillStyle|shadowColor/.test(line)) category = 'graphic-or-canvas';
      rows.push({ file, line: source.slice(0, match.index).split('\n').length, color: match[0], category, context: context.trim() });
    }
  }
}
roots.forEach(walk);
const counts = rows.reduce((out, row) => { out[row.category] = (out[row.category] || 0) + 1; return out; }, {});
const report = { scanned, occurrences: rows.length, counts, rows };
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ scanned, occurrences: rows.length, counts }, null, 2));
