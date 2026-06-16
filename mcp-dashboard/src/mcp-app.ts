/**
 * @file Interactive data dashboard MCP App (vanilla TS).
 * Renders a dataset returned by the `show-dataset` tool as a sortable /
 * filterable bar chart with summary stats.
 */
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import "./global.css";
import "./dashboard.css";

interface Row {
  label: string;
  value: number;
  category?: string;
}

interface Dataset {
  title: string;
  unit: string;
  rows: Row[];
}

type SortKey = "value-desc" | "value-asc" | "label-asc" | "label-desc";

// Palette used to color-code categories (cycled if there are more than 8).
const PALETTE = [
  "#2563eb", "#16a34a", "#ea580c", "#9333ea",
  "#0891b2", "#dc2626", "#ca8a04", "#db2777",
];

// ---- DOM references ----
const titleEl = document.getElementById("title")!;
const statsEl = document.getElementById("stats")!;
const searchEl = document.getElementById("search") as HTMLInputElement;
const sortEl = document.getElementById("sort") as HTMLSelectElement;
const chipsEl = document.getElementById("chips")!;
const chartEl = document.getElementById("chart")!;
const emptyEl = document.getElementById("empty") as HTMLParagraphElement;
const savePathEl = document.getElementById("save-path") as HTMLInputElement;
const saveFormatEl = document.getElementById("save-format") as HTMLSelectElement;
const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
const saveStatusEl = document.getElementById("save-status")!;

// ---- View state ----
let dataset: Dataset = { title: "データダッシュボード", unit: "", rows: [] };
const hiddenCategories = new Set<string>();
const categoryColor = new Map<string, string>();

function colorFor(category: string | undefined): string {
  const key = category ?? "__default__";
  if (!categoryColor.has(key)) {
    categoryColor.set(key, PALETTE[categoryColor.size % PALETTE.length]);
  }
  return categoryColor.get(key)!;
}

function fmt(n: number): string {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: 2 });
}

function categories(): string[] {
  const set = new Set<string>();
  for (const r of dataset.rows) {
    if (r.category) set.add(r.category);
  }
  return [...set];
}

function visibleRows(): Row[] {
  const q = searchEl.value.trim().toLowerCase();
  const sort = sortEl.value as SortKey;
  const rows = dataset.rows.filter((r) => {
    if (r.category && hiddenCategories.has(r.category)) return false;
    if (q && !r.label.toLowerCase().includes(q)) return false;
    return true;
  });
  rows.sort((a, b) => {
    switch (sort) {
      case "value-asc": return a.value - b.value;
      case "value-desc": return b.value - a.value;
      case "label-asc": return a.label.localeCompare(b.label);
      case "label-desc": return b.label.localeCompare(a.label);
    }
  });
  return rows;
}

function renderStats(rows: Row[]) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 0;
  const avg = rows.length ? total / rows.length : 0;
  const items: [string, string][] = [
    ["件数", `${fmt(rows.length)}`],
    ["合計", `${fmt(total)}${dataset.unit}`],
    ["平均", `${fmt(avg)}${dataset.unit}`],
    ["最大", `${fmt(max)}${dataset.unit}`],
  ];
  statsEl.replaceChildren(
    ...items.map(([label, value]) => {
      const stat = document.createElement("div");
      stat.className = "stat";
      const l = document.createElement("span");
      l.className = "stat__label";
      l.textContent = label;
      const v = document.createElement("span");
      v.className = "stat__value";
      v.textContent = value;
      stat.append(l, v);
      return stat;
    }),
  );
}

function renderChips() {
  const cats = categories();
  if (cats.length === 0) {
    chipsEl.replaceChildren();
    return;
  }
  chipsEl.replaceChildren(
    ...cats.map((cat) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.type = "button";
      chip.textContent = cat;
      chip.style.setProperty("--chip-color", colorFor(cat));
      const active = !hiddenCategories.has(cat);
      chip.setAttribute("aria-pressed", String(active));
      chip.addEventListener("click", () => {
        if (hiddenCategories.has(cat)) hiddenCategories.delete(cat);
        else hiddenCategories.add(cat);
        render();
      });
      return chip;
    }),
  );
}

