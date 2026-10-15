import {
  GiftCode,
  Player,
  RedemptionLog,
  RedemptionResult,
  RedemptionStatus,
  CronRunSummary,
} from "./types";
import { storage } from "./storage";

const GIFT_CODES_API = "https://kingshot.net/api/gift-codes";
const REDEEM_API = "https://kingshot.net/api/gift-codes/redeem";

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
};

// Helper delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch all available active gift codes from Kingshot API
 */
export async function fetchGiftCodes(): Promise<GiftCode[]> {
  try {
    const res = await fetch(GIFT_CODES_API, {
      method: "GET",
      headers: HEADERS,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch gift codes: HTTP ${res.status}`);
    }

    const data = await res.json();
    const rawCodes: any[] = data?.data?.giftCodes || [];

    const now = new Date();
    return rawCodes.map((item) => {
      const expiresAt = item.expiresAt || null;
      const isExpired = expiresAt ? new Date(expiresAt) < now : false;
      return {
        id: item.id || item.code,
        code: item.code,
        expiresAt,
        createdAt: item.createdAt || new Date().toISOString(),
        isExpired,
      };
    });
  } catch (error) {
    console.error("Error in fetchGiftCodes:", error);
    throw error;
  }
}

/**
 * Redeem a single gift code for a specific player
 */
export async function redeemGiftCode(
  playerId: string,
  giftCode: string
): Promise<{
  success: boolean;
  status: RedemptionStatus;
  message: string;
  httpStatus: number;
}> {
  try {
    const res = await fetch(REDEEM_API, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        playerId: String(playerId).trim(),
        giftCode: String(giftCode).trim(),
      }),
      cache: "no-store",
    });

    const httpStatus = res.status;
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // response wasn't JSON
    }

    // Success response: HTTP 200 and status "success"
    if (res.ok && json?.status === "success") {
      return {
        success: true,
        status: "SUCCESS",
        message: json.message || "Gift code redeemed successfully!",
        httpStatus,
      };
    }

    const errorKey = json?.meta?.errorKey || "";
    const message = json?.message || `HTTP ${httpStatus} error`;

    if (errorKey === "GIFT_CODE_ALREADY_REDEEMED" || message.toLowerCase().includes("already redeemed")) {
      return {
        success: false,
        status: "ALREADY_REDEEMED",
        message: "Already redeemed by this player.",
        httpStatus,
      };
    }

    if (errorKey === "PLAYER_NOT_FOUND" || message.toLowerCase().includes("player not found")) {
      return {
        success: false,
        status: "PLAYER_NOT_FOUND",
        message: "Player ID not found in King Shot database.",
        httpStatus,
      };
    }

    if (message.toLowerCase().includes("expired")) {
      return {
        success: false,
        status: "EXPIRED",
        message: "Gift code has expired.",
        httpStatus,
      };
    }

    return {
      success: false,
      status: "FAILED",
      message: message || "Failed to redeem code.",
      httpStatus,
    };
  } catch (error: any) {
    console.error(`Redeem request failed for player ${playerId} code ${giftCode}:`, error);
    return {
      success: false,
      status: "FAILED",
      message: error.message || "Network / connection error",
      httpStatus: 0,
    };
  }
}

/**
 * Execute a complete redemption cycle for all active players across active gift codes
 */
export async function runRedemptionCycle(options?: {
  playerIds?: string[];
  giftCodes?: string[];
  triggeredBy?: "cron" | "manual";
}): Promise<CronRunSummary> {
  const startTime = Date.now();
  const triggeredBy = options?.triggeredBy || "cron";

  // 1. Fetch active gift codes
  const allCodes = await fetchGiftCodes();
  // Filter only active non-expired codes
  let targetCodes = allCodes.filter((c) => !c.isExpired);

  if (options?.giftCodes && options.giftCodes.length > 0) {
    targetCodes = targetCodes.filter((c) =>
      options.giftCodes!.includes(c.code)
    );
  }

  // 2. Fetch players
  const allPlayers = await storage.getPlayers();
  let targetPlayers = allPlayers.filter((p) => p.status === "active");

  if (options?.playerIds && options.playerIds.length > 0) {
    targetPlayers = allPlayers.filter((p) =>
      options.playerIds!.includes(p.playerId) || options.playerIds!.includes(p.id)
    );
  }

  const results: RedemptionResult[] = [];
  const logsToSave: RedemptionLog[] = [];

  let successCount = 0;
  let alreadyRedeemedCount = 0;
  let failedCount = 0;

  // 3. Process redemptions
  for (const player of targetPlayers) {
    for (const code of targetCodes) {
      const outcome = await redeemGiftCode(player.playerId, code.code);
      const timestamp = new Date().toISOString();

      if (outcome.status === "SUCCESS") {
        successCount++;
      } else if (outcome.status === "ALREADY_REDEEMED") {
        alreadyRedeemedCount++;
      } else {
        failedCount++;
      }

      const resultItem: RedemptionResult = {
        playerId: player.playerId,
        playerName: player.name,
        giftCode: code.code,
        status: outcome.status,
        message: outcome.message,
        httpStatus: outcome.httpStatus,
        timestamp,
      };

      results.push(resultItem);

      logsToSave.push({
        id: "log-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
        timestamp,
        playerId: player.playerId,
        playerName: player.name,
        giftCode: code.code,
        status: outcome.status,
        message: outcome.message,
        httpStatus: outcome.httpStatus,
      });

      // Polite stagger (300ms) between calls to prevent rate limiting
      await sleep(300);
    }
  }

  // 4. Save logs and update state
  if (logsToSave.length > 0) {
    await storage.addLogs(logsToSave);
  }

  const durationMs = Date.now() - startTime;
  const summary: CronRunSummary = {
    id: "run-" + Date.now().toString(36),
    timestamp: new Date().toISOString(),
    durationMs,
    codesCount: targetCodes.length,
    playersCount: targetPlayers.length,
    successCount,
    alreadyRedeemedCount,
    failedCount,
    results,
    triggeredBy,
  };

  await storage.setLastCronRun(summary);

  return summary;
}
