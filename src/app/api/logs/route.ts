import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const status = searchParams.get("status");
    const playerId = searchParams.get("playerId");
    const code = searchParams.get("code");

    let logs = await storage.getLogs(500);

    if (status) {
      logs = logs.filter((l) => l.status.toLowerCase() === status.toLowerCase());
    }
    if (playerId) {
      logs = logs.filter((l) => l.playerId === playerId);
    }
    if (code) {
      logs = logs.filter(
        (l) => l.giftCode.toLowerCase() === code.toLowerCase()
      );
    }

    const sliced = logs.slice(0, isNaN(limit) ? 100 : limit);

    return NextResponse.json({
      success: true,
      logs: sliced,
      total: logs.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await storage.clearLogs();
    return NextResponse.json({
      success: true,
      message: "Redemption logs cleared successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear logs" },
      { status: 500 }
    );
  }
}
