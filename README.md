# KS REDEEMER

An automated **King Shot Gift Code Redeemer & Player Management Engine** built with Next.js (App Router), TypeScript, and native **Vercel Cron** automation running every 3 hours with **zero human intervention**.

---

## ⚡ Features

- **Automated 3-Hour Scheduler**: Powered by Vercel Cron (`0 */3 * * *`), automatically triggers `/api/cron/redeem` every 3 hours.
- **King Shot API Integration**:
  - Live gift code discovery: `https://kingshot.net/api/gift-codes`
  - Automated redemption execution: `https://kingshot.net/api/gift-codes/redeem`
  - Polite rate-limiting & Cloudflare-friendly stagger between requests.
- **Player Management (CRUD)**:
  - Add, edit, remove, and pause/activate players with ease.
  - Track individual King Shot Player IDs (e.g. `76301393`).
  - Active/Paused toggles to selectively include or exclude accounts from auto-redemption cycles.
- **Live Interactive Dashboard**:
  - Real-time gift code viewer with countdowns and 1-click &quot;Redeem for All&quot;.
  - Instant manual trigger button &quot;Run Auto-Redeem Now&quot;.
  - Filterable redemption logs & outcome tracking (`SUCCESS`, `ALREADY_REDEEMED`, `PLAYER_NOT_FOUND`, `EXPIRED`, `FAILED`).
- **Database-Ready Architecture**:
  - Clean `StorageAdapter` interface in `src/lib/storage.ts`.
  - Ships with in-memory caching and persistent JSON backup for local and serverless use.
  - Ready for zero-refactor migration to Supabase, PostgreSQL, Prisma, MongoDB, or Vercel KV whenever you want to add a permanent DB.

---

## 🚀 Getting Started Locally

### 1. Install Dependencies
```bash
cd ks-redeemer
npm install
```

### 2. Configure Environment Variables (Optional)
Copy the example `.env` file:
```bash
cp .env.example .env.local
```
*(Optional)* Add a `CRON_SECRET` to secure the cron endpoint.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⏱️ Vercel Cron Scheduling (Every 3 Hours)

The scheduler is declared in [`vercel.json`](./vercel.json):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/redeem",
      "schedule": "0 */3 * * *"
    }
  ]
}
```

### How it works on Vercel:
1. Deploy this repository to Vercel (`git push` or `vercel deploy`).
2. Vercel automatically detects `vercel.json` and schedules a cron job targeting `/api/cron/redeem` every 3 hours at minute 0 (`00:00`, `03:00`, `06:00`, `09:00`, `12:00`, etc. UTC).
3. Vercel Cron sends an HTTP GET request to `/api/cron/redeem` which runs the full cycle across all active players and gift codes.
4. If you define `CRON_SECRET` in your Vercel Project Settings, Vercel will automatically include `Authorization: Bearer <CRON_SECRET>` with each request.

---

## 📡 API Reference

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/cron/redeem` | `GET`, `POST` | Vercel Cron trigger (runs 3-hour redemption cycle) |
| `/api/redeem` | `POST` | Manual redemption trigger (single player/code or batch) |
| `/api/players` | `GET`, `POST` | List all players / Register a new player |
| `/api/players/[id]` | `GET`, `PUT`, `DELETE` | View, update, or remove a player |
| `/api/gift-codes` | `GET` | Fetch active and expired gift codes from Kingshot |
| `/api/logs` | `GET`, `DELETE` | Retrieve redemption history logs / Clear logs |
| `/api/stats` | `GET` | Dashboard summary metrics |

---

## 🗄️ Adding a Database Later for Logs & Players

The application was designed with modular storage separation. All data access goes through the `StorageAdapter` interface in [`src/lib/storage.ts`](./src/lib/storage.ts):

```typescript
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
```

To plug in **Supabase**, **Prisma (PostgreSQL)**, or **MongoDB**:
1. Create a class (e.g. `PostgresStorage` or `SupabaseStorage`) implementing `StorageAdapter`.
2. Replace `export const storage = new FileAndMemoryStorage();` with `export const storage = new PostgresStorage();`.
3. All API routes, UI components, and the cron worker will automatically use the new database without changing a single line of business logic!
