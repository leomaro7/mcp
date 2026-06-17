import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Works both from source (server.ts via tsx) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

// A row of the dataset to visualize.
const rowSchema = z.object({
  label: z.string().describe("Name of the data point (shown on the bar / table row)."),
  value: z.number().describe("Numeric value used for the bar length and sorting."),
  category: z.string().optional().describe("Optional group used for color coding and filtering."),
});

type Row = z.infer<typeof rowSchema>;

// Sample dataset used when the tool is called without explicit rows, so the
// UI always has something interesting to render.
const SAMPLE: { title: string; unit: string; rows: Row[] } = {
  title: "都市別アクティブユーザー数",
  unit: "人",
  rows: [
    { label: "Tokyo", value: 1240, category: "Kanto" },
    { label: "Yokohama", value: 910, category: "Kanto" },
    { label: "Osaka", value: 820, category: "Kansai" },
    { label: "Nagoya", value: 610, category: "Chubu" },
    { label: "Kyoto", value: 430, category: "Kansai" },
    { label: "Sapporo", value: 380, category: "Hokkaido" },
    { label: "Fukuoka", value: 350, category: "Kyushu" },
    { label: "Kobe", value: 290, category: "Kansai" },
  ],
};

/**
 * Creates a new MCP server instance with the dashboard tool and UI resource.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "MCP Data Dashboard",
    version: "1.0.0",
  });

  const resourceUri = "ui://show-dataset/mcp-app.html";

  registerAppTool(server,
    "show-dataset",
    {
      title: "Show Data Dashboard",
      description:
        "Render a dataset as an interactive dashboard (sortable/filterable table + bar chart). " +
        "Pass `rows` as a list of { label, value, category? }. If omitted, a sample dataset is shown.",
      inputSchema: {
        title: z.string().optional().describe("Heading shown at the top of the dashboard."),
        unit: z.string().optional().describe("Unit suffix for values (e.g. '人', '$', 'ms')."),
        rows: z.array(rowSchema).optional().describe("The data points to visualize."),
      },
      outputSchema: {
        title: z.string(),
        unit: z.string(),
        rows: z.array(rowSchema),
      },
      _meta: { ui: { resourceUri } },
    },
    async ({ title, unit, rows }): Promise<CallToolResult> => {
      const data = {
        title: title ?? SAMPLE.title,
        unit: unit ?? (rows ? "" : SAMPLE.unit),
        rows: rows ?? SAMPLE.rows,
      };

      // Plain-text fallback for hosts that cannot render the UI.
      const total = data.rows.reduce((sum, r) => sum + r.value, 0);
      const lines = data.rows.map((r) => `- ${r.label}: ${r.value}${data.unit}`);
      const text = [
        `# ${data.title}`,
        ...lines,
        ``,
        `合計: ${total}${data.unit} / ${data.rows.length} 件`,
      ].join("\n");

      return {
        content: [{ type: "text", text }],
        structuredContent: data,
      };
    },
  );

  // A plain (UI-less) tool that the dashboard UI calls via `callServerTool`
  // when the "ローカルへ保存" button is pressed. This is the part that only
  // MCP Apps can do: a button in the in-chat UI triggers real work on the
  // server (here, writing a file to local disk).
  const SAVE_BASE = path.join(process.cwd(), "saved");

  // Resolve a destination path: append the extension if missing, allow absolute
  // paths as-is, and resolve relative paths under SAVE_BASE — rejecting any
  // `../` that would escape it (the tool contract says relative paths stay
  // "under ./saved"). Shared by all three save-* tools.
  const resolveSavePath = (dest: string, ext: string): string => {
    const withExt = dest.endsWith(ext) ? dest : `${dest}${ext}`;
    if (path.isAbsolute(withExt)) return withExt;
    const resolved = path.resolve(SAVE_BASE, withExt);
    if (resolved !== SAVE_BASE && !resolved.startsWith(SAVE_BASE + path.sep)) {
      throw new Error(`Relative path escapes the save directory: ${dest}`);
    }
    return resolved;
  };

  // Write a brand-new file, refusing to clobber anything that already exists.
  // Absolute destinations are allowed, so the `wx` flag (exclusive create) is
  // what prevents these tools from silently overwriting arbitrary files on
  // disk (e.g. a shell rc or launch agent steered there via prompt injection).
  // Shared by all three save-* tools.
  const writeNewFile = async (savedPath: string, data: string): Promise<void> => {
    await fs.mkdir(path.dirname(savedPath), { recursive: true });
    try {
      await fs.writeFile(savedPath, data, { encoding: "utf-8", flag: "wx" });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error(`File already exists, refusing to overwrite: ${savedPath}`);
      }
      throw e;
    }
  };

  server.registerTool(
    "save-dataset",
    {
      title: "Save Dataset to Local File",
      description:
        "Persist the current dataset as a JSON file on the local disk. " +
        "`path` may be absolute, or relative (resolved under ./saved). " +
        "Existing files are never overwritten.",
      inputSchema: {
        path: z.string().describe("Destination path. Relative paths go under ./saved."),
        title: z.string(),
        unit: z.string(),
        rows: z.array(rowSchema),
      },
      outputSchema: {
        savedPath: z.string(),
        bytes: z.number(),
        savedAt: z.string(),
      },
    },
    async ({ path: dest, title, unit, rows }): Promise<CallToolResult> => {
      const savedPath = resolveSavePath(dest, ".json");

      const json = JSON.stringify({ title, unit, rows }, null, 2);
      await writeNewFile(savedPath, json);

      const result = {
        savedPath,
        bytes: Buffer.byteLength(json, "utf-8"),
        savedAt: new Date().toISOString(),
      };
      return {
        content: [{ type: "text", text: `Saved ${result.bytes} bytes to ${savedPath}` }],
        structuredContent: result,
      };
    },
  );

  // Saves a self-contained static HTML snapshot produced by the UI. The UI
  // serializes its own rendered DOM (see buildHtmlSnapshot in mcp-app.ts) and
  // sends the HTML string here; the server just writes it to disk. This keeps
  // the rendering logic in one place (the UI) and avoids duplicating it server-side.
  server.registerTool(
    "save-html",
    {
      title: "Save Dashboard as Static HTML",
      description:
        "Persist a self-contained HTML snapshot of the current dashboard view. " +
        "`path` may be absolute, or relative (resolved under ./saved). " +
        "Existing files are never overwritten.",
      inputSchema: {
        path: z.string().describe("Destination path. Relative paths go under ./saved."),
        html: z.string().describe("The self-contained HTML document to write."),
      },
      outputSchema: {
        savedPath: z.string(),
        bytes: z.number(),
        savedAt: z.string(),
      },
    },
    async ({ path: dest, html }): Promise<CallToolResult> => {
      const savedPath = resolveSavePath(dest, ".html");

      await writeNewFile(savedPath, html);

      const result = {
        savedPath,
        bytes: Buffer.byteLength(html, "utf-8"),
        savedAt: new Date().toISOString(),
      };
      return {
        content: [{ type: "text", text: `Saved ${result.bytes} bytes to ${savedPath}` }],
        structuredContent: result,
      };
    },
  );

  // CSV export. Like save-dataset, the server builds the format from the
  // structured rows (label,value,category) and writes it to disk.
  server.registerTool(
    "save-csv",
    {
      title: "Save Dataset as CSV",
      description:
        "Persist the current dataset as a CSV file on the local disk. " +
        "`path` may be absolute, or relative (resolved under ./saved). " +
        "Existing files are never overwritten.",
      inputSchema: {
        path: z.string().describe("Destination path. Relative paths go under ./saved."),
        rows: z.array(rowSchema),
      },
      outputSchema: {
        savedPath: z.string(),
        bytes: z.number(),
        savedAt: z.string(),
      },
    },
    async ({ path: dest, rows }): Promise<CallToolResult> => {
      const savedPath = resolveSavePath(dest, ".csv");

      // Minimal CSV with quoting for fields containing comma/quote/newline,
      // plus a leading apostrophe to neutralize CSV/formula injection when a
      // field starts with =, +, -, @, tab or CR (evaluated by Excel/Sheets).
      const esc = (v: string) => {
        const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
        return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
      };
      const lines = [
        "label,value,category",
        ...rows.map((r) => [esc(r.label), String(r.value), esc(r.category ?? "")].join(",")),
      ];
      const csv = lines.join("\n") + "\n";

      await writeNewFile(savedPath, csv);

      const result = {
        savedPath,
        bytes: Buffer.byteLength(csv, "utf-8"),
        savedAt: new Date().toISOString(),
      };
      return {
        content: [{ type: "text", text: `Saved ${result.bytes} bytes to ${savedPath}` }],
        structuredContent: result,
      };
    },
  );

  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [
          { uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );

  return server;
}