function renderChart(rows: Row[]) {
  emptyEl.hidden = rows.length > 0;
  const max = rows.length ? Math.max(...rows.map((r) => r.value), 0) : 0;
  chartEl.replaceChildren(
    ...rows.map((r) => {
      const bar = document.createElement("div");
      bar.className = "bar";

      const label = document.createElement("div");
      label.className = "bar__label";
      label.textContent = r.label;
      label.title = r.label;

      const track = document.createElement("div");
      track.className = "bar__track";
      const fill = document.createElement("div");
      fill.className = "bar__fill";
      fill.style.setProperty("--bar-color", colorFor(r.category));
      track.append(fill);

      const value = document.createElement("div");
      value.className = "bar__value";
      value.textContent = `${fmt(r.value)}${dataset.unit}`;

      bar.append(label, track, value);
      // Animate width on next frame so the transition fires.
      const pct = max > 0 ? Math.max(2, (r.value / max) * 100) : 0;
      requestAnimationFrame(() => { fill.style.width = `${pct}%`; });
      return bar;
    }),
  );
}

function render() {
  titleEl.textContent = dataset.title;
  const rows = visibleRows();
  renderStats(rows);
  renderChips();
  renderChart(rows);
}

function applyDataset(result: CallToolResult) {
  const data = result.structuredContent as Partial<Dataset> | undefined;
  if (!data || !Array.isArray(data.rows)) return;
  dataset = {
    title: data.title ?? "データダッシュボード",
    unit: data.unit ?? "",
    rows: data.rows,
  };
  hiddenCategories.clear();
  render();
}

// ---- Host context (theme/fonts/styles) ----
function handleHostContextChanged(ctx: McpUiHostContext) {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets) {
    const { top, right, bottom, left } = ctx.safeAreaInsets;
    document.body.style.padding = `${top}px ${right}px ${bottom}px ${left}px`;
  }
}

// ---- App wiring ----
const app = new App({ name: "Data Dashboard", version: "1.0.0" });

app.ontoolresult = applyDataset;
app.onhostcontextchanged = handleHostContextChanged;
app.onteardown = async () => ({});
app.onerror = (e: unknown) => console.error(e);

searchEl.addEventListener("input", render);
sortEl.addEventListener("change", render);

// Build a self-contained static HTML snapshot of the current view. We reuse
// the styles already bundled into the page (<style> tags) and the rendered
// DOM, so the export looks exactly like what the user sees — no need to
// re-implement the chart rendering on the server.
function buildHtmlSnapshot(): string {
  const styles = [...document.querySelectorAll("style")]
    .map((s) => s.textContent ?? "")
    .join("\n");
  // Clone the dashboard and drop the interactive-only controls.
  const main = (document.querySelector(".dash") as HTMLElement).cloneNode(true) as HTMLElement;
  main.querySelectorAll(".controls, .save").forEach((el) => el.remove());
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>${dataset.title}</title>
<style>${styles}</style>
</head>
<body>${main.outerHTML}</body>
</html>`;
}

// The button calls a server-side tool via callServerTool, picking the tool and
// payload from the selected format. This is the MCP Apps "round-trip": an
// action in the in-chat UI runs real work on the server.
type SaveFormat = "json" | "html" | "csv";

const SAVE_TOOL: Record<SaveFormat, "save-dataset" | "save-html" | "save-csv"> = {
  json: "save-dataset",
  html: "save-html",
  csv: "save-csv",
};

saveBtn.addEventListener("click", async () => {
  const dest = savePathEl.value.trim();
  if (!dest) return;
  const format = saveFormatEl.value as SaveFormat;
  saveBtn.disabled = true;
  saveStatusEl.textContent = "保存中…";
  try {
    const args =
      format === "html" ? { path: dest, html: buildHtmlSnapshot() }
      : format === "csv" ? { path: dest, rows: dataset.rows }
      : { path: dest, title: dataset.title, unit: dataset.unit, rows: dataset.rows };
    const result = await app.callServerTool({ name: SAVE_TOOL[format], arguments: args });
    const { savedPath, bytes } = (result.structuredContent ?? {}) as { savedPath?: string; bytes?: number };
    saveStatusEl.textContent = savedPath ? `保存しました: ${savedPath}（${bytes} bytes）` : "保存しました";
  } catch (e) {
    console.error(e);
    saveStatusEl.textContent = "保存に失敗しました";
  } finally {
    saveBtn.disabled = false;
  }
});

// Render the fallback/empty state immediately; the host delivers the tool
// result via `ontoolresult` once the call completes.
render();

app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) handleHostContextChanged(ctx);
});
