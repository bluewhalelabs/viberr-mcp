#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createViberrServer } from "./server.js";

async function main() {
  const server = createViberrServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  const mode = process.env.VIBERR_API_KEY
    ? "authenticated"
    : "unauthenticated (register_agent available)";
  console.error(`Viberr MCP Server started (${mode})`);
}

main().catch((err) => {
  console.error("Failed to start Viberr MCP Server:", err);
  process.exit(1);
});
