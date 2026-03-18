#!/usr/bin/env node

const args = process.argv.slice(2);

if (args[0] === "auth") {
  const { runAuth } = await import("./auth/cli.js");
  await runAuth();
  process.exit(0);
}

if (args[0] === "help" || args[0] === "--help") {
  console.error(`dj-claude — Spotify MCP server for Claude Code

Usage:
  dj-claude              Start the MCP server (stdio transport)
  dj-claude auth         Authenticate with Spotify
  dj-claude help         Show this help message

Setup:
  1. dj-claude auth
  2. claude mcp add dj-claude -- dj-claude`);
  process.exit(0);
}

// Dynamic imports so `dj-claude auth` and `dj-claude help` don't load the MCP stack
const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
const { SpotifyClient } = await import("./spotify/client.js");
const { getTokens } = await import("./auth/token-store.js");
const { registerSearchTools } = await import("./tools/search.js");
const { registerPlaybackTools } = await import("./tools/playback.js");
const { registerPlaylistTools } = await import("./tools/playlists.js");
const { registerDiscoveryTools } = await import("./tools/discovery.js");
const { LastFmHttpClient } = await import("./lastfm/client.js");
const { VERSION } = await import("./version.js");

// Validate Spotify auth before starting
try {
  await getTokens();
} catch (e) {
  console.error(`[dj-claude] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}

const server = new McpServer({
  name: "dj-claude",
  version: VERSION,
});

const client = new SpotifyClient();

const lastfmClient = new LastFmHttpClient();

registerSearchTools(server, client);
registerPlaybackTools(server, client);
registerPlaylistTools(server, client);
registerDiscoveryTools(server, client, lastfmClient);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error("[dj-claude] MCP server running");
