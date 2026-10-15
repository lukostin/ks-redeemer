export type RedemptionStatus =
  | "SUCCESS"
  | "ALREADY_REDEEMED"
  | "PLAYER_NOT_FOUND"
  | "EXPIRED"
  | "INVALID_CODE"
  | "FAILED";

export interface GiftCode {
  id: number | string;
  code: string;
  expiresAt: string | null;
  createdAt: string;
  isExpired?: boolean;
}

export interface Player {
  id: string; // Internal unique ID or UUID
  playerId: string; // The Kingshot player ID / UID (e.g. "47964263")
  name: string; // Display name
  nick_name: string; // In-game nickname from API (e.g. 『兔子_ᴾᴴ』)
  kid?: number | string | null; // Kingdom ID (e.g. 1349)
  alliance_abbr?: string | null; // Alliance abbreviation (e.g. 313)
  alliance_name?: string | null; // Alliance full name (e.g. REBOOT)
  upload_image?: string | null; // In-game avatar image file path
  avatar_url?: string | null; // Full CDN URL to avatar
  power?: number | string | null; // Player combat power (e.g. 296088481)
  town_center_level?: number | null; // Town center / stove level (e.g. 55)
  status: "active" | "paused"; // Active players participate in auto-redeem
  notes?: string;
  redeemedCount?: number; // Number of auto-redeemed codes
  createdAt: string;
  updatedAt: string;
}

export interface RedemptionLog {
  id: string;
  timestamp: string;
  playerId: string;
  playerName: string;
  giftCode: string;
  status: RedemptionStatus;
  message: string;
  httpStatus: number;
}

export interface RedemptionResult {
  playerId: string;
  playerName: string;
  giftCode: string;
  status: RedemptionStatus;
  message: string;
  httpStatus: number;
  timestamp: string;
}

export interface CronRunSummary {
  id: string;
  timestamp: string;
  durationMs: number;
  codesCount: number;
  playersCount: number;
  successCount: number;
  alreadyRedeemedCount: number;
  failedCount: number;
  results: RedemptionResult[];
  triggeredBy: "cron" | "manual";
}

export interface DashboardStats {
  activeCodesCount: number;
  totalPlayersCount: number;
  activePlayersCount: number;
  totalRedemptionsCount: number;
  successfulRedemptionsCount: number;
  lastCronRun: CronRunSummary | null;
}

export interface StorageAdapter {
  getPlayers(): Promise<Player[]>;
  getPlayer(playerId: string): Promise<Player | null>;
  addPlayer(player: Omit<Player, "id" | "createdAt" | "updatedAt">): Promise<Player>;
  updatePlayer(playerId: string, updates: Partial<Player>): Promise<Player>;
  deletePlayer(playerId: string): Promise<boolean>;
  getLogs(limit?: number): Promise<RedemptionLog[]>;
  addLogs(logs: RedemptionLog[]): Promise<void>;
  clearLogs(): Promise<void>;
  getLastCronRun(): Promise<CronRunSummary | null>;
  setLastCronRun(summary: CronRunSummary): Promise<void>;
}
