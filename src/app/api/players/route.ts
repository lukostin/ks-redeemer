import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET() {
  try {
    const players = await storage.getPlayers();
    return NextResponse.json({
      success: true,
      players,
      total: players.length,
      active: players.filter((p) => p.status === "active").length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load players" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      playerId,
      name,
      nick_name,
      kid,
      alliance_abbr,
      alliance_name,
      upload_image,
      avatar_url,
      power,
      town_center_level,
      status,
      notes,
    } = body;

    if (!playerId || typeof playerId !== "string" || !playerId.trim()) {
      return NextResponse.json(
        { success: false, error: "Valid playerId (UID) is required" },
        { status: 400 }
      );
    }

    const cleanPlayerId = playerId.trim();
    if (!/^\d+$/.test(cleanPlayerId)) {
      return NextResponse.json(
        { success: false, error: "Player ID must be numeric (e.g. 47964263)" },
        { status: 400 }
      );
    }

    const newPlayer = await storage.addPlayer({
      playerId: cleanPlayerId,
      name: (name || "").trim() || (nick_name || "").trim() || `Player ${cleanPlayerId}`,
      nick_name: (nick_name || "").trim() || (name || "").trim() || `Player ${cleanUid(cleanPlayerId)}`,
      kid: kid !== undefined ? kid : null,
      alliance_abbr: alliance_abbr ? String(alliance_abbr).trim() : null,
      alliance_name: alliance_name ? String(alliance_name).trim() : null,
      upload_image: upload_image ? String(upload_image).trim() : null,
      avatar_url: avatar_url ? String(avatar_url).trim() : null,
      power: power !== undefined ? power : null,
      town_center_level: town_center_level !== undefined ? town_center_level : null,
      status: status === "paused" ? "paused" : "active",
      notes: (notes || "").trim(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Player added and in-game details populated successfully",
        player: newPlayer,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create player" },
      { status: 400 }
    );
  }
}

function cleanUid(id: string) {
  return id;
}
