export interface InGamePlayerDetails {
  uid: string;
  fid?: string | null;
  nick_name: string;
  kid: number | string | null;
  alliance_abbr: string | null;
  alliance_name: string | null;
  upload_image: string | null;
  avatar_url: string | null;
  power: number | null;
  town_center_level: number | null;
}

const AVATAR_CDN_BASE = "https://got-global-avatar.akamaized.net/avatar/";

/**
 * Fetch live in-game player details from Mightpulse API by player ID (UID or in-game Governor FID)
 */
export async function fetchPlayerDetailsFromMightpulse(
  playerId: string
): Promise<InGamePlayerDetails | null> {
  const cleanId = String(playerId).trim();
  if (!cleanId) return null;

  // 1. First attempt: Direct /api/players/{cleanId}
  try {
    const res = await fetch(`https://mightpulse.com/api/players/${cleanId}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      cache: "no-store",
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.nick_name || data.uid)) {
        const uploadImage = data.upload_image || null;
        let avatarUrl = data.avatar_url || null;
        if (uploadImage) {
          avatarUrl = `${AVATAR_CDN_BASE}${uploadImage.replace(/^\/+/, "")}`;
        } else if (avatarUrl && !avatarUrl.startsWith("http")) {
          avatarUrl = `${AVATAR_CDN_BASE}${avatarUrl.replace(/^\/+/, "")}`;
        }

        return {
          uid: String(data.uid || cleanId),
          fid: String(data.fid || cleanId),
          nick_name: data.nick_name || `Player ${cleanId}`,
          kid: data.kid !== undefined ? data.kid : null,
          alliance_abbr: data.alliance_abbr || data.alliance?.abbr || null,
          alliance_name: data.alliance_name || data.alliance?.name || null,
          upload_image: uploadImage,
          avatar_url: avatarUrl,
          power: typeof data.power === "number" ? data.power : (data.power ? Number(data.power) : null),
          town_center_level: data.town_center_level || data.stove_lv || null,
        };
      }
    }
  } catch (error) {
    console.warn(`Direct Mightpulse lookup for ${cleanId} failed, trying search fallback:`, error);
  }

  // 2. Second attempt: Search /api/search?q={cleanId} for in-game Lord/Player ID (fid)
  try {
    const searchRes = await fetch(`https://mightpulse.com/api/search?q=${encodeURIComponent(cleanId)}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      cache: "no-store",
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      const results: any[] = searchData.results || [];
      const match =
        results.find(
          (r) =>
            String(r.fid) === cleanId ||
            String(r.uid) === cleanId ||
            String(r.governor_id) === cleanId
        ) || results[0];

      if (match) {
        // Fetch detailed profile using matched uid if available
        let fullData: any = null;
        if (match.uid) {
          try {
            const fullRes = await fetch(`https://mightpulse.com/api/players/${match.uid}`, {
              headers: {
                Accept: "application/json",
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
              },
              cache: "no-store",
            });
            if (fullRes.ok) {
              fullData = await fullRes.json();
            }
          } catch {
            // ignore and fallback to match data
          }
        }

        const resolved = fullData || match;
        const uploadImage = resolved.upload_image || match.upload_image || null;
        let avatarUrl = resolved.avatar_url || match.avatar_url || null;
        if (uploadImage) {
          avatarUrl = `${AVATAR_CDN_BASE}${uploadImage.replace(/^\/+/, "")}`;
        } else if (avatarUrl && !avatarUrl.startsWith("http")) {
          avatarUrl = `${AVATAR_CDN_BASE}${avatarUrl.replace(/^\/+/, "")}`;
        }

        const rawPower = resolved.power !== undefined ? resolved.power : match.power;
        const powerNum = typeof rawPower === "number" ? rawPower : (rawPower ? Number(rawPower) : null);

        return {
          uid: String(match.uid || cleanId),
          fid: String(match.fid || cleanId),
          nick_name: resolved.nick_name || match.nick_name || `Player ${cleanId}`,
          kid: resolved.kid !== undefined ? resolved.kid : (match.kid !== undefined ? match.kid : null),
          alliance_abbr: resolved.alliance_abbr || resolved.alliance?.abbr || match.alliance_abbr || null,
          alliance_name: resolved.alliance_name || resolved.alliance?.name || match.alliance_name || null,
          upload_image: uploadImage,
          avatar_url: avatarUrl,
          power: powerNum,
          town_center_level:
            resolved.town_center_level || resolved.stove_lv || match.town_center_level || match.stove_lv || null,
        };
      }
    }
  } catch (searchError) {
    console.error(`Mightpulse search fallback failed for ${cleanId}:`, searchError);
  }

  return null;
}

