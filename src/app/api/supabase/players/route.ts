import { NextRequest, NextResponse } from "next/server";
import { getSupabasePlayersWithGifts } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "12", 10);

    const result = await getSupabasePlayersWithGifts();

    if (result.error) {
      return NextResponse.json({
        success: false,
        error: result.error,
        players: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      });
    }

    let filtered = result.players;
    if (search) {
      filtered = filtered.filter((p) => {
        const pid = String(p.playerId || p.player_id || "").toLowerCase();
        const name = String(p.name || p.playerName || p.nickname || "").toLowerCase();
        return pid.includes(search) || name.includes(search);
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = filtered.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      success: true,
      players: paginated,
      total,
      page,
      limit,
      totalPages,
      totalGiftsCount: result.totalGiftsCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to query Supabase players",
        players: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}
