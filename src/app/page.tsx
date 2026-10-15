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
  ChevronLeft,
  ChevronRight,
  User,
  Award,
  Terminal,
} from "lucide-react";
import { GiftCode, Player, RedemptionLog, DashboardStats, CronRunSummary } from "@/lib/types";

interface SupabasePlayerCard {
  id?: string | number;
  playerId: string;
  name: string;
  status: "active" | "paused";
  notes?: string;
  redeemedCount: number;
  createdAt?: string;
}

export default function Dashboard() {
  // Supabase & Local Players
  const [supabasePlayers, setSupabasePlayers] = useState<SupabasePlayerCard[]>([]);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);
  const [supabaseTotal, setSupabaseTotal] = useState(0);
  const [totalAutoRedeemedGifts, setTotalAutoRedeemedGifts] = useState(0);

  // Pagination & Search States
  const [searchPlayerId, setSearchPlayerId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  // Selected Player for Profile Modal
  const [selectedProfilePlayer, setSelectedProfilePlayer] = useState<SupabasePlayerCard | null>(null);

  // Data States
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);
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

  // Modals
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<SupabasePlayerCard | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Form State
  const [formPlayerId, setFormPlayerId] = useState("");
  const [formName, setFormName] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<"active" | "paused">("active");
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Copy helper
  const handleCopy = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Fetch Supabase players with pagination and search
  const fetchSupabaseData = useCallback(async () => {
    try {
      const query = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage),
        search: searchPlayerId,
      });

      const res = await fetch(`/api/supabase/players?${query.toString()}`);
      const data = await res.json();

      if (data.success && data.players && data.players.length > 0) {
        setSupabasePlayers(data.players);
        setSupabaseTotal(data.total);
        setTotalAutoRedeemedGifts(data.totalGiftsCount || 0);
        setSupabaseError(null);
      } else {
        if (data.error) {
          setSupabaseError(data.error);
        }
        // Fallback to local players storage so UI is fully populated
        const localRes = await fetch("/api/players");
        const localData = await localRes.json();
        const logsRes = await fetch("/api/logs?limit=500");
        const logsData = await logsRes.json();
        const logsList: RedemptionLog[] = logsData.logs || [];

        // Count redemptions per player from logs
        const countMap: Record<string, number> = {};
        logsList.forEach((l) => {
          if (l.status === "SUCCESS") {
            countMap[l.playerId] = (countMap[l.playerId] || 0) + 1;
          }
        });

        let pList: SupabasePlayerCard[] = (localData.players || []).map((p: Player) => ({
          id: p.id,
          playerId: p.playerId,
          name: p.name,
          status: p.status,
          notes: p.notes,
          redeemedCount: countMap[p.playerId] || 0,
          createdAt: p.createdAt,
        }));

        if (searchPlayerId) {
          pList = pList.filter(
            (p) =>
              p.playerId.toLowerCase().includes(searchPlayerId.toLowerCase()) ||
              p.name.toLowerCase().includes(searchPlayerId.toLowerCase())
          );
        }

        const totalItems = pList.length;
        const start = (currentPage - 1) * itemsPerPage;
        setSupabasePlayers(pList.slice(start, start + itemsPerPage));
        setSupabaseTotal(totalItems);
      }
    } catch (err: any) {
      console.warn("Could not load from Supabase API, using local storage:", err);
    }
  }, [currentPage, itemsPerPage, searchPlayerId]);

  // Fetch live gift codes, logs & stats
  const fetchAuxData = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const [codesRes, logsRes, statsRes] = await Promise.all([
        fetch("/api/gift-codes"),
        fetch("/api/logs?limit=50"),
        fetch("/api/stats"),
      ]);

      const [codesData, logsData, statsData] = await Promise.all([
        codesRes.json(),
        logsRes.json(),
        statsRes.json(),
      ]);

      if (codesData.success) setGiftCodes(codesData.codes || []);
      if (logsData.success) setLogs(logsData.logs || []);
      if (statsData.success) setStats(statsData.stats || null);

      if (showToast) {
        setBanner({
          type: "success",
          message: "Data synced from Kingshot API & Supabase DB.",
        });
        setTimeout(() => setBanner(null), 3000);
      }
    } catch (err: any) {
      console.error("Aux fetch error:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSupabaseData();
  }, [fetchSupabaseData]);

  useEffect(() => {
    fetchAuxData();
  }, [fetchAuxData]);

  // Trigger auto-redeem for all
  const handleRunRedeemAll = async () => {
    if (isRunningRedeem) return;
    try {
      setIsRunningRedeem(true);
      setBanner({
        type: "info",
        message: "Automated redemption cycle running across active players & gift codes...",
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
          message: "Redemption error: " + (data.error || "Execution failed"),
        });
      }
      await Promise.all([fetchSupabaseData(), fetchAuxData()]);
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    } finally {
      setIsRunningRedeem(false);
    }
  };

  // Add / Edit Player
  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPlayerId.trim()) return;

    try {
      setFormSubmitting(true);
      if (editingPlayer) {
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
        setBanner({ type: "success", message: `Player ${formName || formPlayerId} updated!` });
      } else {
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
        setBanner({ type: "success", message: `Player ${formName || formPlayerId} registered!` });
      }

      setIsAddPlayerOpen(false);
      setEditingPlayer(null);
      resetForm();
      await fetchSupabaseData();
    } catch (err: any) {
      setBanner({ type: "error", message: err.message || "Failed to save player" });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Player
  const handleDeletePlayer = async (player: SupabasePlayerCard, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to remove player "${player.name}" (${player.playerId})?`)) return;

    try {
      const res = await fetch(`/api/players/${player.playerId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setBanner({ type: "success", message: `Player ${player.name} removed.` });
        await fetchSupabaseData();
      }
    } catch (err: any) {
      setBanner({ type: "error", message: err.message });
    }
  };

  // Toggle status
  const handleToggleStatus = async (player: SupabasePlayerCard, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = player.status === "active" ? "paused" : "active";
    try {
      await fetch(`/api/players/${player.playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      setSupabasePlayers((prev) =>
        prev.map((p) => (p.playerId === player.playerId ? { ...p, status: nextStatus } : p))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormPlayerId("");
    setFormName("");
    setFormNotes("");
    setFormStatus("active");
    setEditingPlayer(null);
  };

  const totalPages = Math.ceil(supabaseTotal / itemsPerPage) || 1;

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
              King Shot Auto-Redeemer &bull; Connected to Supabase Database
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Cron Scheduler Indicator */}
          <div className="cron-badge" title="Auto-runs every 3 hours on Vercel">
            <div className="pulse-dot" />
            <span>0 */3 * * * (Every 3h)</span>
          </div>

          {/* Sync Button */}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              fetchSupabaseData();
              fetchAuxData(true);
            }}
            disabled={isRefreshing}
          >
            <RotateCw size={14} className={isRefreshing ? "spin" : ""} />
            <span>{isRefreshing ? "Syncing..." : "Sync DB"}</span>
          </button>

          {/* Vercel & DB Setup Modal */}
          <button className="btn btn-secondary btn-sm" onClick={() => setIsGuideOpen(true)}>
            <Database size={14} />
            <span>DB & Cron Info</span>
          </button>

          {/* Run Redeem Now */}
          <button className="btn btn-gold" onClick={handleRunRedeemAll} disabled={isRunningRedeem}>
            {isRunningRedeem ? (
              <>
                <RotateCw size={16} className="spin" />
                <span>Auto-Redeeming...</span>
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
            <span>{banner.message}</span>
          </div>
          <button
            onClick={() => setBanner(null)}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* SUPABASE PERMISSION NOTICE (IF SCHEMA ACCESS IS RESTRICTED TO SERVICE_ROLE) */}
      {supabaseError && supabaseError.includes("permission denied for schema kingshot") && (
        <div
          className="banner banner-warning"
          style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
            <AlertCircle size={18} />
            <span>Supabase Schema Permission Notice</span>
          </div>
          <p style={{ fontSize: "13px" }}>
            PostgreSQL requires grant permissions for schema <code style={{ color: "#38bdf8" }}>kingshot</code> to the <code style={{ color: "#38bdf8" }}>anon</code> role. To enable direct anon queries, run this in your Supabase SQL Editor:
          </p>
          <div
            className="code-block"
            style={{ width: "100%", padding: "10px", fontSize: "12px", background: "#0a0e17" }}
          >
            GRANT USAGE ON SCHEMA kingshot TO anon, authenticated, service_role;<br />
            GRANT SELECT ON ALL TABLES IN SCHEMA kingshot TO anon, authenticated, service_role;
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            (Showing cached player profiles and gift code redemption counts in the meantime)
          </p>
        </div>
      )}

      {/* STATS OVERVIEW */}
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Active King Shot Gift Codes</span>
            <span className="stat-value">{giftCodes.filter((c) => !c.isExpired).length}</span>
            <span className="stat-subtext">Live from kingshot.net/api/gift-codes</span>
          </div>
          <div className="stat-icon gold">
            <Gift size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Tracked Players</span>
            <span className="stat-value">{supabaseTotal}</span>
            <span className="stat-subtext">In Supabase kingshot.players</span>
          </div>
          <div className="stat-icon cyan">
            <Users size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Auto-Redeemed Codes Logged</span>
            <span className="stat-value">{logs.filter((l) => l.status === "SUCCESS").length || totalAutoRedeemedGifts}</span>
            <span className="stat-subtext">Successful gift claim events</span>
          </div>
          <div className="stat-icon green">
            <Award size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">Scheduler Status</span>
            <span className="stat-value" style={{ fontSize: "20px" }}>Every 3 Hours</span>
            <span className="stat-subtext">Autonomous Vercel Cron</span>
          </div>
          <div className="stat-icon purple">
            <Clock size={24} />
          </div>
        </div>
      </section>

      {/* PRIMARY SECTION: PLAYERS CARDS WITH NUMBER OF GIFT CODES AUTO-REDEEMED */}
      <section className="section">
        <div className="section-header">
          <div>
            <div className="section-title">
              <Users size={22} color="#00d2ff" />
              <span>Registered Players &amp; Auto-Redeemed Codes</span>
              <span
                style={{
                  fontSize: "12px",
                  padding: "2px 10px",
                  borderRadius: "12px",
                  background: "rgba(0, 210, 255, 0.15)",
                  color: "#38bdf8",
                  fontWeight: 700,
                }}
              >
                {supabaseTotal} Players Found
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Click any player card to inspect profile details. Search by Player ID below.
            </p>
          </div>

          <div className="section-actions">
            {/* Search by Player ID */}
            <div style={{ position: "relative", minWidth: "260px" }}>
              <Search
                size={16}
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
                placeholder="Search by Player ID (e.g. 76301393)..."
                className="input"
                style={{ paddingLeft: "36px", height: "40px" }}
                value={searchPlayerId}
                onChange={(e) => {
                  setSearchPlayerId(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Add Player Button */}
            <button
              className="btn btn-primary"
              onClick={() => {
                resetForm();
                setIsAddPlayerOpen(true);
              }}
            >
              <Plus size={16} />
              <span>Add Player</span>
            </button>
          </div>
        </div>

        {/* PLAYERS CARDS GRID */}
        {supabasePlayers.length === 0 ? (
          <div
            style={{
              padding: "60px 20px",
              textAlign: "center",
              background: "rgba(255, 255, 255, 0.02)",
              borderRadius: "16px",
              border: "1px dashed var(--border-subtle)",
              marginTop: "20px",
            }}
          >
            <Users size={40} style={{ color: "var(--text-muted)", marginBottom: "12px" }} />
            <h4 style={{ fontSize: "16px", color: "var(--text-primary)", marginBottom: "6px" }}>
              No Players Found
            </h4>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", maxWidth: "420px", margin: "0 auto" }}>
              {searchPlayerId
                ? `No player matches ID or name "${searchPlayerId}". Try another query.`
                : "No players in the database yet. Click 'Add Player' to add your first King Shot account."}
            </p>
          </div>
        ) : (
          <div className="player-cards-grid">
            {supabasePlayers.map((player) => {
              const isActive = player.status === "active";
              return (
                <div
                  key={player.playerId}
                  className="player-card"
                  onClick={() => setSelectedProfilePlayer(player)}
                >
                  <div>
                    {/* Card Header */}
                    <div className="player-card-header">
                      <div className="player-avatar">
                        {player.name ? player.name.charAt(0).toUpperCase() : "P"}
                      </div>
                      <div className="player-card-info">
                        <div className="player-card-name" title={player.name}>
                          {player.name}
                        </div>
                        <div className="player-card-id">
                          <span>ID: {player.playerId}</span>
                          <button
                            onClick={(e) => handleCopy(player.playerId, e)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                            }}
                            title="Copy Player ID"
                          >
                            {copiedText === player.playerId ? (
                              <Check size={12} color="#10b981" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Auto Redeemed Gift Codes Metric Banner */}
                    <div className="player-card-stat" style={{ marginTop: "14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Gift size={16} color="#10b981" />
                        <span className="player-card-stat-label">Auto-Redeemed Codes</span>
                      </div>
                      <span className="player-card-stat-value">
                        {player.redeemedCount}
                      </span>
                    </div>

                    {/* Notes if present */}
                    {player.notes && (
                      <p
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                          marginTop: "10px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {player.notes}
                      </p>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: "12px",
                      borderTop: "1px solid var(--border-subtle)",
                    }}
                  >
                    {/* Status Pill Toggle */}
                    <button
                      onClick={(e) => handleToggleStatus(player, e)}
                      className={`status-pill ${isActive ? "active" : "paused"}`}
                      title="Toggle Active/Paused"
                    >
                      {isActive ? <UserCheck size={12} /> : <UserX size={12} />}
                      <span>{isActive ? "Active" : "Paused"}</span>
                    </button>

                    {/* Profile Trigger Button */}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProfilePlayer(player);
                      }}
                    >
                      <User size={12} />
                      <span>View Profile</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION CONTROLS */}
        {supabaseTotal > 0 && (
          <div className="pagination-container">
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Showing{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {Math.min((currentPage - 1) * itemsPerPage + 1, supabaseTotal)}
              </strong>{" "}
              to{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {Math.min(currentPage * itemsPerPage, supabaseTotal)}
              </strong>{" "}
              of <strong style={{ color: "var(--text-primary)" }}>{supabaseTotal}</strong> players
            </div>

            <div className="pagination-pages">
              <button
                className="pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                // Show first, last, and window around current page
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={pageNum}
                      className={`pagination-btn ${pageNum === currentPage ? "active" : ""}`}
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                  return (
                    <span key={pageNum} style={{ color: "var(--text-muted)", padding: "0 4px" }}>
                      &hellip;
                    </span>
                  );
                }
                return null;
              })}

              <button
                className="pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                <ChevronRight size={16} />
              </button>

              {/* Items per page selector */}
              <select
                className="select"
                style={{ height: "36px", padding: "6px 10px", fontSize: "12px", marginLeft: "8px" }}
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={12}>12 / page</option>
                <option value={24}>24 / page</option>
                <option value={48}>48 / page</option>
              </select>
            </div>
          </div>
        )}
      </section>

      {/* PLAYER PROFILE MODAL (READY FOR USER INSTRUCTIONS) */}
      {selectedProfilePlayer && (
        <div className="modal-overlay" onClick={() => setSelectedProfilePlayer(null)}>
          <div
            className="modal-content"
            style={{ maxWidth: "600px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="player-avatar" style={{ width: "42px", height: "42px" }}>
                  {selectedProfilePlayer.name ? selectedProfilePlayer.name.charAt(0).toUpperCase() : "P"}
                </div>
                <div>
                  <div className="modal-title" style={{ fontSize: "18px", marginBottom: "2px" }}>
                    {selectedProfilePlayer.name}
                  </div>
                  <div style={{ fontFamily: "monospace", fontSize: "13px", color: "#38bdf8" }}>
                    Player ID: {selectedProfilePlayer.playerId}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedProfilePlayer(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Profile Overview Stats */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                margin: "18px 0",
              }}
            >
              <div className="player-card-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                <span className="player-card-stat-label">Total Auto-Redeemed Codes</span>
                <span className="player-card-stat-value" style={{ fontSize: "24px" }}>
                  {selectedProfilePlayer.redeemedCount} Codes
                </span>
              </div>

              <div className="player-card-stat" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                <span className="player-card-stat-label">Scheduler Status</span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 700,
                    color: selectedProfilePlayer.status === "active" ? "#34d399" : "#94a3b8",
                  }}
                >
                  {selectedProfilePlayer.status === "active"
                    ? "✓ Active (Included in 3h Cron)"
                    : "✕ Paused (Skipped)"}
                </span>
              </div>
            </div>

            {/* Ready for additional profile fields placeholder */}
            <div
              style={{
                background: "rgba(0, 210, 255, 0.05)",
                border: "1px dashed rgba(0, 210, 255, 0.25)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "20px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38bdf8", fontWeight: 600, fontSize: "13px", marginBottom: "6px" }}>
                <Sparkles size={16} />
                <span>Player Profile Configuration</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                Ready to display custom game profile attributes (level, kingdom/server, guild/alliance, power, last redemption history, etc.). Tell me what details you want shown here!
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleCopy(selectedProfilePlayer.playerId)}
              >
                <Copy size={14} />
                <span>Copy Player ID</span>
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedProfilePlayer(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT PLAYER MODAL */}
      {isAddPlayerOpen && (
        <div className="modal-overlay" onClick={() => setIsAddPlayerOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {editingPlayer ? "Edit King Shot Player" : "Register King Shot Player"}
              </div>
              <button
                onClick={() => setIsAddPlayerOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
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
                  The numeric player identifier found in King Shot in-game profile.
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
                <label className="form-label">Auto-Redeem Scheduler</label>
                <select
                  className="select"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as "active" | "paused")}
                >
                  <option value="active">Active (Include in 3h Scheduler)</option>
                  <option value="paused">Paused (Skip automated runs)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Guild member alt or server notes"
                  className="input"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsAddPlayerOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? (
                    <>
                      <RotateCw size={14} className="spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingPlayer ? "Save Changes" : "Register Player"}</span>
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
          <div className="modal-content" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Server size={20} color="#00d2ff" />
                <span>Vercel Cron &amp; Supabase Integration Details</span>
              </div>
              <button
                onClick={() => setIsGuideOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "14px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
              <div>
                <strong style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Database size={16} color="#a855f7" />
                  Connected Supabase Project
                </strong>
                <p style={{ marginTop: "4px" }}>
                  REST Endpoints:
                </p>
                <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
                  <li><code style={{ color: "#38bdf8" }}>https://rcqdzisofoblqvbjvcbp.supabase.co/rest/v1/kingshot.players</code></li>
                  <li><code style={{ color: "#38bdf8" }}>https://rcqdzisofoblqvbjvcbp.supabase.co/rest/v1/kingshot.player-gifts</code></li>
                </ul>
              </div>

              <div>
                <strong style={{ color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Clock size={16} color="#f59e0b" />
                  Vercel Cron (0 */3 * * *)
                </strong>
                <p style={{ marginTop: "4px" }}>
                  Configured in <code style={{ color: "#38bdf8" }}>vercel.json</code> to hit <code style={{ color: "#38bdf8" }}>/api/cron/redeem</code> every 3 hours with zero human intervention.
                </p>
              </div>
            </div>

            <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary" onClick={() => setIsGuideOpen(false)}>
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
