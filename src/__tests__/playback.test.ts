import { describe, test, expect } from "bun:test";
import { registerPlaybackTools } from "../tools/playback.js";
import { createMockClient, createMockServer, makePlaybackState, makeQueueResponse, makeTrack, getText } from "./fixtures.js";

function setup(routes: Parameters<typeof createMockClient>[0]) {
  const client = createMockClient(routes);
  const server = createMockServer();
  registerPlaybackTools(server as any, client);
  return { client, getHandler: server.getHandler };
}

describe("player_status", () => {
  test("formats now playing info", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player", response: makePlaybackState() },
    ]);
    const result = await getHandler("player_status")({ include_queue: false });
    const text = getText(result);

    expect(text).toContain('Playing: "Test Song" by Test Artist');
    expect(text).toContain("Album: Test Album");
    expect(text).toContain("1:00 / 3:30");
    expect(text).toContain("My Speaker (Speaker) at 70%");
    expect(text).toContain("Shuffle: off");
  });

  test("shows paused state", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player", response: makePlaybackState({ is_playing: false }) },
    ]);
    const result = await getHandler("player_status")({ include_queue: false });
    expect(getText(result)).toContain("Paused:");
  });

  test("handles no active session", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player", response: null },
    ]);
    const result = await getHandler("player_status")({ include_queue: false });
    expect(getText(result)).toContain("No active playback session");
  });

  test("handles no item playing", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player", response: makePlaybackState({ item: null }) },
    ]);
    const result = await getHandler("player_status")({ include_queue: false });
    expect(getText(result)).toContain("Nothing is currently playing");
  });

  test("includes queue when requested", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse() },
      { method: "get", pattern: "/me/player", response: makePlaybackState() },
    ]);
    const result = await getHandler("player_status")({ include_queue: true });
    const text = getText(result);

    expect(text).toContain('Playing: "Test Song"');
    expect(text).toContain("Up next:");
    expect(text).toContain('1. "Next Song"');
    expect(text).toContain('2. "After That"');
  });

  test("shows empty queue", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse({ queue: [] }) },
      { method: "get", pattern: "/me/player", response: makePlaybackState() },
    ]);
    const result = await getHandler("player_status")({ include_queue: true });
    expect(getText(result)).toContain("Queue is empty");
  });

  test("truncates long queues at 20", async () => {
    const bigQueue = Array.from({ length: 25 }, (_, i) =>
      makeTrack({ id: `t${i}`, name: `Song ${i}`, uri: `spotify:track:t${i}` })
    );
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse({ queue: bigQueue }) },
      { method: "get", pattern: "/me/player", response: makePlaybackState() },
    ]);
    const result = await getHandler("player_status")({ include_queue: true });
    const text = getText(result);

    expect(text).toContain("20.");
    expect(text).not.toContain("21.");
    expect(text).toContain("... and 5 more");
  });
});

describe("play", () => {
  test("resumes playback with no args", async () => {
    const { client, getHandler } = setup([
      { method: "put", pattern: "/me/player/play", response: undefined },
    ]);
    const result = await getHandler("play")({});
    expect(getText(result)).toBe("Playback started.");
    expect(client.calls[0].endpoint).toBe("/me/player/play");
    expect(client.calls[0].body).toBeUndefined();
  });

  test("plays specific track URI", async () => {
    const { client, getHandler } = setup([
      { method: "put", pattern: "/me/player/play", response: undefined },
    ]);
    await getHandler("play")({ uri: "spotify:track:abc123" });
    expect(client.calls[0].body).toEqual({ uris: ["spotify:track:abc123"] });
  });

  test("plays context URI (album/playlist)", async () => {
    const { client, getHandler } = setup([
      { method: "put", pattern: "/me/player/play", response: undefined },
    ]);
    await getHandler("play")({ context_uri: "spotify:album:xyz" });
    expect(client.calls[0].body).toEqual({ context_uri: "spotify:album:xyz" });
  });

  test("includes device_id as query param", async () => {
    const { client, getHandler } = setup([
      { method: "put", pattern: "/me/player/play", response: undefined },
    ]);
    await getHandler("play")({ device_id: "dev1" });
    expect(client.calls[0].endpoint).toContain("?device_id=dev1");
  });
});

