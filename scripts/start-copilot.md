# Start the Lux Copilot portal

From the Lux repository, with the desktop app open:

```powershell
node scripts/start-copilot.mjs desktop
```

This discovers the current desktop session, verifies the existing ChatGPT login and Lux connection, starts the portal and opens your browser. No hard-coded session IDs or global MCP edits. Press Start listening in the portal to start voice. Ctrl+C stops the server.

Use `--no-open` to suppress browser launch or `--check-mcp` for a connection check without starting the portal. Uses the existing `.env.local` voice key and existing Copilot implementation. No build or install step.
