"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import {
  Circle,
  MousePointer2,
  Pencil,
  RectangleHorizontalIcon,
  Minus,
  Plus,
  MoveUpRight,
  Type,
  StickyNote,
  Share2,
  X,
  Copy,
  Check,
} from "lucide-react";
import { Game } from "@/draw/Game";
import { QRCodeBox } from "./QRCodeBox";

export type Tool = "circle" | "rect" | "pencil" | "select" | "arrow" | "text" | "sticky";

export function Canvas({
  roomId,
  socket,
  roomName,
}: {
  socket: WebSocket;
  roomId: string;
  roomName?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | undefined>(undefined);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);
  const [sharePanelOpen, setSharePanelOpen] = useState(false);

  useEffect(() => {
    setDimensions({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () =>
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    game?.setTool(selectedTool);
  }, [selectedTool, game]);

  useEffect(() => {
    if (canvasRef.current) {
      const g = new Game(canvasRef.current, roomId, socket);
      gameRef.current = g;
      g.onViewportChange = (scale) => setZoom(scale);
      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [canvasRef, roomId, socket]);

  return (
    <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: selectedTool === "select" ? "default" : "crosshair" }}
      ></canvas>

      <Topbar
        selectedTool={selectedTool}
        setSelectedTool={setSelectedTool}
        onShareClick={() => setSharePanelOpen(true)}
      />
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => game?.zoomBy(1.2)}
        onZoomOut={() => game?.zoomBy(1 / 1.2)}
        onReset={() => game?.resetView()}
      />

      <SharePanel
        open={sharePanelOpen}
        onClose={() => setSharePanelOpen(false)}
        roomId={roomId}
        roomName={roomName}
      />
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
  onShareClick,
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
  onShareClick: () => void;
}) {
  return (
    <div style={{ position: "fixed", top: 10, left: 10 }}>
      <div className="flex gap-1 bg-black/60 p-1 rounded-lg">
        <IconButton
          onClick={onShareClick}
          activated={false}
          icon={<Share2 />}
        />
        <div className="my-1 w-px bg-white/10" />
        <IconButton
          onClick={() => setSelectedTool("select")}
          activated={selectedTool === "select"}
          icon={<MousePointer2 />}
        />
        <IconButton
          onClick={() => setSelectedTool("pencil")}
          activated={selectedTool === "pencil"}
          icon={<Pencil />}
        />
        <IconButton
          onClick={() => setSelectedTool("rect")}
          activated={selectedTool === "rect"}
          icon={<RectangleHorizontalIcon />}
        />
        <IconButton
          onClick={() => setSelectedTool("circle")}
          activated={selectedTool === "circle"}
          icon={<Circle />}
        />
        <IconButton
          onClick={() => setSelectedTool("arrow")}
          activated={selectedTool === "arrow"}
          icon={<MoveUpRight />}
        />
        <IconButton
          onClick={() => setSelectedTool("text")}
          activated={selectedTool === "text"}
          icon={<Type />}
        />
        <IconButton
          onClick={() => setSelectedTool("sticky")}
          activated={selectedTool === "sticky"}
          icon={<StickyNote />}
        />
      </div>
    </div>
  );
}

function SharePanel({
  open,
  onClose,
  roomId,
  roomName,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string;
  roomName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setLink(`${window.location.origin}/canvas/${roomId}`);
    }
  }, [roomId]);

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!open) return null;

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40"
        style={{ backdropFilter: "blur(2px)" }}
      />
      <div
        className="fixed left-0 top-0 z-50 flex h-full w-[320px] flex-col bg-[#14171B] p-6 shadow-2xl"
        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="mb-6 flex items-center justify-between">
          <h3
            className="text-lg text-[#F3EFE6]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Share this room
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#F3EFE6]/50 hover:bg-white/5 hover:text-[#F3EFE6]"
          >
            <X size={18} />
          </button>
        </div>

        {roomName && (
          <p className="mb-4 text-sm text-[#F3EFE6]/50">
            Team: <span className="text-[#F3EFE6]">{roomName}</span>
          </p>
        )}

        <div className="mb-5 flex flex-col items-center gap-3 rounded-2xl bg-white/[0.03] p-5">
          <QRCodeBox value={link} size={150} />
          <p className="text-center text-xs text-[#F3EFE6]/40">
            Scan to open this room
          </p>
        </div>

        <label className="mb-2 text-xs text-[#F3EFE6]/50">Shareable link</label>
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.03] p-2">
          <input
            readOnly
            value={link}
            className="min-w-0 flex-1 truncate bg-transparent text-xs text-[#F3EFE6]/80 outline-none"
          />
          <button
            onClick={copyLink}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-[#F3EFE6] px-3 py-1.5 text-xs font-medium text-[#14171B]"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-[#F3EFE6]/30">
          For security, the password isn't included in this link. Share the
          room password separately (e.g. over chat) with whoever you send
          this to.
        </p>
      </div>
    </>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div style={{ position: "fixed", bottom: 16, right: 16 }}>
      <div className="flex items-center gap-1 rounded-lg bg-black/60 p-1 text-white">
        <button
          onClick={onZoomOut}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={onReset}
          className="min-w-[48px] rounded px-2 py-1 text-xs hover:bg-white/10"
        >
          {zoom}%
        </button>
        <button
          onClick={onZoomIn}
          className="flex h-7 w-7 items-center justify-center rounded hover:bg-white/10"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}