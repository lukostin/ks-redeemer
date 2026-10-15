import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // empty body
    }

    const { playerId } = body;

    if (playerId) {
      const updated = await storage.syncPlayerFromMightpulse(String(playerId));
      if (!updated) {
        return NextResponse.json(
          { success: false, error: `Could not find player ${playerId} on Mightpulse` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Player ${playerId} synced successfully`,
        player: updated,
      });
    }

    // Sync all players in database
    const players = await storage.getPlayers();
    const results: any[] = [];

    for (const p of players) {
      try {
        const synced = await storage.syncPlayerFromMightpulse(p.playerId);
        if (synced) {
          results.push({ playerId: p.playerId, status: "synced", name: synced.nick_name, power: synced.power });
        } else {
          results.push({ playerId: p.playerId, status: "not_found" });
        }
      } catch (err: any) {
        results.push({ playerId: p.playerId, status: "error", error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${results.filter((r) => r.status === "synced").length} of ${players.length} players`,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to sync players" },
      { status: 500 }
    );
  }
}
