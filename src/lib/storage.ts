import fs from "fs";
import path from "path";
import { Player, RedemptionLog, CronRunSummary, StorageAdapter } from "./types";
import { fetchPlayerDetailsFromMightpulse } from "./mightpulse";

// Default seed players list with real in-game details
const DEFAULT_PLAYERS: Player[] = [
  {
    id: "p-mightpulse-1",
    playerId: "47964263",
    name: "『兔子_ᴾᴴ』",
    nick_name: "『兔子_ᴾᴴ』",
    kid: 1349,
    alliance_abbr: "313",
    alliance_name: "REBOOT",
    upload_image: "2026/10/15/Gg3ZDL_1792024155.png",
    avatar_url: "https://got-global-avatar.akamaized.net/avatar/2026/10/15/Gg3ZDL_1792024155.png",
    power: 296088481,
    town_center_level: 55,
    status: "active",
    notes: "Verified in-game profile from Mightpulse (Kingdom 1349)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-sample-main",
    playerId: "76301393",
    name: "LordAustin (Main)",
    nick_name: "LordAustin",
    kid: 1102,
    alliance_abbr: "VNG",
    alliance_name: "Vanguard Elite",
    upload_image: null,
    avatar_url: null,
    power: 184500000,
    town_center_level: 30,
    status: "active",
    notes: "Primary King Shot account (sample payload)",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-sample-alt1",
    playerId: "81204918",
    name: "ValkyriePrime",
    nick_name: "ValkyriePrime",
    kid: 1349,
    alliance_abbr: "313",
    alliance_name: "REBOOT",
    upload_image: null,
    avatar_url: null,
    power: 142000000,
    town_center_level: 28,
    status: "active",
    notes: "Auto-redeem verified recipient",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "p-sample-alt2",
    playerId: "65412903",
    name: "DragonSlayer_01",
    nick_name: "DragonSlayer",
    kid: 994,
    alliance_abbr: "ARC",
    alliance_name: "Archangels",
    upload_image: null,
    avatar_url: null,
    power: 89000000,
    town_center_level: 26,
    status: "paused",
    notes: "Reserved backup account",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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

let cachedPlayers: Player[] | null = null;
let cachedLogs: RedemptionLog[] | null = null;
let cachedLastCronRun: CronRunSummary | null = null;

class FileAndMemoryStorage implements StorageAdapter {
  private playersFile = path.join(getDataDir(), "players.json");
  private logsFile = path.join(getDataDir(), "logs.json");
  private stateFile = path.join(getDataDir(), "state.json");

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

    cachedPlayers = [...DEFAULT_PLAYERS];
    await this.savePlayers(cachedPlayers);
    return [...cachedPlayers];
  }

  async getPlayer(playerId: string): Promise<Player | null> {
    const players = await this.getPlayers();
    return players.find((p) => p.playerId === playerId || p.id === playerId) || null;
  }

  async addPlayer(data: Omit<Player, "id" | "createdAt" | "updatedAt">): Promise<Player> {
    const players = await this.getPlayers();
    const cleanUid = data.playerId.trim();

    const existing = players.find((p) => p.playerId.trim() === cleanUid);
    if (existing) {
      throw new Error(`Player with ID "${cleanUid}" already exists.`);
    }

    // Attempt to enrich with live in-game details from Mightpulse API
    let inGameDetails: any = null;
    try {
      inGameDetails = await fetchPlayerDetailsFromMightpulse(cleanUid);
    } catch (err) {
      console.warn("Could not fetch Mightpulse details:", err);
    }

    const now = new Date().toISOString();
    const newPlayer: Player = {
      id: "p-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
      playerId: cleanUid,
      name: inGameDetails?.nick_name || data.name?.trim() || `Player ${cleanUid}`,
      nick_name: inGameDetails?.nick_name || data.nick_name?.trim() || data.name?.trim() || `Player ${cleanUid}`,
      kid: inGameDetails?.kid !== undefined ? inGameDetails.kid : data.kid || null,
      alliance_abbr: inGameDetails?.alliance_abbr || data.alliance_abbr || null,
      alliance_name: inGameDetails?.alliance_name || data.alliance_name || null,
      upload_image: inGameDetails?.upload_image || data.upload_image || null,
      avatar_url: inGameDetails?.avatar_url || data.avatar_url || null,
      power: inGameDetails?.power !== undefined ? inGameDetails.power : data.power || null,
      town_center_level: inGameDetails?.town_center_level || data.town_center_level || null,
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
      nick_name: updates.nick_name !== undefined ? updates.nick_name.trim() : current.nick_name,
      notes: updates.notes !== undefined ? updates.notes.trim() : current.notes,
      status: updates.status || current.status,
      updatedAt: new Date().toISOString(),
    };

    players[index] = updated;
    cachedPlayers = players;
    await this.savePlayers(players);
    return updated;
  }

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

  async addLogs(newLogs: RedemptionLog[]): Promise<void> {
    const current = await this.getLogs(500);
    const updated = [...newLogs, ...current].slice(0, 500);
    cachedLogs = updated;
    await this.saveLogs(updated);
  }

  async clearLogs(): Promise<void> {
    cachedLogs = [];
    await this.saveLogs([]);
  }

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

export const storage = new FileAndMemoryStorage();
