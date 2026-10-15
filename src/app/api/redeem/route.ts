import { NextRequest, NextResponse } from "next/server";
import { runRedemptionCycle, redeemGiftCode } from "@/lib/kingshot";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { playerId, giftCode, playerIds, giftCodes } = body;

    // Single redemption request (specific player + specific code)
    if (playerId && giftCode) {
      const player = await storage.getPlayer(playerId);
      const playerName = player ? player.name : `Player ${playerId}`;

      const outcome = await redeemGiftCode(playerId, giftCode);
      const timestamp = new Date().toISOString();

      await storage.addLogs([
        {
          id: "log-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
          timestamp,
          playerId,
          playerName,
          giftCode,
          status: outcome.status,
          message: outcome.message,
          httpStatus: outcome.httpStatus,
        },
      ]);

      return NextResponse.json({
        success: outcome.status === "SUCCESS",
        result: {
          playerId,
          playerName,
          giftCode,
          status: outcome.status,
          message: outcome.message,
          httpStatus: outcome.httpStatus,
          timestamp,
        },
      });
    }

    // Batch redemption cycle
    const summary = await runRedemptionCycle({
      playerIds: playerIds || (playerId ? [playerId] : undefined),
      giftCodes: giftCodes || (giftCode ? [giftCode] : undefined),
      triggeredBy: "manual",
    });

    return NextResponse.json({
      success: true,
      message: "Redemption run completed",
      summary,
    });
  } catch (error: any) {
    console.error("Manual redeem error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to execute redemption" },
      { status: 500 }
    );
  }
}
