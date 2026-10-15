import fs from "fs";
import path from "path";
import { Player, RedemptionLog, CronRunSummary, StorageAdapter } from "./types";

// Default dummy players list
const DEFAULT_PLAYERS: Player[] = [
  {
    id: "p-1",
    playerId: "76301393",
    name: "LordAustin (Main)",
    status: "active",
    notes: "Primary King Shot account (sample payload)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-2",
    playerId: "81204918",
    name: "ValkyriePrime",
    status: "active",
    notes: "Top damage dealer - auto-redeem enabled",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-3",
    playerId: "90412854",
    name: "ShadowStriker",
    status: "active",
    notes: "Guild defender alt account",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-4",
    playerId: "65412903",
    name: "DragonSlayer_01",
    status: "paused",
    notes: "Reserved account (currently paused)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Determine writable data directory:
// In local dev, use <projectRoot>/data
// On Vercel serverless functions, use /tmp/ks-redeemer-data
function getDataDir(): string {
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    const tmpDir = path.join("/tmp", "ks-redeemer-data");
    if (!fs.existsSync(tmpDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
      } catch (err) {
        console.error("Failed to create /tmp directory", err);
      }
    }
    return tmpDir;
  }

  const localDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(localDir)) {
    try {
      fs.mkdirSync(localDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create local data directory", err);
    }
  }
  return localDir;
}

// In-memory cache for fast read/writes and serverless process continuity
let cachedPlayers: Player[] | null = null;
let cachedLogs: RedemptionLog[] | null = null;
let cachedLastCronRun: CronRunSummary | null = null;

class FileAndMemoryStorage implements StorageAdapter {
  private playersFile = path.join(getDataDir(), "players.json");
  private logsFile = path.join(getDataDir(), "logs.json");
  private stateFile = path.join(getDataDir(), "state.json");

  // Read players from cache or disk
  async getPlayers(): Promise<Player[]> {
    if (cachedPlayers) {
      return [...cachedPlayers];
    }

    try {
      if (fs.existsSync(this.playersFile)) {
        const raw = fs.readFileSync(this.playersFile, "utf-8");
        cachedPlayers = JSON.parse(raw);
        return [...(cachedPlayers || [])];
      }
    } catch (e) {
      console.warn("Could not read players file, using default players:", e);
    }

    // Initialize with defaults if empty or not found
    cachedPlayers = [...DEFAULT_PLAYERS];
    await this.savePlayers(cachedPlayers);
    return [...cachedPlayers];
  }

  // Get single player
  async getPlayer(playerId: string): Promise<Player | null> {
    const players = await this.getPlayers();
    return players.find((p) => p.playerId === playerId || p.id === playerId) || null;
  }

  // Add new player
  async addPlayer(data: Omit<Player, "id" | "createdAt" | "updatedAt">): Promise<Player> {
    const players = await this.getPlayers();

    const existing = players.find((p) => p.playerId.trim() === data.playerId.trim());
    if (existing) {
      throw new Error(`Player with ID "${data.playerId}" already exists.`);
    }

    const now = new Date().toISOString();
    const newPlayer: Player = {
      id: "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      playerId: data.playerId.trim(),
      name: data.name.trim() || `Player ${data.playerId}`,
      status: data.status || "active",
      notes: data.notes?.trim() || "",
      createdAt: now,
      updatedAt: now,
    };

    players.unshift(newPlayer);
    cachedPlayers = players;
    await this.savePlayers(players);
    return newPlayer;
  }

  // Update existing player
  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player> {
    const players = await this.getPlayers();
    const index = players.findIndex((p) => p.playerId === playerId || p.id === playerId);
    if (index === -1) {
      throw new Error(`Player with ID "${playerId}" not found.`);
    }

    const current = players[index];
    const updated: Player = {
      ...current,
      ...updates,
      playerId: updates.playerId ? updates.playerId.trim() : current.playerId,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      notes: updates.notes !== undefined ? updates.notes.trim() : current.notes,
      status: updates.status || current.status,
      updatedAt: new Date().toISOString(),
    };

    players[index] = updated;
    cachedPlayers = players;
    await this.savePlayers(players);
    return updated;
  }

  // Delete player
  async deletePlayer(playerId: string): Promise<boolean> {
    const players = await this.getPlayers();
    const filtered = players.filter((p) => p.playerId !== playerId && p.id !== playerId);
    if (filtered.length === players.length) {
      return false;
    }

    cachedPlayers = filtered;
    await this.savePlayers(filtered);
    return true;
  }

  // Fetch logs
  async getLogs(limit: number = 100): Promise<RedemptionLog[]> {
    if (cachedLogs) {
      return cachedLogs.slice(0, limit);
    }

    try {
      if (fs.existsSync(this.logsFile)) {
        const raw = fs.readFileSync(this.logsFile, "utf-8");
        cachedLogs = JSON.parse(raw);
        return (cachedLogs || []).slice(0, limit);
      }
    } catch (e) {
      console.warn("Could not read logs file, returning empty array:", e);
    }

    cachedLogs = [];
    return [];
  }

  // Append logs
  async addLogs(newLogs: RedemptionLog[]): Promise<void> {
    const current = await this.getLogs(500);
    const updated = [...newLogs, ...current].slice(0, 500); // keep recent 500
    cachedLogs = updated;
    await this.saveLogs(updated);
  }

  // Clear logs
  async clearLogs(): Promise<void> {
    cachedLogs = [];
    await this.saveLogs([]);
  }

  // Last cron run summary
  async getLastCronRun(): Promise<CronRunSummary | null> {
    if (cachedLastCronRun) {
      return cachedLastCronRun;
    }

    try {
      if (fs.existsSync(this.stateFile)) {
        const raw = fs.readFileSync(this.stateFile, "utf-8");
        cachedLastCronRun = JSON.parse(raw);
        return cachedLastCronRun;
      }
    } catch (e) {
      console.warn("Could not read state file:", e);
    }
    return null;
  }

  async setLastCronRun(summary: CronRunSummary): Promise<void> {
    cachedLastCronRun = summary;
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(summary, null, 2), "utf-8");
    } catch (e) {
      console.warn("Failed to write state file:", e);
    }
  }

  // Helpers to persist to disk
  private async savePlayers(players: Player[]): Promise<void> {
    try {
      fs.writeFileSync(this.playersFile, JSON.stringify(players, null, 2), "utf-8");
    } catch (e) {
      console.warn("Failed to write players file:", e);
    }
  }

  private async saveLogs(logs: RedemptionLog[]): Promise<void> {
    try {
      fs.writeFileSync(this.logsFile, JSON.stringify(logs, null, 2), "utf-8");
    } catch (e) {
      console.warn("Failed to write logs file:", e);
    }
  }
}

// Export singleton instance
export const storage = new FileAndMemoryStorage();