describe("playback_control", () => {
  test("pauses playback", async () => {
    const { client, getHandler } = setup([
      { method: "put", pattern: "/me/player/pause", response: undefined },
    ]);
    const result = await getHandler("playback_control")({ action: "pause" });
    expect(getText(result)).toBe("Playback paused.");
    expect(client.calls[0].endpoint).toBe("/me/player/pause");
  });

  test("skips to next", async () => {
    const { getHandler } = setup([
      { method: "post", pattern: "/me/player/next", response: undefined },
    ]);
    const result = await getHandler("playback_control")({ action: "next" });
    expect(getText(result)).toBe("Skipped to next track.");
  });

  test("skips to previous", async () => {
    const { getHandler } = setup([
      { method: "post", pattern: "/me/player/previous", response: undefined },
    ]);
    const result = await getHandler("playback_control")({ action: "previous" });
    expect(getText(result)).toBe("Skipped to previous track.");
  });
});

describe("add_to_queue", () => {
  test("queues a single track", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse({ currently_playing: null, queue: [] }) },
      { method: "post", pattern: "/me/player/queue", response: undefined },
    ]);
    const result = await getHandler("add_to_queue")({ uris: ["spotify:track:new1"] });
    expect(getText(result)).toContain("Added 1 track(s) to queue");
  });

  test("queues multiple tracks", async () => {
    const { client, getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse({ currently_playing: null, queue: [] }) },
      { method: "post", pattern: "/me/player/queue", response: undefined },
    ]);
    const result = await getHandler("add_to_queue")({ uris: ["spotify:track:a", "spotify:track:b", "spotify:track:c"] });
    expect(getText(result)).toContain("Added 3 track(s) to queue");
    expect(client.calls.filter((c) => c.method === "post")).toHaveLength(3);
  });

  test("skips track that is currently playing", async () => {
    const { client, getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse() },
    ]);
    const result = await getHandler("add_to_queue")({ uris: ["spotify:track:track1"] });
    const text = getText(result);
    expect(text).toContain("Skipped");
    expect(text).toContain("currently playing");
    expect(client.calls.filter((c) => c.method === "post")).toHaveLength(0);
  });

  test("skips track already in queue", async () => {
    const { client, getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse() },
    ]);
    const result = await getHandler("add_to_queue")({ uris: ["spotify:track:track2"] });
    const text = getText(result);
    expect(text).toContain("Skipped");
    expect(text).toContain("already in queue");
    expect(client.calls.filter((c) => c.method === "post")).toHaveLength(0);
  });

  test("includes track name in skip message", async () => {
    const { getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse() },
    ]);
    const result = await getHandler("add_to_queue")({ uris: ["spotify:track:track2"] });
    expect(getText(result)).toContain('"Next Song"');
  });

  test("mixed batch: adds new, skips duplicates", async () => {
    const { client, getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse() },
      { method: "post", pattern: "/me/player/queue", response: undefined },
    ]);
    const result = await getHandler("add_to_queue")({
      uris: ["spotify:track:new1", "spotify:track:track2", "spotify:track:new2"],
    });
    const text = getText(result);
    expect(text).toContain("Added 2 track(s) to queue");
    expect(text).toContain("Skipped");
    expect(client.calls.filter((c) => c.method === "post")).toHaveLength(2);
  });

  test("deduplicates within the same batch", async () => {
    const { client, getHandler } = setup([
      { method: "get", pattern: "/me/player/queue", response: makeQueueResponse({ currently_playing: null, queue: [] }) },
      { method: "post", pattern: "/me/player/queue", response: undefined },
    ]);
    const result = await getHandler("add_to_queue")({
      uris: ["spotify:track:new1", "spotify:track:new1"],
    });
    const text = getText(result);
    expect(text).toContain("Added 1 track(s)");
    expect(text).toContain("Skipped");
    expect(client.calls.filter((c) => c.method === "post")).toHaveLength(1);
  });

  test("returns message for empty input", async () => {
    const { getHandler } = setup([]);
    const result = await getHandler("add_to_queue")({ uris: [] });
    expect(getText(result)).toBe("No URIs provided.");
  });
});
