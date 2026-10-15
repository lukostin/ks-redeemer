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
  playerId: string; // The Kingshot player ID (e.g. "76301393")
  name: string; // Player display nickname / identifier
  status: "active" | "paused"; // Active players participate in auto-redeem
  notes?: string;
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
