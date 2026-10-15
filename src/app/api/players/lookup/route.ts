import { NextRequest, NextResponse } from "next/server";
import { fetchPlayerDetailsFromMightpulse } from "@/lib/mightpulse";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get("uid")?.trim();

    if (!uid) {
      return NextResponse.json(
        { success: false, error: "UID query parameter is required" },
        { status: 400 }
      );
    }

    const details = await fetchPlayerDetailsFromMightpulse(uid);
    if (!details) {
      return NextResponse.json(
        {
          success: false,
          error: `Player with UID ${uid} was not found on Mightpulse game database.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      player: details,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to lookup player" },
      { status: 500 }
    );
  }
}
