import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  exchangeCode,
  CLIENT_ID,
} from "./spotify-auth.js";
import { saveTokens } from "./token-store.js";

const REDIRECT_URI = "http://127.0.0.1:45981/callback";
const AUTH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function runAuth() {
  console.error("=== dj-claude Spotify Auth Setup ===\n");
  console.error("Logging in with Spotify...\n");

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const authUrl = buildAuthUrl(CLIENT_ID, codeChallenge, REDIRECT_URI);

  console.error("Opening browser for authorization...\n");
  console.error(`If it doesn't open, visit:\n${authUrl}\n`);

  // Open browser
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  Bun.spawn([cmd, authUrl], { stdout: "ignore", stderr: "ignore" });

  // Start callback server with timeout
  const code = await new Promise<string>((resolve, reject) => {
    let httpServer: ReturnType<typeof Bun.serve>;

    const timeout = setTimeout(() => {
      httpServer?.stop(true);
      reject(new Error("Authorization timed out after 5 minutes. Please try again."));
    }, AUTH_TIMEOUT_MS);

    httpServer = Bun.serve({
      port: 45981,
      hostname: "127.0.0.1",
      fetch(req) {
        const url = new URL(req.url);

        if (url.pathname !== "/callback") {
          return new Response("Not found", { status: 404 });
        }

        const error = url.searchParams.get("error");
        if (error) {
          clearTimeout(timeout);
          httpServer.stop(true);
          reject(new Error(`Authorization failed: ${error}`));
          return new Response(`Authorization failed: ${error}`, { status: 400 });
        }

        const authCode = url.searchParams.get("code");
        if (!authCode) {
          clearTimeout(timeout);
          httpServer.stop(true);
          reject(new Error("Missing authorization code"));
          return new Response("Missing authorization code", { status: 400 });
        }

        clearTimeout(timeout);
        httpServer.stop();
        resolve(authCode);
        return new Response(
          "<h1>Authorized!</h1><p>You can close this tab and return to the terminal.</p>",
          { headers: { "Content-Type": "text/html" } },
        );
      },
    });

    console.error("Waiting for authorization callback on port 45981...");
  });

  console.error("\nExchanging code for tokens...");
  const tokens = await exchangeCode(CLIENT_ID, code, codeVerifier, REDIRECT_URI);

  await saveTokens({
    clientId: CLIENT_ID,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  });

  console.error("\nTokens saved to ~/.dj-claude/tokens.json");
  console.error("Auth setup complete!");
}

// Run when executed directly (bun run src/auth/cli.ts)
if (import.meta.main) {
  runAuth().catch((err) => {
    console.error(`\nAuth failed: ${err.message}`);
    process.exit(1);
  });
}
