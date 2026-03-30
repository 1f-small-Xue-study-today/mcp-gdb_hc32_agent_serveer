---
name: mcp-build
description: |
  Build the TypeScript MCP GDB server used for MCP operations. This skill
  runs `npm install` and `npm run build` to compile the TypeScript source
  code in `src/index.ts` into JavaScript in `dist/`. It should be invoked
  early in the workflow whenever the MCP server binary is missing or stale.
---

## Instructions

1. Check whether `dist/index.js` exists and was built recently. If so,
   skip the build unless explicitly requested.
2. Run `scripts/build_mcp.sh`. This script runs `npm install` to install
   dependencies and `npm run build` to compile TypeScript. Output is logged
   to `artifacts/logs/build_mcp.log`.
3. Verify that `dist/index.js` exists and is executable (it can be run with
   `node dist/index.js`).
4. If the build fails, append an entry to `doc/troubleshooting.md`
   describing the failure, including error messages and attempted
   remediation steps.
