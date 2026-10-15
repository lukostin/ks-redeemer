import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";
import { fetchGiftCodes } from "@/lib/kingshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let activeCodesCount = 0;
    try {
      const codes = await fetchGiftCodes();
      activeCodesCount = codes.filter((c) => !c.isExpired).length;
    } catch (e) {
      console.warn("Failed to fetch gift codes for stats:", e);
    }

    const players = await storage.getPlayers();
    const activePlayers = players.filter((p) => p.status === "active");
    const logs = await storage.getLogs(500);
    const lastCronRun = await storage.getLastCronRun();

    const successfulRedemptionsCount = logs.filter(
      (l) => l.status === "SUCCESS"
    ).length;

    return NextResponse.json({
      success: true,
      stats: {
        activeCodesCount,
        totalPlayersCount: players.length,
        activePlayersCount: activePlayers.length,
        totalRedemptionsCount: logs.length,
        successfulRedemptionsCount,
        lastCronRun,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load stats" },
      { status: 500 }
    );
  }
}
