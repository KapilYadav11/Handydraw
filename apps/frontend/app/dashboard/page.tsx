"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  LogOut,
  Clock,
  Sparkles,
  Lock,
  Eye,
  EyeOff,
  Users,
  KeyRound,
} from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { Logo } from "@/components/Logo";
import { getRecentRooms, addRecentRoom } from "@/lib/recentRooms";

const DOT_COLORS = ["#3B5BFF", "#FFB020", "#FF5D5D", "#7EE0A8", "#C792EA"];

function colorForRoom(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return DOT_COLORS[Math.abs(hash) % DOT_COLORS.length];
}

type Mode = "create" | "join";

export default function Dashboard() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("join");
  const [teamName, setTeamName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentRooms, setRecentRooms] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/signin");
      return;
    }
    setRecentRooms(getRecentRooms());
    setMounted(true);
  }, [router]);

  function switchMode(next: Mode) {
    setMode(next);
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  function useRecentRoom(name: string) {
    setMode("join");
    setTeamName(name);
    setError("");
    setPassword("");
  }

  async function handleSubmit() {
    setError("");
    const token = localStorage.getItem("token");

    if (!teamName.trim()) {
      setError("Enter a team name");
      return;
    }
    if (!password) {
      setError("Enter a password");
      return;
    }
    if (mode === "create" && password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === "create" ? "/room" : "/room/join";
      const res = await axios.post(
        `${HTTP_BACKEND}${endpoint}`,
        { name: teamName.trim(), password },
        { headers: { Authorization: token || "" } }
      );
      sessionStorage.setItem(`room-access-${res.data.roomId}`, "true");
      sessionStorage.setItem(`room-name-${res.data.roomId}`, res.data.roomName || teamName.trim());
      addRecentRoom(res.data.roomName || teamName.trim());
      router.push(`/canvas/${res.data.roomId}`);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
        (mode === "create"
          ? "Could not create team. Please try again."
          : "Could not join team. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    router.push("/signin");
  }

  const font = { fontFamily: "'Plus Jakarta Sans', sans-serif" };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#14171B] px-6 py-16">
      <div className="pointer-events-none absolute -left-40 top-0 h-[32rem] w-[32rem] rounded-full bg-[#3B5BFF]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-[28rem] w-[28rem] rounded-full bg-[#FFB020]/15 blur-[120px]" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(#F3EFE6 1px, transparent 1px), linear-gradient(90deg, #F3EFE6 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      <button
        onClick={logout}
        className="absolute right-6 top-6 flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-[#F3EFE6]/60 transition-colors hover:border-white/25 hover:text-[#F3EFE6] lg:right-10 lg:top-8"
        style={font}
      >
        <LogOut size={14} /> Log out
      </button>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <Logo />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-[#F3EFE6]/70"
        style={font}
      >
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >
          <Sparkles size={13} className="text-[#FFB020]" />
        </motion.span>
        Ready when you are
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="mb-8 text-center text-4xl text-[#F3EFE6] sm:text-5xl"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Where to today?
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={mounted ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur-xl"
      >
        <div className="mb-3 flex gap-1 rounded-2xl bg-black/30 p-1" style={font}>
          <button
            onClick={() => switchMode("join")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm transition-colors ${mode === "join"
                ? "bg-white/10 text-[#F3EFE6]"
                : "text-[#F3EFE6]/40 hover:text-[#F3EFE6]/70"
              }`}
          >
            <Users size={14} /> Join a team
          </button>
          <button
            onClick={() => switchMode("create")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm transition-colors ${mode === "create"
                ? "bg-white/10 text-[#F3EFE6]"
                : "text-[#F3EFE6]/40 hover:text-[#F3EFE6]/70"
              }`}
          >
            <KeyRound size={14} /> Create a team
          </button>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-[#0F1114] p-4" style={font}>
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="Team name"
            className="w-full bg-transparent text-[#F3EFE6] outline-none placeholder:text-[#F3EFE6]/25"
          />
          <div className="h-px bg-white/10" />
          <div className="relative flex items-center">
            <Lock size={14} className="mr-2 shrink-0 text-[#F3EFE6]/30" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !confirmPassword && mode === "join" && handleSubmit()}
              placeholder="Password"
              className="w-full bg-transparent text-[#F3EFE6] outline-none placeholder:text-[#F3EFE6]/25"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-[#F3EFE6]/30 hover:text-[#F3EFE6]/60"
            >
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <AnimatePresence>
            {mode === "create" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="h-px bg-white/10 mb-3" />
                <div className="flex items-center">
                  <Lock size={14} className="mr-2 shrink-0 text-[#F3EFE6]/30" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="Confirm password"
                    className="w-full bg-transparent text-[#F3EFE6] outline-none placeholder:text-[#F3EFE6]/25"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          onClick={handleSubmit}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-[#F3EFE6] py-3 text-sm font-medium text-[#14171B] transition-opacity disabled:opacity-50"
          style={font}
        >
          {loading
            ? "..."
            : mode === "create"
              ? "Create team"
              : "Join team"}
          {!loading && <ArrowRight size={14} />}
        </motion.button>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="px-2 pt-3 text-sm text-[#FF7A7A]"
              style={font}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {recentRooms.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={mounted ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="mt-10 w-full max-w-md"
        >
          <div
            className="mb-3 flex items-center gap-1.5 text-xs text-[#F3EFE6]/40"
            style={font}
          >
            <Clock size={12} /> Recent teams
          </div>
          <div className="flex flex-wrap gap-2">
            {recentRooms.map((room, i) => (
              <motion.button
                key={room}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.06 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => useRecentRoom(room)}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-[#F3EFE6]/80 transition-colors hover:border-white/25"
                style={font}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorForRoom(room) }}
                />
                {room}
              </motion.button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[#F3EFE6]/30" style={font}>
            Clicking a team fills the name — you'll still need its password.
          </p>
        </motion.div>
      )}
    </div>
  );
}
