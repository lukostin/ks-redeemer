const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rcqdzisofoblqvbjvcbp.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcWR6aXNvZm9ibHF2Ymp2Y2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzgwODgsImV4cCI6MjEwMjM1NDA4OH0.qF1Ay8-UIzalTDf4OcewhP_SdIAsMzM6sCT3P88syNo";

const AVATAR_CDN_BASE = "https://got-global-avatar.akamaized.net/avatar/";

export interface SupabasePlayer {
  id?: string | number;
  playerId: string;
  name: string;
  nick_name: string;
  kid?: number | string | null;
  alliance_abbr?: string | null;
  alliance_name?: string | null;
  upload_image?: string | null;
  avatar_url?: string | null;
  power?: number | string | null;
  town_center_level?: number | null;
  status: "active" | "paused";
  notes?: string;
  redeemedCount?: number;
  createdAt?: string;
  [key: string]: any;
}

export interface SupabasePlayerGift {
  id?: string | number;
  player_id?: string;
  playerId?: string;
  gift_code?: string;
  giftCode?: string;
  status?: string;
  created_at?: string;
  [key: string]: any;
}

async function fetchSupabaseTable(tableName: string) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/json",
    "Accept-Profile": "kingshot",
  };

  let url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;
  let res = await fetch(url, { headers, cache: "no-store" });

  if (res.status === 404) {
    const fallbackUrl = `${SUPABASE_URL}/rest/v1/kingshot.${tableName}?select=*`;
    const fallbackRes = await fetch(fallbackUrl, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (fallbackRes.ok) return await fallbackRes.json();
  }

  if (!res.ok) {
    const errorText = await res.text();
    let parsed: any;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = { message: errorText };
    }
    throw new Error(parsed.message || `HTTP ${res.status}: ${errorText}`);
  }

  return await res.json();
}

export async function getSupabasePlayersWithGifts(): Promise<{
  players: SupabasePlayer[];
  totalGiftsCount: number;
  error?: string;
}> {
  try {
    let rawPlayers: any[] = [];
    try {
      rawPlayers = await fetchSupabaseTable("players");
    } catch (e: any) {
      if (e.message.includes("kingshot.player") || e.message.includes("schema cache")) {
        rawPlayers = await fetchSupabaseTable("kingshot.players");
      } else {
        throw e;
      }
    }

    let rawGifts: any[] = [];
    try {
      rawGifts = await fetchSupabaseTable("player-gifts");
    } catch (e) {
      try {
        rawGifts = await fetchSupabaseTable("player_gifts");
      } catch (e2) {
        console.warn("Could not fetch player-gifts table:", e2);
      }
    }

    const giftCountMap: Record<string, number> = {};
    for (const g of rawGifts) {
      const pid = String(g.player_id || g.playerId || g.player || "");
      if (pid) {
        giftCountMap[pid] = (giftCountMap[pid] || 0) + 1;
      }
    }

    const players: SupabasePlayer[] = rawPlayers.map((p) => {
      const resolvedPlayerId = String(p.playerId || p.player_id || p.uid || p.id || "");
      const count = giftCountMap[resolvedPlayerId] || 0;
      const uploadImage = p.upload_image || null;
      let avatarUrl = p.avatar_url || null;
      if (uploadImage) {
        avatarUrl = `${AVATAR_CDN_BASE}${uploadImage.replace(/^\/+/, "")}`;
      } else if (avatarUrl && !avatarUrl.startsWith("http")) {
        if (avatarUrl.startsWith("/assets/")) {
          avatarUrl = `https://mightpulse.com${avatarUrl}`;
        } else {
          avatarUrl = `${AVATAR_CDN_BASE}${avatarUrl.replace(/^\/+/, "")}`;
        }
      }

      return {
        ...p,
        playerId: resolvedPlayerId,
        name: p.nick_name || p.name || p.playerName || `Player ${resolvedPlayerId}`,
        nick_name: p.nick_name || p.name || `Player ${resolvedPlayerId}`,
        kid: p.kid !== undefined ? p.kid : null,
        alliance_abbr: p.alliance_abbr || null,
        alliance_name: p.alliance_name || null,
        upload_image: uploadImage,
        avatar_url: avatarUrl,
        power: p.power !== undefined ? p.power : null,
        town_center_level: p.town_center_level || p.stove_lv || null,
        status: p.status === "paused" ? "paused" : "active",
        redeemedCount: count,
      };
    });

    return {
      players,
      totalGiftsCount: rawGifts.length,
    };
  } catch (error: any) {
    console.error("Supabase fetch error:", error);
    return {
      players: [],
      totalGiftsCount: 0,
      error: error.message || "Failed to load players from Supabase",
    };
  }
}
