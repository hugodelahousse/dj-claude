import { z } from "zod";
import { getTokens, saveTokens, isTokenExpired, type StoredTokens } from "../auth/token-store.js";
import { refreshAccessToken } from "../auth/spotify-auth.js";

const BASE_URL = "https://api.spotify.com/v1";
const MAX_RETRIES = 3;

export class SpotifyClient {
  private tokens: StoredTokens | null = null;
  private refreshPromise: Promise<StoredTokens> | null = null;

  private async ensureTokens(): Promise<StoredTokens> {
    if (!this.tokens) {
      this.tokens = await getTokens();
    }

    if (isTokenExpired(this.tokens)) {
      if (!this.refreshPromise) {
        this.refreshPromise = this.doRefresh().finally(() => {
          this.refreshPromise = null;
        });
      }
      this.tokens = await this.refreshPromise;
    }

    return this.tokens;
  }

  private async doRefresh(): Promise<StoredTokens> {
    console.error("[dj-claude] Refreshing access token...");
    if (!this.tokens) throw new Error("Cannot refresh without existing tokens");
    const refreshed = await refreshAccessToken(this.tokens.clientId, this.tokens.refreshToken);
    const tokens: StoredTokens = {
      clientId: this.tokens.clientId,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? this.tokens.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };
    await saveTokens(tokens);
    return tokens;
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown, endpoint: string): T {
    const result = schema.safeParse(data);
    if (result.success) return result.data;
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`[dj-claude] Raw response from ${endpoint}: ${JSON.stringify(data).slice(0, 500)}`);
    throw new Error(`Spotify response validation failed for ${endpoint}:\n${issues}`);
  }

  private async request(endpoint: string, options: RequestInit = {}, retries = 0): Promise<unknown> {
    const tokens = await this.ensureTokens();

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    // Token expired mid-flight — invalidate and retry once
    if (res.status === 401 && retries === 0) {
      console.error("[dj-claude] Got 401, forcing token refresh...");
      this.tokens = null;
      return this.request(endpoint, options, 1);
    }

    if (res.status === 429) {
      if (retries >= MAX_RETRIES) {
        throw new Error(`Spotify rate limit exceeded after ${MAX_RETRIES} retries`);
      }
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      console.error(`[dj-claude] Rate limited, retrying in ${retryAfter}s (attempt ${retries + 1}/${MAX_RETRIES})...`);
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
      return this.request(endpoint, options, retries + 1);
    }

    if (res.status === 204) {
      return undefined;
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Spotify API error (${res.status}): ${err}`);
    }

    const text = await res.text();
    if (!text) {
      return undefined;
    }

    try {
      return JSON.parse(text);
    } catch {
      console.error(`[dj-claude] Non-JSON response from ${endpoint}: ${text.slice(0, 200)}`);
      return undefined;
    }
  }

  async get<T>(endpoint: string, schema: z.ZodType<T>): Promise<T | undefined> {
    const data = await this.request(endpoint);
    if (data === undefined) return undefined;
    return this.parse(schema, data, `GET ${endpoint}`);
  }

  async post<T>(endpoint: string, body: unknown, schema: z.ZodType<T>): Promise<T>;
  async post(endpoint: string, body?: unknown): Promise<void>;
  async post<T>(endpoint: string, body?: unknown, schema?: z.ZodType<T>): Promise<T | void> {
    const data = await this.request(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (schema) {
      if (data === undefined) throw new Error(`Expected response from POST ${endpoint} but got empty`);
      return this.parse(schema, data, `POST ${endpoint}`);
    }
  }

  async put(endpoint: string, body?: unknown): Promise<void> {
    await this.request(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(endpoint: string, body?: unknown): Promise<void> {
    await this.request(endpoint, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}
