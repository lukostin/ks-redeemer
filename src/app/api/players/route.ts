import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

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
    const { playerId, name, status, notes } = body;

    if (!playerId || typeof playerId !== "string" || !playerId.trim()) {
      return NextResponse.json(
        { success: false, error: "Valid playerId is required" },
        { status: 400 }
      );
    }

    const cleanPlayerId = playerId.trim();
    // Validate playerId format (numeric string)
    if (!/^\d+$/.test(cleanPlayerId)) {
      return NextResponse.json(
        { success: false, error: "Player ID must be numeric (e.g. 76301393)" },
        { status: 400 }
      );
    }

    const newPlayer = await storage.addPlayer({
      playerId: cleanPlayerId,
      name: (name || "").trim() || `Player ${cleanPlayerId}`,
      status: status === "paused" ? "paused" : "active",
      notes: (notes || "").trim(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Player added successfully",
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
