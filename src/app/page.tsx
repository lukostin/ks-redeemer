"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Users,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  Server,
  Database,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Sparkles,
  History,
  X,
  UserCheck,
  UserX,
} from "lucide-react";
import { GiftCode, Player, RedemptionLog, DashboardStats, CronRunSummary } from "@/lib/types";

export default function Dashboard() {
  // Data States
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [logs, setLogs] = useState<RedemptionLog[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRunningRedeem, setIsRunningRedeem] = useState(false);

  // UI States
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [banner, setBanner] = useState<{
    type: "success" | "error" | "info" | "warning";
    message: string;
  } | null>(null);

  // Modal States
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Form State
  const [formPlayerId, setFormPlayerId] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "paused">("active");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Filters
  const [playerSearch, setPlayerSearch] = useState("");
  const [logFilterStatus, setLogFilterStatus] = useState<string>("ALL");
  const [logSearch, setLogSearch] = useState("");

  // Copy helper
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Fetch all dashboard data
  const fetchData = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const [codesRes, playersRes, logsRes, statsRes] = await Promise.all([
        fetch("/api/gift-codes"),
        fetch("/api/players"),
        fetch("/api/logs?limit=50"),
        fetch("/api/stats"),
      ]);

      const [codesData, playersData, logsData, statsData] = await Promise.all([
        codesRes.json(),
        playersRes.json(),
        logsRes.json(),
        statsRes.json(),
      ]);

      if (codesData.success) setGiftCodes(codesData.codes || []);
      if (playersData.success) setPlayers(playersData.players || []);
      if (logsData.success) setLogs(logsData.logs || []);
      if (statsData.success) setStats(statsData.stats || null);

      if (showToast) {
        setBanner({
          type: "success",
          message: "Data refreshed from King Shot API & storage.",
        });
        setTimeout(() => setBanner(null), 3000);
      }
    } catch (err: any) {
      console.error("Failed to load dashboard data:", err);
      setBanner({
        type: "error",
        message: "Failed to connect to backend: " + (err.message || "Unknown error"),
      });
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Trigger full redemption run
  const handleRunRedeemAll = async () => {
    if (isRunningRedeem) return;
    try {
      setIsRunningRedeem(true);
      setBanner({
        type: "info",
        message: "Redemption cycle in progress... Processing all active players & codes.",
      });

      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (data.success && data.summary) {
        const s: CronRunSummary = data.summary;
        setBanner({
          type: "success",
          message: `Cycle Complete in ${(s.durationMs / 1000).toFixed(1)}s! Success: ${s.successCount} • Already Redeemed: ${s.alreadyRedeemedCount} • Failed: ${s.failedCount}`,
        });
      } else {
        setBanner({
          type: "error",
          message: "Redemption cycle failed: " + (data.error || "Unknown error"),
        });
      }
      await fetchData();
    } catch (err: any) {
      setBanner({
        type: "error",
        message: "Redeem error: " + err.message,
      });
    } finally {
      setIsRunningRedeem(false);
    }
  };

  // Redeem single code for all active players
  const handleRedeemSpecificCode = async (giftCode: string) => {
    try {
      setIsRunningRedeem(true);
      setBanner({
        type: "info",
        message: `Redeeming code "${giftCode}" for all active players...`,
      });

      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftCodes: [giftCode] }),
      });

      const data = await res.json();
      if (data.success) {
        setBanner({
          type: "success",
          message: `Code "${giftCode}" processed across all active players!`,
        });
      } else {
        setBanner({
          type: "error",
          message: "Failed: " + (data.error || "Error executing code redemption"),
        });
      }
      await fetchData();
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setIsRunningRedeem(false);
    }
  };

  // Redeem for single player
  const handleRedeemSpecificPlayer = async (playerId: string, playerName: string) => {
    try {
      setIsRunningRedeem(true);
      setBanner({
        type: "info",
        message: `Attempting redemption for ${playerName} (${playerId})...`,
      });

      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerIds: [playerId] }),
      });

      const data = await res.json();
      if (data.success) {
        setBanner({
          type: "success",
          message: `Redemption finished for ${playerName}!`,
        });
      } else {
        setBanner({ type: "error", message: "Failed: " + data.error });
      }
      await fetchData();
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setIsRunningRedeem(false);
    }
  };

  // Add / Edit Player Submission
  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlayerId.trim()) return;

    try {
      setFormSubmitting(true);

      if (editingPlayer) {
        // Update
        const res = await fetch(`/api/players/${editingPlayer.playerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: formPlayerId.trim(),
            name: formName.trim(),
            notes: formNotes.trim(),
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setBanner({
          type: "success",
          message: `Player ${formName || formPlayerId} updated successfully!`,
        });
      } else {
        // Add
        const res = await fetch("/api/players", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: formPlayerId.trim(),
            name: formName.trim(),
            notes: formNotes.trim(),
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        setBanner({
          type: "success",
          message: `Player ${formName || formPlayerId} added to tracked list!`,
        });
      }

      setIsAddPlayerOpen(false);
      setEditingPlayer(null);
      resetForm();
      await fetchData();
    } catch (err: any) {
      setBanner({
        type: "error",
        message: err.message || "Could not save player",
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Player Status (active <-> paused)
  const handleToggleStatus = async (player: Player) => {
    const nextStatus = player.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/players/${player.playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setPlayers((prev) =>
          prev.map((p) => (p.playerId === player.playerId ? { ...p, status: nextStatus } : p))
        );
      }
    } catch (err) {
      console.error("Toggle player status error:", err);
    }
  };

  // Delete Player
  const handleDeletePlayer = async (player: Player) => {
    if (!confirm(`Are you sure you want to remove player "${player.name}" (${player.playerId})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/players/${player.playerId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setBanner({
          type: "success",
          message: `Player ${player.name} removed.`,
        });
        await fetchData();
      } else {
        setBanner({ type: "error", message: data.error });
      }
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    }
  };

  // Clear Logs
  const handleClearLogs = async () => {
    if (!confirm("Are you sure you want to clear all redemption logs?")) return;
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setLogs([]);
        setBanner({ type: "success", message: "Redemption logs cleared." });
      }
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    }
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setFormPlayerId(player.playerId);
    setFormName(player.name);
    setFormNotes(player.notes || "");
    setFormStatus(player.status);
    setIsAddPlayerOpen(true);
  };

  const resetForm = () => {
    setFormPlayerId("");
    setFormName("");
    setFormNotes("");
    setFormStatus("active");
    setEditingPlayer(null);
  };

  // Filtered Players
  const filteredPlayers = players.filter((p) => {
    const q = playerSearch.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.playerId.includes(q);
  });

  // Filtered Logs
  const filteredLogs = logs.filter((l) => {
    const matchesStatus =
      logFilterStatus === "ALL" || l.status.toLowerCase() === logFilterStatus.toLowerCase();
    const q = logSearch.toLowerCase();
    const matchesSearch =
      l.playerId.includes(q) ||
      l.playerName.toLowerCase().includes(q) ||
      l.giftCode.toLowerCase().includes(q) ||
      l.message.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="app-container">
      {/* HEADER */}
      <header className="header">
        <div className="brand">
          <div className="brand-icon-wrapper">
            <Sparkles size={24} />
          </div>
          <div>
            <div className="brand-title">
              KS REDEEMER
              <span className="brand-badge">PRO AUTO-ENGINE</span>
            </div>
            <div className="brand-subtitle">
              Automated King Shot Gift Code Engine & Player Management
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Cron Scheduler Indicator */}
          <div
            className="cron-badge"
            title="Runs every 3 hours automatically via Vercel Cron"
          >
            <div className="pulse-dot" />
            <span>Vercel Cron: 0 */3 * * * (Every 3h)</span>
          </div>

          {/* Quick Refresh */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            title="Refresh Live Codes and Storage"
          >
            <RotateCw size={14} className={isRefreshing ? "spin" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync"}</span>
          </button>

          {/* Architecture / Vercel Guide */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsGuideOpen(true)}
          >
            <Server size={14} />
            <span>Vercel & DB Setup</span>
          </button>

          {/* Manual Redeem Run Trigger */}
          <button
            className="btn btn-gold"
            onClick={handleRunRedeemAll}
            disabled={isRunningRedeem}
          >
            {isRunningRedeem ? (
              <>
                <RotateCw size={16} className="spin" />
                <span>Redeeming...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Run Auto-Redeem Now</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ALERT / BANNER */}
      {banner && (
        <div className={`banner banner-${banner.type}`}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {banner.type === "success" && <CheckCircle2 size={18} />}
            {banner.type === "error" && <AlertCircle size={18} />}
            {banner.type === "info" && <RotateCw size={18} className="spin" />}
            {banner.type === "warning" && <AlertCircle size={18} />}
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* METRICS / STATS RIBBON */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Active Gift Codes</span>
            <span className="stat-value">
              {giftCodes.filter((c) => !c.isExpired).length}
            </span>
            <span className="stat-subtext">
              Direct from kingshot.net/api/gift-codes
            </span>
          </div>
          <div className="stat-icon gold">
            <Gift size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Tracked Players</span>
            <span className="stat-value">
              {players.filter((p) => p.status === "active").length}{" "}
              <span style={{ fontSize: "16px", color: "var(--text-muted)" }}>
                / {players.length}
              </span>
            </span>
            <span className="stat-subtext">Active for auto-redemption</span>
          </div>
          <div className="stat-icon cyan">
            <Users size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Total Redemptions Logged</span>
            <span className="stat-value">{logs.length}</span>
            <span className="stat-subtext">
              {logs.filter((l) => l.status === "SUCCESS").length} confirmed
              successes
            </span>
          </div>
          <div className="stat-icon green">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Scheduler Status</span>
            <span className="stat-value" style={{ fontSize: "20px" }}>
              Every 3 Hours
            </span>
            <span className="stat-subtext">
              {stats?.lastCronRun
                ? `Last run: ${new Date(
                    stats.lastCronRun.timestamp
                  ).toLocaleTimeString()}`
                : "Awaiting next scheduled run"}
            </span>
          </div>
          <div className="stat-icon purple">
            <Clock size={24} />
          </div>
        </div>
      </section>

      {/* ACTIVE GIFT CODES SECTION */}
      <section className="section">
        <div className="section-header">
          <div className="section-title">
            <Gift size={20} color="#f59e0b" />
            <span>King Shot Live Gift Codes</span>
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
              }}
            >
              {giftCodes.filter((c) => !c.isExpired).length} Active Codes
            </span>
          </div>
          <div className="section-actions">
            <a
              href="https://kingshot.net/api/gift-codes"
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={12} />
              <span>Kingshot API</span>
            </a>
          </div>
        </div>

        {giftCodes.length === 0 ? (
          <div style={{ color: "var(--text-secondary)", padding: "16px 0" }}>
            No gift codes loaded yet. Click Sync to fetch live codes.
          </div>
        ) : (
          <div className="codes-grid">
            {giftCodes.map((code) => {
              const isExpired = !!code.isExpired;
              return (
                <div key={code.code} className="code-card">
                  <div className="code-badge-row">
                    <span className="code-name">{code.code}</span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopy(code.code)}
                      title="Copy gift code"
                    >
                      {copiedText === code.code ? (
                        <Check size={12} color="#10b981" />
                      ) : (
                        <Copy size={12} />
                      )}
                      <span>
                        {copiedText === code.code ? "Copied" : "Copy"}
                      </span>
                    </button>
                  </div>

                  <div className="code-expiry">
                    <Clock size={12} />
                    {code.expiresAt ? (
                      <span>
                        Expires:{" "}
                        {new Date(code.expiresAt).toLocaleDateString()} (
                        {new Date(code.expiresAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        )
                      </span>
                    ) : (
                      <span style={{ color: "#34d399" }}>
                        Permanent / No Expiration
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: "4px",
                    }}
                  >
                    <span
                      className={`badge ${
                        isExpired ? "badge-danger" : "badge-success"
                      }`}
                    >
                      {isExpired ? "Expired" : "Active"}
                    </span>

                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleRedeemSpecificCode(code.code)}
                      disabled={isRunningRedeem || isExpired}
                      title="Trigger redemption of this code across all active players"
                    >
                      <Sparkles size={12} />
                      <span>Redeem for All</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* PLAYER MANAGEMENT (CRUD) */}
      <section className="section">
        <div className="section-header">
          <div className="section-title">
            <Users size={20} color="#00d2ff" />
            <span>Player Management (CRUD)</span>
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(0, 210, 255, 0.15)",
                color: "#38bdf8",
              }}
            >
              {players.length} Total Registered
            </span>
          </div>

          <div className="section-actions">
            <div style={{ position: "relative", minWidth: "220px" }}>
              <Search
                size={14}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                type="text"
                placeholder="Search player or ID..."
                className="input"
                style={{ paddingLeft: "34px", height: "36px" }}
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
              />
            </div>

            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                resetForm();
                setIsAddPlayerOpen(true);
              }}
            >
              <Plus size={14} />
              <span>Add Player</span>
            </button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Player ID</th>
                <th>Player Name / Tag</th>
                <th>Status (Auto-Redeem)</th>
                <th>Notes</th>
                <th>Added</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      padding: "32px",
                    }}
                  >
                    No players found. Click &quot;Add Player&quot; to register your first King Shot account.
                  </td>
                </tr>
              ) : (
                filteredPlayers.map((player) => {
                  const isActive = player.status === "active";
                  return (
                    <tr key={player.id}>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#38bdf8",
                            }}
                          >
                            {player.playerId}
                          </span>
                          <button
                            onClick={() => handleCopy(player.playerId)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                            }}
                            title="Copy ID"
                          >
                            {copiedText === player.playerId ? (
                              <Check size={12} color="#10b981" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontWeight: 600 }}>{player.name}</span>
                      </td>

                      <td>
                        <button
                          onClick={() => handleToggleStatus(player)}
                          className={`status-pill ${
                            isActive ? "active" : "paused"
                          }`}
                          title="Click to toggle Active / Paused"
                        >
                          {isActive ? (
                            <UserCheck size={12} />
                          ) : (
                            <UserX size={12} />
                          )}
                          <span>{isActive ? "Active" : "Paused"}</span>
                        </button>
                      </td>

                      <td
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                        }}
                      >
                        {player.notes || "—"}
                      </td>

                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "12px",
                        }}
                      >
                        {new Date(player.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "6px",
                          }}
                        >
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              handleRedeemSpecificPlayer(
                                player.playerId,
                                player.name
                              )
                            }
                            disabled={isRunningRedeem}
                            title="Redeem all codes for this player now"
                          >
                            <Play size={12} />
                            <span>Redeem</span>
                          </button>

                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(player)}
                            title="Edit player"
                          >
                            <Edit2 size={12} />
                          </button>

                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeletePlayer(player)}
                            title="Delete player"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* REDEMPTION LOGS & HISTORY */}
      <section className="section">
        <div className="section-header">
          <div className="section-title">
            <History size={20} color="#a855f7" />
            <span>Redemption Logs & History</span>
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "12px",
                background: "rgba(168, 85, 247, 0.15)",
                color: "#c084fc",
              }}
            >
              {filteredLogs.length} Records
            </span>
          </div>

          <div className="section-actions">
            {/* Status Filter */}
            <select
              className="select"
              value={logFilterStatus}
              onChange={(e) => setLogFilterStatus(e.target.value)}
              style={{ height: "36px" }}
            >
              <option value="ALL">All Outcomes</option>
              <option value="SUCCESS">Success Only</option>
              <option value="ALREADY_REDEEMED">Already Redeemed</option>
              <option value="FAILED">Failed / Errors</option>
            </select>

            {/* Search */}
            <div style={{ position: "relative", minWidth: "200px" }}>
              <input
                type="text"
                placeholder="Filter logs..."
                className="input"
                style={{ height: "36px" }}
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
              />
            </div>

            {/* Clear Logs */}
            {logs.length > 0 && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleClearLogs}
              >
                <Trash2 size={12} />
                <span>Clear Logs</span>
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Player</th>
                <th>Gift Code</th>
                <th>Outcome Status</th>
                <th>API Response Details</th>
                <th>HTTP</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      padding: "32px",
                    }}
                  >
                    No redemption logs matching criteria. Run a redemption cycle
                    to generate logs.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  let badgeClass = "badge-danger";
                  if (log.status === "SUCCESS") badgeClass = "badge-success";
                  if (log.status === "ALREADY_REDEEMED")
                    badgeClass = "badge-info";
                  if (log.status === "PLAYER_NOT_FOUND")
                    badgeClass = "badge-warning";

                  return (
                    <tr key={log.id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontSize: "12px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {new Date(log.timestamp).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>

                      <td>
                        <span style={{ fontWeight: 600 }}>{log.playerName}</span>{" "}
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "12px",
                            color: "var(--text-muted)",
                          }}
                        >
                          ({log.playerId})
                        </span>
                      </td>

                      <td>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: "#fde68a",
                          }}
                        >
                          {log.giftCode}
                        </span>
                      </td>

                      <td>
                        <span className={`badge ${badgeClass}`}>
                          {log.status === "SUCCESS" && (
                            <CheckCircle2 size={12} />
                          )}
                          {log.status === "ALREADY_REDEEMED" && (
                            <Check size={12} />
                          )}
                          {log.status !== "SUCCESS" &&
                            log.status !== "ALREADY_REDEEMED" && (
                              <AlertCircle size={12} />
                            )}
                          <span>{log.status.replace(/_/g, " ")}</span>
                        </span>
                      </td>

                      <td
                        style={{
                          color: "var(--text-secondary)",
                          fontSize: "13px",
                        }}
                      >
                        {log.message}
                      </td>

                      <td>
                        <span
                          style={{
                            fontSize: "12px",
                            fontFamily: "monospace",
                            color:
                              log.httpStatus === 200
                                ? "#34d399"
                                : log.httpStatus === 400
                                ? "#38bdf8"
                                : "#f87171",
                          }}
                        >
                          {log.httpStatus || "ERR"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ADD / EDIT PLAYER MODAL */}
      {isAddPlayerOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPlayerOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {editingPlayer ? "Edit King Shot Player" : "Add King Shot Player"}
              </div>
              <button
                onClick={() => setIsAddPlayerOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePlayer}>
              <div className="form-group">
                <label className="form-label">King Shot Player ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 76301393"
                  className="input"
                  value={formPlayerId}
                  onChange={(e) => setFormPlayerId(e.target.value)}
                />
                <span className="form-hint">
                  The numeric player identifier found in King Shot profile
                  settings.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Player Nickname / Label</label>
                <input
                  type="text"
                  placeholder="e.g. LordAustin (Main Account)"
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Auto-Redemption Status</label>
                <select
                  className="select"
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as "active" | "paused")
                  }
                >
                  <option value="active">Active (Include in 3h Scheduler)</option>
                  <option value="paused">Paused (Skip automatic redemptions)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Guild member alt or primary guild leader"
                  className="input"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddPlayerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <>
                      <RotateCw size={14} className="spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingPlayer ? "Save Changes" : "Add Player"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VERCEL CRON & DATABASE SETUP MODAL */}
      {isGuideOpen && (
        <div className="modal-overlay" onClick={() => setIsGuideOpen(false)}>
          <div
            className="modal-content"
            style={{ maxWidth: "680px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={20} color="#00d2ff" />
                <span>Vercel Deployment & Database Integration Guide</span>
              </div>
              <button
                onClick={() => setIsGuideOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
              <div>
                <strong style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={16} color="#f59e0b" />
                  1. Zero-Intervention Vercel Cron (Every 3 Hours)
                </strong>
                <p style={{ marginTop: "4px" }}>
                  This project includes a native <code style={{ color: "#38bdf8" }}>vercel.json</code> cron configuration:
                </p>
                <div className="code-block" style={{ marginTop: "8px" }}>
{`{
  "crons": [
    {
      "path": "/api/cron/redeem",
      "schedule": "0 */3 * * *"
    }
  ]
}`}
                </div>
                <p style={{ marginTop: "8px" }}>
                  When deployed on Vercel, Vercel Cron automatically triggers <code style={{ color: "#38bdf8" }}>/api/cron/redeem</code> every 3 hours with zero human intervention.
                </p>
              </div>

              <div>
                <strong style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldCheck size={16} color="#10b981" />
                  2. Optional CRON_SECRET Security
                </strong>
                <p style={{ marginTop: "4px" }}>
                  In your Vercel Project Settings &gt; Environment Variables, you can optionally set <code style={{ color: "#38bdf8" }}>CRON_SECRET</code>. Vercel automatically passes this in the Authorization header.
                </p>
              </div>

              <div>
                <strong style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Database size={16} color="#a855f7" />
                  3. Modular Storage & Adding a DB Later
                </strong>
                <p style={{ marginTop: "4px" }}>
                  The data layer is built with an extensible <code style={{ color: "#38bdf8" }}>StorageAdapter</code> interface in <code style={{ color: "#38bdf8" }}>src/lib/storage.ts</code>. Currently it stores players and logs with in-memory caching and persistent JSON backup. When you are ready to connect PostgreSQL, Supabase, Prisma, or MongoDB:
                </p>
                <ul style={{ paddingLeft: "20px", marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li>Implement the <code style={{ color: "#38bdf8" }}>StorageAdapter</code> interface in <code style={{ color: "#38bdf8" }}>src/lib/storage.ts</code>.</li>
                  <li>No UI or API route changes needed—all endpoints consume the interface seamlessly!</li>
                </ul>
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={() => setIsGuideOpen(false)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
