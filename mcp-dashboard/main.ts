#!/usr/bin/env node
/**
 * Entry point for running the MCP server.
 * HTTP:  tsx main.ts            (listens on PORT, default 3001, at /mcp)
 * stdio: tsx main.ts --stdio
 * Published: npx -y <package> --stdio   (runs the compiled dist/main.js)
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

export async function startStreamableHTTPServer(
  createServer: () => McpServer,
): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);

  // Default host (127.0.0.1) keeps the server loopback-only and enables the
  // SDK's DNS-rebinding protection. The save-* tools write to local disk, so
  // we must not expose this to the LAN or to arbitrary web origins.
  // No blanket CORS: this loopback-only dev server is driven by local MCP
  // clients (stdio, or a Node host over HTTP) that aren't subject to CORS.
  // Allowing any web origin would let any site the user visits drive these
  // file-writing tools, so we intentionally do not enable cross-origin access.
  const app = createMcpExpressApp();

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  const httpServer = app.listen(port, "127.0.0.1", () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
  });

  // `listen`'s callback only fires on success; bind errors (e.g. EADDRINUSE)
  // are emitted as an 'error' event on the server, not passed to the callback.
  httpServer.on("error", (err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

export async function startStdioServer(
  createServer: () => McpServer,
): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

async function main() {
  if (process.argv.includes("--stdio")) {
    await startStdioServer(createServer);
  } else {
    await startStreamableHTTPServer(createServer);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
