export interface InGamePlayerDetails {
  uid: string;
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
 * Fetch live in-game player details from Mightpulse API by player UID
 */
export async function fetchPlayerDetailsFromMightpulse(
  uid: string
): Promise<InGamePlayerDetails | null> {
  const cleanUid = String(uid).trim();
  if (!cleanUid) return null;

  try {
    const res = await fetch(`https://mightpulse.com/api/players/${cleanUid}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)",
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      console.log(`Player UID ${cleanUid} not found in Mightpulse.`);
      return null;
    }

    if (!res.ok) {
      throw new Error(`Mightpulse API returned HTTP ${res.status}`);
    }

    const data = await res.json();

    const uploadImage = data.upload_image || null;
    let avatarUrl = data.avatar_url || null;
    if (!avatarUrl && uploadImage) {
      avatarUrl = `${AVATAR_CDN_BASE}${uploadImage}`;
    }

    return {
      uid: String(data.uid || cleanUid),
      nick_name: data.nick_name || `Player ${cleanUid}`,
      kid: data.kid !== undefined ? data.kid : null,
      alliance_abbr: data.alliance_abbr || null,
      alliance_name: data.alliance_name || null,
      upload_image: uploadImage,
      avatar_url: avatarUrl,
      power: typeof data.power === "number" ? data.power : (data.power ? Number(data.power) : null),
      town_center_level: data.town_center_level || data.stove_lv || null,
    };
  } catch (error) {
    console.error(`Error fetching Mightpulse details for UID ${cleanUid}:`, error);
    return null;
  }
}
