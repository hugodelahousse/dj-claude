import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
const StoredTokensSchema = z.object({
  clientId: z.string(),
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
});

export type StoredTokens = z.infer<typeof StoredTokensSchema>;

const TOKEN_DIR = join(homedir(), ".dj-claude");
const TOKEN_PATH = join(TOKEN_DIR, "tokens.json");

export async function getTokens(): Promise<StoredTokens> {
  let data: string;
  try {
    data = await readFile(TOKEN_PATH, "utf-8");
  } catch (e) {
    if (e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error("No tokens found. Run `dj-claude auth` to authenticate with Spotify.");
    }
    throw new Error(`Cannot read token file (${TOKEN_PATH}): ${e instanceof Error ? e.message : String(e)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    throw new Error(`Corrupt token file (${TOKEN_PATH}). Delete it and re-run \`dj-claude auth\`.`);
  }

  const result = StoredTokensSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid token file (${TOKEN_PATH}). Delete it and re-run \`dj-claude auth\`.`);
  }

  return result.data;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await mkdir(TOKEN_DIR, { recursive: true });
  await writeFile(TOKEN_PATH, JSON.stringify(tokens, null, 2), { encoding: "utf-8", mode: 0o600 });
}

export function isTokenExpired(tokens: StoredTokens): boolean {
  return Date.now() >= tokens.expiresAt - 60_000; // 1 min buffer
}
