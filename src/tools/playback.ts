import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../spotify/client.js";
import { PlaybackStateSchema, QueueResponseSchema, type PlaybackState, type SpotifyTrack } from "../spotify/types.js";
import { textResult, registerTool } from "./helpers.js";

function formatNowPlaying(state: PlaybackState): string {
  if (!state.item) return "Nothing is currently playing.";
  const t = state.item;
  const artists = t.artists.map((a) => a.name).join(", ");
  const progress = formatMs(state.progress_ms ?? 0);
  const duration = formatMs(t.duration_ms);
  const status = state.is_playing ? "Playing" : "Paused";
  const device = state.device
    ? `Device: ${state.device.name} (${state.device.type}) at ${state.device.volume_percent}%`
    : "Device: unknown";
  return [
    `${status}: "${t.name}" by ${artists}`,
    `Album: ${t.album.name}`,
    `Progress: ${progress} / ${duration}`,
    device,
    `Shuffle: ${state.shuffle_state ? "on" : "off"} | Repeat: ${state.repeat_state}`,
    `URI: ${t.uri}`,
  ].join("\n");
}

function formatMs(ms: number): string {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatQueueTrack(t: SpotifyTrack, i: number): string {
  return `${i + 1}. "${t.name}" by ${t.artists.map((a) => a.name).join(", ")} — ${t.uri}`;
}

export function registerPlaybackTools(server: McpServer, client: SpotifyClient) {
  registerTool(server, "player_status",
    "Get current playback status (what's playing, device, progress). Optionally include the upcoming queue.",
    {
      include_queue: z.boolean().default(false).describe("Also return the upcoming track queue"),
    },
    async ({ include_queue }: { include_queue: boolean }) => {
      const state = await client.get("/me/player", PlaybackStateSchema);
      if (!state) {
        return textResult("No active playback session. Make sure Spotify is open on a device.");
      }

      const lines = [formatNowPlaying(state)];

      if (include_queue) {
        const queue = await client.get("/me/player/queue", QueueResponseSchema);
        lines.push("");
        if (!queue || queue.queue.length === 0) {
          lines.push("Queue is empty.");
        } else {
          lines.push("Up next:");
          lines.push(...queue.queue.slice(0, 20).map(formatQueueTrack));
          if (queue.queue.length > 20) {
            lines.push(`... and ${queue.queue.length - 20} more`);
          }
        }
      }

      return textResult(lines.join("\n"));
    },
  );

  registerTool(server, "play",
    "Start or resume playback. Optionally play a specific track, album, or playlist by URI.",
    {
      uri: z.string().optional().describe("Spotify URI of a track to play (e.g. spotify:track:xxx)"),
      context_uri: z.string().optional().describe("Spotify URI of an album/playlist to play (e.g. spotify:album:xxx)"),
      device_id: z.string().optional().describe("Target device ID"),
    },
    async ({ uri, context_uri, device_id }: { uri?: string; context_uri?: string; device_id?: string }) => {
      if (uri && context_uri) {
        return textResult("Cannot specify both uri and context_uri. Use uri for a single track or context_uri for an album/playlist.");
      }

      const query = device_id ? `?device_id=${encodeURIComponent(device_id)}` : "";
      const body: Record<string, unknown> = {};
      if (context_uri) body.context_uri = context_uri;
      if (uri) body.uris = [uri];

      await client.put(`/me/player/play${query}`, Object.keys(body).length > 0 ? body : undefined);
      return textResult("Playback started.");
    },
  );

  registerTool(server, "playback_control",
    "Control playback: pause, skip to next track, or go to previous track.",
    {
      action: z.enum(["pause", "next", "previous"]).describe("Playback action to perform"),
    },
    async ({ action }: { action: "pause" | "next" | "previous" }) => {
      const actions = {
        pause: { method: "put" as const, endpoint: "/me/player/pause", message: "Playback paused." },
        next: { method: "post" as const, endpoint: "/me/player/next", message: "Skipped to next track." },
        previous: { method: "post" as const, endpoint: "/me/player/previous", message: "Skipped to previous track." },
      };
      const { method, endpoint, message } = actions[action];
      if (method === "put") {
        await client.put(endpoint);
      } else {
        await client.post(endpoint);
      }
      return textResult(message);
    },
  );

  registerTool(server, "add_to_queue",
    "Add one or more tracks to the playback queue. Skips duplicates — won't add tracks already playing or already in the queue.",
    {
      uris: z.array(z.string()).describe("Spotify URIs of tracks to queue (e.g. ['spotify:track:xxx', ...])"),
    },
    async ({ uris }: { uris: string[] }) => {
      if (uris.length === 0) {
        return textResult("No URIs provided.");
      }

      // Fetch queue once for dedup
      const queue = await client.get("/me/player/queue", QueueResponseSchema);
      const existingUris = new Set<string>();
      const tracksByUri = new Map<string, SpotifyTrack>();

      if (queue) {
        if (queue.currently_playing) {
          existingUris.add(queue.currently_playing.uri);
          tracksByUri.set(queue.currently_playing.uri, queue.currently_playing);
        }
        for (const track of queue.queue) {
          existingUris.add(track.uri);
          tracksByUri.set(track.uri, track);
        }
      }

      const added: string[] = [];
      const skipped: string[] = [];
      const addedInBatch = new Set<string>();

      for (const uri of uris) {
        if (existingUris.has(uri)) {
          const match = tracksByUri.get(uri);
          const name = match ? `"${match.name}" by ${match.artists.map((a) => a.name).join(", ")}` : uri;
          const where = queue?.currently_playing?.uri === uri
            ? "currently playing"
            : addedInBatch.has(uri)
            ? "duplicate in batch"
            : "already in queue";
          skipped.push(`${name} (${where})`);
        } else {
          await client.post(`/me/player/queue?uri=${encodeURIComponent(uri)}`);
          existingUris.add(uri);
          addedInBatch.add(uri);
          added.push(uri);
        }
      }

      const lines: string[] = [];
      if (added.length > 0) lines.push(`Added ${added.length} track(s) to queue.`);
      if (skipped.length > 0) lines.push(`Skipped: ${skipped.join("; ")}`);
      return textResult(lines.join("\n"));
    },
  );
}
