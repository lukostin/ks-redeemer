import { NextRequest, NextResponse } from "next/server";
import { runRedemptionCycle } from "@/lib/kingshot";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 seconds maximum execution for serverless

export async function GET(request: NextRequest) {
  try {
    // Optional Vercel Cron Secret validation
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized: Invalid CRON_SECRET authorization header",
        },
        { status: 401 }
      );
    }

    console.log("[Vercel Cron] Starting 3-hour automated redemption cycle...");
    const summary = await runRedemptionCycle({ triggeredBy: "cron" });
    console.log(
      `[Vercel Cron] Finished cycle in ${summary.durationMs}ms. Success: ${summary.successCount}, Already Redeemed: ${summary.alreadyRedeemedCount}, Failed: ${summary.failedCount}`
    );

    return NextResponse.json({
      success: true,
      message: "Automated redemption cycle completed successfully.",
      summary,
    });
  } catch (error: any) {
    console.error("[Vercel Cron] Error during redemption cycle:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Internal server error during redemption cycle",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
