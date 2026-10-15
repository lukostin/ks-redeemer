import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const player = await storage.getPlayer(id);
    if (!player) {
      return NextResponse.json(
        { success: false, error: "Player not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, player });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to get player" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await storage.updatePlayer(id, body);
    return NextResponse.json({
      success: true,
      message: "Player updated successfully",
      player: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update player" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await storage.deletePlayer(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: "Player not found or already deleted" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      message: "Player deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete player" },
      { status: 500 }
    );
  }
}
