"use client";

import { useEffect, useRef, useState } from "react";
import { IconButton } from "./IconButton";
import { Circle, MousePointer2, Pencil, RectangleHorizontalIcon, Minus, Plus } from "lucide-react";
import { Game } from "@/draw/Game";

export type Tool = "circle" | "rect" | "pencil" | "select";

export function Canvas({
  roomId,
  socket,
}: {
  socket: WebSocket;
  roomId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<Game>();
  const [selectedTool, setSelectedTool] = useState<Tool>("select");
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);

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
      g.onViewportChange = (scale) => setZoom(scale);
      setGame(g);

      return () => {
        g.destroy();
      };
    }
  }, [canvasRef, roomId, socket]);

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ cursor: selectedTool === "select" ? "default" : "crosshair" }}
      ></canvas>
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