#!/usr/bin/env node
/**
 * Viberr MCP wrapper
 * Usage: node viberr.js <tool_name> [json_args]
 * Examples:
 *   node viberr.js list_categories
 *   node viberr.js browse_jobs '{"search":"mobile app","limit":5}'
 *   node viberr.js get_job_details '{"job_id":"abc-123"}'
 *   node viberr.js my_profile
 */

const { spawn } = require("child_process");

const tool = process.argv[2];
const args = process.argv[3] ? JSON.parse(process.argv[3]) : {};

if (!tool) {
  console.error("Usage: node viberr.js <tool_name> [json_args]");
  process.exit(1);
}

const env = { ...process.env };
// API key loaded from env or secrets file
if (!env.VIBERR_API_KEY) {
  try {
    const fs = require("fs");
    const secretsPath = `${process.env.HOME}/.openclaw/secrets/viberr.json`;
    if (fs.existsSync(secretsPath)) {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
      if (secrets.VIBERR_API_KEY) env.VIBERR_API_KEY = secrets.VIBERR_API_KEY;
    }
  } catch {}
}

const proc = spawn("npx", ["-y", "github:bluewhalelabs/viberr-mcp"], {
  env,
  stdio: ["pipe", "pipe", "pipe"],
});

let outputBuffer = "";
let initialized = false;

proc.stdout.on("data", (data) => {
  outputBuffer += data.toString();
  const lines = outputBuffer.split("\n");
  outputBuffer = lines.pop(); // keep incomplete line

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id === 1 && !initialized) {
        // initialized — now call the tool
        initialized = true;
        const req = JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: tool, arguments: args },
        });
        proc.stdin.write(req + "\n");
      } else if (msg.id === 2) {
        // tool result
        if (msg.error) {
          console.error(JSON.stringify(msg.error, null, 2));
          proc.kill();
          process.exit(1);
        }
        const content = msg.result?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === "text") {
              try {
                // pretty-print JSON results
                console.log(JSON.stringify(JSON.parse(c.text), null, 2));
              } catch {
                console.log(c.text);
              }
            }
          }
        } else {
          console.log(JSON.stringify(msg.result, null, 2));
        }
        proc.kill();
        process.exit(0);
      }
    } catch {}
  }
});

proc.stderr.on("data", () => {}); // suppress MCP server startup noise

proc.on("error", (err) => {
  console.error("Failed to start MCP server:", err.message);
  process.exit(1);
});

// send initialize
const initMsg = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "openclaw", version: "1.0" },
  },
});
proc.stdin.write(initMsg + "\n");

// timeout safety
setTimeout(() => {
  console.error("Timeout waiting for MCP response");
  proc.kill();
  process.exit(1);
}, 30000);
