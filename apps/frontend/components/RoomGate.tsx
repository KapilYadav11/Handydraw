"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Lock, Eye, EyeOff } from "lucide-react";
import { HTTP_BACKEND } from "@/config";
import { Logo } from "./Logo";
import { RoomCanvas } from "./RoomCanvas";

function accessKey(roomId: string) {
  return `room-access-${roomId}`;
}
function nameKey(roomId: string) {
  return `room-name-${roomId}`;
}

export function RoomGate({ roomId }: { roomId: string }) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [roomName, setRoomName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const alreadyGranted = sessionStorage.getItem(accessKey(roomId));
    const storedName = sessionStorage.getItem(nameKey(roomId));
    if (alreadyGranted === "true") {
      setRoomName(storedName || "");
      setGranted(true);
    } else {
      setGranted(false);
    }
  }, [roomId]);

  async function handleUnlock() {
    setError("");
    if (!password) {
      setError("Enter the room password");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${HTTP_BACKEND}/room/verify-access`,
        { roomId, password },
        { headers: { Authorization: token || "" } }
      );
      sessionStorage.setItem(accessKey(roomId), "true");
      sessionStorage.setItem(nameKey(roomId), res.data.roomName || "");
      setRoomName(res.data.roomName || "");
      setGranted(true);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  if (granted === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#14171B] text-[#F3EFE6]/60">
        Loading...
      </div>
    );
  }

  if (granted) {
    return <RoomCanvas roomId={roomId} roomName={roomName} />;
  }

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#14171B] px-6">
      <div className="pointer-events-none absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-[#3B5BFF]/20 blur-[120px]" />
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
            <Lock size={20} className="text-[#F3EFE6]/70" />
          </div>
        </div>

        <h2
          className="mb-1 text-center text-2xl text-[#F3EFE6]"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Password required
        </h2>
        <p className="mb-6 text-center text-sm text-[#F3EFE6]/50">
          This room is protected. Enter the password to continue.
        </p>

        <div className="flex items-center rounded-2xl bg-[#0F1114] px-4 py-3">
          <Lock size={14} className="mr-2 shrink-0 text-[#F3EFE6]/30" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
            placeholder="Room password"
            autoFocus
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

        {error && <p className="mt-3 text-sm text-[#FF7A7A]">{error}</p>}

        <button
          disabled={loading}
          onClick={handleUnlock}
          className="mt-4 w-full rounded-2xl bg-[#F3EFE6] py-3 text-sm font-medium text-[#14171B] transition-opacity disabled:opacity-50"
        >
          {loading ? "Checking..." : "Unlock room"}
        </button>
      </div>
    </div>
  );
}
