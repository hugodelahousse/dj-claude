import { createHash, randomBytes } from "node:crypto";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";

export const CLIENT_ID = "20273f2d8f8a4e42be633e0ff498cdca";

export const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

export function generateCodeVerifier(): string {
  return randomBytes(64).toString("base64url").slice(0, 128);
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthUrl(clientId: string, codeChallenge: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
  });
  return `https://accounts.spotify.com/authorize?${params}`;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCode(
  clientId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function refreshAccessToken(
  clientId: string,
  refreshToken: string,
): Promise<TokenResponse> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}
