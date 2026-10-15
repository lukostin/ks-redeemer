import { NextResponse } from "next/server";
import { fetchGiftCodes } from "@/lib/kingshot";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const codes = await fetchGiftCodes();
    const active = codes.filter((c) => !c.isExpired);
    const expired = codes.filter((c) => c.isExpired);

    return NextResponse.json({
      success: true,
      codes,
      active,
      expired,
      counts: {
        total: codes.length,
        active: active.length,
        expired: expired.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch gift codes" },
      { status: 500 }
    );
  }
}
