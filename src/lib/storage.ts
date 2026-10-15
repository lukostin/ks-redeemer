import { Player, RedemptionLog, CronRunSummary, StorageAdapter } from "./types";
import { fetchPlayerDetailsFromMightpulse } from "./mightpulse";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rcqdzisofoblqvbjvcbp.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcWR6aXNvZm9ibHF2Ymp2Y2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzgwODgsImV4cCI6MjEwMjM1NDA4OH0.qF1Ay8-UIzalTDf4OcewhP_SdIAsMzM6sCT3P88syNo";

const AVATAR_CDN_BASE = "https://got-global-avatar.akamaized.net/avatar/";

function getHeaders(isWrite = false): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/json",
    "Accept-Profile": "kingshot",
  };
  if (isWrite) {
    headers["Content-Type"] = "application/json";
    headers["Content-Profile"] = "kingshot";
    headers["Prefer"] = "return=representation";
  }
  return headers;
}

/**
 * Direct Supabase Database Storage Adapter
 * Connects directly to kingshot.players and kingshot.player-gifts
 */
export class SupabaseStorage implements StorageAdapter {
  // 1. Fetch Players from Supabase
  async getPlayers(): Promise<Player[]> {
    const url = `${SUPABASE_URL}/rest/v1/players?select=*`;
    const res = await fetch(url, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase query error (${res.status}): ${err}`);
    }

    const rows: any[] = await res.json();

    // Fetch gifts count to map redeemedCount
    let giftsCountMap: Record<string, number> = {};
    try {
      const giftsRes = await fetch(`${SUPABASE_URL}/rest/v1/player-gifts?select=player_id`, {
        headers: getHeaders(),
        cache: "no-store",
      });
      if (giftsRes.ok) {
        const gifts: any[] = await giftsRes.json();
        gifts.forEach((g) => {
          const pid = String(g.player_id || g.playerId || "");
          if (pid) giftsCountMap[pid] = (giftsCountMap[pid] || 0) + 1;
        });
      }
    } catch {
      // ignore
    }

    return rows.map((r) => {
      const pid = String(r.player_id || r.playerId || r.uid || r.id || "");
      const uploadImage = r.upload_image || null;
      let avatarUrl = r.avatar_url || null;
      if (!avatarUrl && uploadImage) {
        avatarUrl = `${AVATAR_CDN_BASE}${uploadImage}`;
      }

      return {
        id: String(r.id || pid),
        playerId: pid,
        name: r.nick_name || r.name || `Player ${pid}`,
        nick_name: r.nick_name || r.name || `Player ${pid}`,
        kid: r.kid !== undefined ? r.kid : null,
        alliance_abbr: r.alliance_abbr || null,
        alliance_name: r.alliance_name || null,
        upload_image: uploadImage,
        avatar_url: avatarUrl,
        power: r.power !== undefined ? r.power : null,
        town_center_level: r.town_center_level || r.stove_lv || null,
        status: r.status === "paused" ? "paused" : "active",
        notes: r.notes || "",
        redeemedCount: giftsCountMap[pid] || 0,
        createdAt: r.created_at || r.createdAt || new Date().toISOString(),
        updatedAt: r.updated_at || r.updatedAt || new Date().toISOString(),
      };
    });
  }

  // 2. Get Single Player
  async getPlayer(playerId: string): Promise<Player | null> {
    const clean = playerId.trim();
    const url = `${SUPABASE_URL}/rest/v1/players?or=(player_id.eq.${clean},id.eq.${clean})&select=*`;
    const res = await fetch(url, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || rows.length === 0) return null;

    const r = rows[0];
    const pid = String(r.player_id || r.playerId || r.id || "");
    return {
      id: String(r.id || pid),
      playerId: pid,
      name: r.nick_name || r.name || `Player ${pid}`,
      nick_name: r.nick_name || r.name || `Player ${pid}`,
      kid: r.kid,
      alliance_abbr: r.alliance_abbr,
      alliance_name: r.alliance_name,
      upload_image: r.upload_image,
      avatar_url: r.avatar_url,
      power: r.power,
      town_center_level: r.town_center_level,
      status: r.status === "paused" ? "paused" : "active",
      notes: r.notes || "",
      createdAt: r.created_at || new Date().toISOString(),
      updatedAt: r.updated_at || new Date().toISOString(),
    };
  }

  // 3. Add Player to Supabase (Enriched with Mightpulse)
  async addPlayer(data: Omit<Player, "id" | "createdAt" | "updatedAt">): Promise<Player> {
    const cleanUid = data.playerId.trim();

    // Query in-game details from Mightpulse
    let inGame: any = null;
    try {
      inGame = await fetchPlayerDetailsFromMightpulse(cleanUid);
    } catch (e) {
      console.warn("Mightpulse lookup failed:", e);
    }

    const payload: any = {
      player_id: cleanUid,
      name: inGame?.nick_name || data.name || data.nick_name || `Player ${cleanUid}`,
      nick_name: inGame?.nick_name || data.nick_name || data.name || `Player ${cleanUid}`,
      status: data.status || "active",
      notes: data.notes || "",
    };

    if (inGame?.kid !== undefined) payload.kid = inGame.kid;
    if (inGame?.alliance_abbr) payload.alliance_abbr = inGame.alliance_abbr;
    if (inGame?.alliance_name) payload.alliance_name = inGame.alliance_name;
    if (inGame?.upload_image) payload.upload_image = inGame.upload_image;
    if (inGame?.avatar_url) payload.avatar_url = inGame.avatar_url;
    if (inGame?.power !== undefined) payload.power = inGame.power;
    if (inGame?.town_center_level) payload.town_center_level = inGame.town_center_level;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/players`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to insert player into Supabase: ${err}`);
    }

    const inserted = await res.json();
    const r = Array.isArray(inserted) ? inserted[0] : inserted;

    return {
      id: String(r?.id || cleanUid),
      playerId: cleanUid,
      name: r?.name || payload.name,
      nick_name: r?.nick_name || payload.nick_name,
      kid: r?.kid || payload.kid,
      alliance_abbr: r?.alliance_abbr || payload.alliance_abbr,
      alliance_name: r?.alliance_name || payload.alliance_name,
      upload_image: r?.upload_image || payload.upload_image,
      avatar_url: r?.avatar_url || payload.avatar_url,
      power: r?.power || payload.power,
      town_center_level: r?.town_center_level || payload.town_center_level,
      status: r?.status || payload.status,
      notes: r?.notes || payload.notes,
      createdAt: r?.created_at || new Date().toISOString(),
      updatedAt: r?.updated_at || new Date().toISOString(),
    };
  }

  // 4. Update Player
  async updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player> {
    const clean = playerId.trim();
    const payload: any = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.nick_name !== undefined) payload.nick_name = updates.nick_name;
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.kid !== undefined) payload.kid = updates.kid;
    if (updates.power !== undefined) payload.power = updates.power;

    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?player_id=eq.${clean}`, {
      method: "PATCH",
      headers: getHeaders(true),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to update player in Supabase: ${err}`);
    }

    const updated = await res.json();
    const r = Array.isArray(updated) ? updated[0] : updated;
    return {
      id: String(r?.id || clean),
      playerId: clean,
      name: r?.name || updates.name || "",
      nick_name: r?.nick_name || updates.nick_name || "",
      status: r?.status || updates.status || "active",
      notes: r?.notes || updates.notes || "",
      createdAt: r?.created_at || new Date().toISOString(),
      updatedAt: r?.updated_at || new Date().toISOString(),
    };
  }

  // 5. Delete Player
  async deletePlayer(playerId: string): Promise<boolean> {
    const clean = playerId.trim();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/players?player_id=eq.${clean}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    return res.ok;
  }

  // 6. Get Logs (from player-gifts)
  async getLogs(limit: number = 100): Promise<RedemptionLog[]> {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/player-gifts?select=*&order=created_at.desc&limit=${limit}`, {
      headers: getHeaders(),
      cache: "no-store",
    });

    if (!res.ok) return [];
    const rows = await res.json();
    return rows.map((r: any) => ({
      id: String(r.id || Math.random()),
      timestamp: r.created_at || r.timestamp || new Date().toISOString(),
      playerId: String(r.player_id || r.playerId || ""),
      playerName: r.player_name || r.playerName || `Player ${r.player_id}`,
      giftCode: r.gift_code || r.giftCode || "",
      status: (r.status || "SUCCESS") as any,
      message: r.message || "Redeemed successfully",
      httpStatus: r.http_status || 200,
    }));
  }

  // 7. Add Logs (into player-gifts)
  async addLogs(logs: RedemptionLog[]): Promise<void> {
    const rows = logs.map((l) => ({
      player_id: l.playerId,
      player_name: l.playerName,
      gift_code: l.giftCode,
      status: l.status,
      message: l.message,
      http_status: l.httpStatus,
      created_at: l.timestamp,
    }));

    await fetch(`${SUPABASE_URL}/rest/v1/player-gifts`, {
      method: "POST",
      headers: getHeaders(true),
      body: JSON.stringify(rows),
    }).catch((e) => console.error("Failed to insert logs into Supabase player-gifts:", e));
  }

  async clearLogs(): Promise<void> {
    await fetch(`${SUPABASE_URL}/rest/v1/player-gifts?id=gt.0`, {
      method: "DELETE",
      headers: getHeaders(),
    }).catch(() => {});
  }

  private lastCronSummary: CronRunSummary | null = null;
  async getLastCronRun(): Promise<CronRunSummary | null> {
    return this.lastCronSummary;
  }
  async setLastCronRun(summary: CronRunSummary): Promise<void> {
    this.lastCronSummary = summary;
  }
}

// Export Supabase as the primary storage engine
export const storage = new SupabaseStorage();
