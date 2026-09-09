"use client";

import { WS_URL } from "@/config";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "./Canvas";

export function RoomCanvas({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<"connecting" | "no-token" | "error">(
    "connecting"
  );
  const socketRef = useRef<WebSocket | null>(null);
  const openedRef = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("no-token");
      router.push("/signin");
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    socketRef.current = ws;
    openedRef.current = false;

    const connectTimeout = setTimeout(() => {
      if (!openedRef.current) {
        setStatus("error");
      }
    }, 6000);

    ws.onopen = () => {
      openedRef.current = true;
      clearTimeout(connectTimeout);
      setSocket(ws);
      ws.send(
        JSON.stringify({
          type: "join_room",
          roomId,
        })
      );
    };

    ws.onerror = () => {
      setStatus("error");
    };

    ws.onclose = () => {
      setSocket(null);
      if (!openedRef.current) {
        setStatus("error");
      }
    };

    return () => {
      clearTimeout(connectTimeout);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave_room", roomId }));
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        ws.onopen = () => {
          ws.close();
        };
      } else {
        ws.close();
      }
    };
  }, [roomId, router]);

  if (!socket) {
    return (
      <div className="flex w-screen h-screen flex-col items-center justify-center gap-3 bg-black text-white">
        <p>
          {status === "error"
            ? "Could not connect to the room."
            : "Connecting to server..."}
        </p>
        {status === "error" && (
          <p className="max-w-sm text-center text-sm text-white/50">
            This can happen if you signed in before a server restart. Try
            signing out and signing in again.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <Canvas roomId={roomId} socket={socket} />
    </div>
  );
}