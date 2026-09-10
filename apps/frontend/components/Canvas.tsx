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
} from "lucide-react";
import { Game, EditRequest } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "select" | "arrow" | "text" | "sticky";

type EditingState = EditRequest & {
  screenX: number;
  screenY: number;
};

export function Canvas({
  roomId,
  socket,
}: {
  socket: WebSocket;
  roomId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | undefined>(undefined);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);
  const [editing, setEditing] = useState<EditingState | null>(null);

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
      g.onEditRequest = (req) => {
        const t = g.getTransform();
        const screenX = req.x * t.scale + t.offsetX;
        const screenY = req.y * t.scale + t.offsetY - (req.type === "text" ? 22 : 0);
        setEditing({ ...req, screenX, screenY });
      };

      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [canvasRef, roomId, socket]);

  function commitEditing() {
    if (!editing || !gameRef.current) return;
    gameRef.current.commitEdit(
      editing.id,
      editing.type,
      editing.x,
      editing.y,
      editing.width,
      editing.height,
      editing.content,
      editing.color
    );
    setEditing(null);
    setSelectedTool("select");
  }

  function cancelEditing() {
    setEditing(null);
    setSelectedTool("select");
  }

  return (
    <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: selectedTool === "select" ? "default" : "crosshair" }}
      ></canvas>

      {editing && (
        <div style={{ position: "fixed", left: editing.screenX, top: editing.screenY, zIndex: 50 }}>
          {editing.type === "text" ? (
            <input
              autoFocus
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEditing();
                if (e.key === "Escape") cancelEditing();
              }}
              onBlur={commitEditing}
              placeholder="Type something..."
              className="min-w-[180px] border-b border-white/50 bg-transparent text-lg text-white outline-none placeholder:text-white/30"
            />
          ) : (
            <textarea
              autoFocus
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancelEditing();
              }}
              onBlur={commitEditing}
              placeholder="Note..."
              style={{
                width: editing.width,
                height: editing.height,
                backgroundColor: editing.color,
              }}
              className="resize-none rounded-lg p-2.5 text-sm text-[#1E2530] shadow-lg outline-none placeholder:text-[#1E2530]/40"
            />
          )}
        </div>
      )}

      <Topbar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
      <ZoomControls
        zoom={zoom}
        onZoomIn={() => game?.zoomBy(1.2)}
        onZoomOut={() => game?.zoomBy(1 / 1.2)}
        onReset={() => game?.resetView()}
      />
    </div>
  );
}

function Topbar({
  selectedTool,
  setSelectedTool,
}: {
  selectedTool: Tool;
  setSelectedTool: (s: Tool) => void;
}) {
  return (
    <div style={{ position: "fixed", top: 10, left: 10 }}>
      <div className="flex gap-1 bg-black/60 p-1 rounded-lg">
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
