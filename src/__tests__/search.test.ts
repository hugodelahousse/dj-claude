import { describe, test, expect } from "bun:test";
import { registerSearchTools } from "../tools/search.js";
import { createMockClient, createMockServer, makeTrack, makeArtist, makeAlbum, getText } from "./fixtures.js";

function setup(routes: Parameters<typeof createMockClient>[0]) {
  const client = createMockClient(routes);
  const server = createMockServer();
  registerSearchTools(server as any, client);
  return { client, handler: server.getHandler("search") };
}

describe("search", () => {
  describe("type=track (default)", () => {
    test("returns formatted tracks", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=track", response: { tracks: { items: [makeTrack(), makeTrack({ id: "t2", name: "Another Song", uri: "spotify:track:t2" })], total: 2 } } },
      ]);
      const result = await handler({ query: "test", type: "track", limit: 10 });
      const text = getText(result);

      expect(text).toContain('"Test Song"');
      expect(text).toContain("Test Artist");
      expect(text).toContain("spotify:track:track1");
      expect(text).toContain('"Another Song"');
    });

    test("returns empty message when no results", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=track", response: { tracks: { items: [], total: 0 } } },
      ]);
      const result = await handler({ query: "nonexistent", type: "track", limit: 10 });
      expect(getText(result)).toContain('No tracks found for "nonexistent"');
    });

    test("encodes query parameter", async () => {
      const { client, handler } = setup([
        { method: "get", pattern: "/search", response: { tracks: { items: [makeTrack()], total: 1 } } },
      ]);
      await handler({ query: "hello world", type: "track", limit: 5 });

      expect(client.calls[0].endpoint).toContain("q=hello%20world");
      expect(client.calls[0].endpoint).toContain("limit=5");
    });
  });

  describe("type=artist", () => {
    test("returns formatted artists with genres", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=artist", response: { artists: { items: [makeArtist()], total: 1 } } },
      ]);
      const result = await handler({ query: "test", type: "artist", limit: 10 });
      const text = getText(result);

      expect(text).toContain("Test Artist");
      expect(text).toContain("rock");
      expect(text).toContain("spotify:artist:artist1");
    });

    test("handles artists with no genres", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=artist", response: { artists: { items: [makeArtist({ genres: [] })], total: 1 } } },
      ]);
      const result = await handler({ query: "test", type: "artist", limit: 10 });

      expect(getText(result)).not.toContain("(");
    });

    test("returns empty message when no results", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=artist", response: { artists: { items: [], total: 0 } } },
      ]);
      const result = await handler({ query: "nobody", type: "artist", limit: 10 });

      expect(getText(result)).toContain('No artists found for "nobody"');
    });
  });

  describe("type=album", () => {
    test("returns formatted albums", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=album", response: { albums: { items: [makeAlbum()], total: 1 } } },
      ]);
      const result = await handler({ query: "test", type: "album", limit: 10 });
      const text = getText(result);

      expect(text).toContain('"Test Album"');
      expect(text).toContain("Test Artist");
      expect(text).toContain("2024-01-01");
      expect(text).toContain("spotify:album:album1");
    });

    test("returns empty message when no results", async () => {
      const { handler } = setup([
        { method: "get", pattern: "/search?type=album", response: { albums: { items: [], total: 0 } } },
      ]);
      const result = await handler({ query: "nothing", type: "album", limit: 10 });

      expect(getText(result)).toContain('No albums found for "nothing"');
    });
  });
});
