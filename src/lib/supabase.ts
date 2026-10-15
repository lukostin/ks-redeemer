const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rcqdzisofoblqvbjvcbp.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcWR6aXNvZm9ibHF2Ymp2Y2JwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3NzgwODgsImV4cCI6MjEwMjM1NDA4OH0.qF1Ay8-UIzalTDf4OcewhP_SdIAsMzM6sCT3P88syNo";

export interface SupabasePlayer {
  id?: string | number;
  playerId?: string;
  player_id?: string;
  name?: string;
  playerName?: string;
  nickname?: string;
  status?: string;
  redeemedCount?: number;
  created_at?: string;
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

/**
 * Fetch data from Supabase REST API
 * Tries both with Accept-Profile: kingshot and direct path
 */
async function fetchSupabaseTable(tableName: string) {
  const headers: Record<string, string> = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Accept: "application/json",
    "Accept-Profile": "kingshot",
  };

  // Attempt 1: Schema header 'Accept-Profile: kingshot'
  let url = `${SUPABASE_URL}/rest/v1/${tableName}?select=*`;
  let res = await fetch(url, { headers, cache: "no-store" });

  if (res.status === 404) {
    // Attempt 2: If table has prefix or exact name in public
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

/**
 * Fetch all players from Supabase and join with auto-redeemed gifts count
 */
export async function getSupabasePlayersWithGifts(): Promise<{
  players: SupabasePlayer[];
  totalGiftsCount: number;
  error?: string;
}> {
  try {
    // 1. Fetch players
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

    // 2. Fetch gifts / redemptions to compute auto-redeemed count per player
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

    // Map gift counts by player ID
    const giftCountMap: Record<string, number> = {};
    for (const g of rawGifts) {
      const pid = String(g.player_id || g.playerId || g.player || "");
      if (pid) {
        giftCountMap[pid] = (giftCountMap[pid] || 0) + 1;
      }
    }

    // Merge count into each player
    const players: SupabasePlayer[] = rawPlayers.map((p) => {
      const resolvedPlayerId = String(p.playerId || p.player_id || p.id || "");
      const count = giftCountMap[resolvedPlayerId] || 0;
      return {
        ...p,
        playerId: resolvedPlayerId,
        name: p.name || p.playerName || p.nickname || `Player ${resolvedPlayerId}`,
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
