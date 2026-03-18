import { describe, test, expect } from "bun:test";
import { registerPlaylistTools } from "../tools/playlists.js";
import { createMockClient, createMockServer, makePlaylist, makeTrack, getText } from "./fixtures.js";

function setup(routes: Parameters<typeof createMockClient>[0]) {
  const client = createMockClient(routes);
  const server = createMockServer();
  registerPlaylistTools(server as any, client);
  return { client, getHandler: server.getHandler };
}

describe("get_playlists", () => {
  describe("list all (no playlist_id)", () => {
    test("formats playlist list", async () => {
      const playlists = [
        makePlaylist(),
        makePlaylist({ id: "pl2", name: "Workout Mix", public: true, tracks: { total: 50 } }),
      ];
      const { getHandler } = setup([
        { method: "get", pattern: "/me/playlists", response: { items: playlists, total: 2 } },
      ]);
      const result = await getHandler("get_playlists")({ limit: 20 });
      const text = getText(result);

      expect(text).toContain('"Test Playlist"');
      expect(text).toContain("Private");
      expect(text).toContain('"Workout Mix"');
      expect(text).toContain("Public");
      expect(text).toContain("50 tracks");
    });

    test("handles empty playlists", async () => {
      const { getHandler } = setup([
        { method: "get", pattern: "/me/playlists", response: { items: [], total: 0 } },
      ]);
      const result = await getHandler("get_playlists")({ limit: 20 });
      expect(getText(result)).toContain("No playlists found");
    });

    test("passes limit param", async () => {
      const { client, getHandler } = setup([
        { method: "get", pattern: "/me/playlists", response: { items: [makePlaylist()], total: 1 } },
      ]);
      await getHandler("get_playlists")({ limit: 5 });
      expect(client.calls[0].endpoint).toContain("limit=5");
    });
  });

  describe("get specific (with playlist_id)", () => {
    test("formats playlist details with tracks", async () => {
      const { getHandler } = setup([
        { method: "get", pattern: "/playlists/", response: makePlaylist() },
      ]);
      const result = await getHandler("get_playlists")({ playlist_id: "playlist1", limit: 20 });
      const text = getText(result);

      expect(text).toContain('"Test Playlist"');
      expect(text).toContain("Test User");
      expect(text).toContain("2 tracks");
      expect(text).toContain('"Test Song"');
      expect(text).toContain('"Song Two"');
    });

    test("handles playlist with no track items", async () => {
      const { getHandler } = setup([
        { method: "get", pattern: "/playlists/", response: makePlaylist({ tracks: { total: 0 } }) },
      ]);
      const result = await getHandler("get_playlists")({ playlist_id: "pl1", limit: 20 });
      expect(getText(result)).toContain("0 tracks");
    });
  });
});

describe("create_playlist", () => {
  test("creates playlist and returns info", async () => {
    const created = makePlaylist({ id: "new1", name: "My New Playlist", uri: "spotify:playlist:new1" });
    const { getHandler } = setup([
      { method: "get", pattern: "/me", response: { id: "user1" } },
      { method: "post", pattern: "/users/", response: created },
    ]);
    const result = await getHandler("create_playlist")({ name: "My New Playlist", public: false });
    const text = getText(result);

    expect(text).toContain('Created playlist "My New Playlist"');
    expect(text).toContain("ID: new1");
    expect(text).toContain("spotify:playlist:new1");
  });

  test("sends correct body to Spotify API", async () => {
    const { client, getHandler } = setup([
      { method: "get", pattern: "/me", response: { id: "user1" } },
      { method: "post", pattern: "/users/", response: makePlaylist() },
    ]);
    await getHandler("create_playlist")({ name: "Party", description: "Fun tunes", public: true });

    const postCall = client.calls.find((c) => c.method === "post");
    expect(postCall!.body).toEqual({ name: "Party", description: "Fun tunes", public: true });
    expect(postCall!.endpoint).toContain("/users/user1/playlists");
  });
});

describe("modify_playlist", () => {
  test("adds tracks to playlist", async () => {
    const { client, getHandler } = setup([
      { method: "post", pattern: "/playlists/", response: undefined },
    ]);
    const uris = ["spotify:track:a", "spotify:track:b"];
    const result = await getHandler("modify_playlist")({ playlist_id: "pl1", action: "add", uris });
    const text = getText(result);

    expect(text).toBe("Added 2 track(s) to playlist.");
    expect(client.calls[0].endpoint).toContain("/playlists/pl1/tracks");
    expect(client.calls[0].body).toEqual({ uris });
  });

  test("removes tracks from playlist", async () => {
    const { client, getHandler } = setup([
      { method: "delete", pattern: "/playlists/", response: undefined },
    ]);
    const uris = ["spotify:track:a"];
    const result = await getHandler("modify_playlist")({ playlist_id: "pl1", action: "remove", uris });
    const text = getText(result);

    expect(text).toBe("Removed 1 track(s) from playlist.");
    expect(client.calls[0].body).toEqual({ tracks: [{ uri: "spotify:track:a" }] });
  });
});
