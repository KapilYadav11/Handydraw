import { Tool } from "@/components/Canvas";
import { getExistingShapes } from "./http";

export type Shape =
  | {
      id: string;
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
    }
  | {
      id: string;
      type: "pencil";
      points: { x: number; y: number }[];
    }
  | {
      id: string;
      type: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      content: string;
    }
  | {
      id: string;
      type: "sticky";
      x: number;
      y: number;
      width: number;
      height: number;
      content: string;
      color: string;
    };

type Envelope =
  | { op: "add"; shape: Shape }
  | { op: "update"; shape: Shape }
  | { op: "delete"; id: string }
  | { shape: Shape };

type BBox = { x: number; y: number; width: number; height: number };
type HandleName = "tl" | "tr" | "bl" | "br";
type AnyHandle = HandleName | "start" | "end";

const HANDLE_SIZE = 9;
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;
const TEXT_FONT_SIZE = 20;
const STICKY_PALETTE = ["#FFE066", "#FF9F80", "#8ED1FC", "#B6F3B0", "#D6BBFC"];

type HistoryEntry =
  | { type: "add"; id: string }
  | { type: "delete"; shape: Shape }
  | { type: "update"; id: string; before: Shape; after: Shape };

export type EditRequest = {
  id: string | null;
  type: "text" | "sticky";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  color?: string;
};

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function pointInBBox(x: number, y: number, box: BBox, padding = 4) {
  return (
    x >= box.x - padding &&
    x <= box.x + box.width + padding &&
    y >= box.y - padding &&
    y <= box.y + box.height + padding
  );
}

function getHandlePositions(box: BBox): Record<HandleName, { x: number; y: number }> {
  return {
    tl: { x: box.x, y: box.y },
    tr: { x: box.x + box.width, y: box.y },
    bl: { x: box.x, y: box.y + box.height },
    br: { x: box.x + box.width, y: box.y + box.height },
  };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;
  const lenSq = C * C + D * D;
  let t = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
  t = Math.max(0, Math.min(1, t));
  const xx = x1 + t * C;
  const yy = y1 + t * D;
  return Math.hypot(px - xx, py - yy);
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private existingShapes: Shape[];
  private roomId: string;
  private clicked: boolean;
  private startX = 0;
  private startY = 0;
  private currentPencilPoints: { x: number; y: number }[] = [];
  private selectedTool: Tool = "select";

  private selectedId: string | null = null;
  private dragMode: "none" | "move" | "resize" | "pan" = "none";
  private activeHandle: AnyHandle | null = null;
  private dragStart = { x: 0, y: 0 };
  private shapeSnapshot: Shape | null = null;

  private offsetX = 0;
  private offsetY = 0;
  private scale = 1;
  private spacePressed = false;
  private panStart = { x: 0, y: 0 };
  private offsetStart = { x: 0, y: 0 };

  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  onViewportChange?: (scale: number) => void;
  onEditRequest?: (req: EditRequest) => void;

  socket: WebSocket;

  constructor(canvas: HTMLCanvasElement, roomId: string, socket: WebSocket) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.existingShapes = [];
    this.roomId = roomId;
    this.socket = socket;
    this.clicked = false;
    this.init();
    this.initHandlers();
    this.initMouseHandlers();
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    this.canvas.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  destroy() {
    this.canvas.removeEventListener("mousedown", this.mouseDownHandler);
    this.canvas.removeEventListener("mouseup", this.mouseUpHandler);
    this.canvas.removeEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.removeEventListener("dblclick", this.dblClickHandler);
    this.canvas.removeEventListener("wheel", this.wheelHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
  }

  setTool(tool: Tool) {
    this.selectedTool = tool;
    if (tool !== "select") {
      this.selectedId = null;
      this.clearCanvas();
    }
  }

  getZoomPercent(): number {
    return Math.round(this.scale * 100);
  }

  getTransform() {
    return { scale: this.scale, offsetX: this.offsetX, offsetY: this.offsetY };
  }

  zoomBy(factor: number, centerX?: number, centerY?: number) {
    const rect = this.canvas.getBoundingClientRect();
    const cx = centerX ?? rect.width / 2;
    const cy = centerY ?? rect.height / 2;
    const worldX = (cx - this.offsetX) / this.scale;
    const worldY = (cy - this.offsetY) / this.scale;
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, this.scale * factor));
    this.offsetX = cx - worldX * newScale;
    this.offsetY = cy - worldY * newScale;
    this.scale = newScale;
    this.onViewportChange?.(this.getZoomPercent());
    this.clearCanvas();
  }

  resetView() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.scale = 1;
    this.onViewportChange?.(this.getZoomPercent());
    this.clearCanvas();
  }

  private toWorld(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - this.offsetX) / this.scale,
      y: (sy - this.offsetY) / this.scale,
    };
  }

  async init() {
    try {
      this.existingShapes = await getExistingShapes(this.roomId);
    } catch (e) {
      console.error("Failed to load existing shapes", e);
      this.existingShapes = [];
    }
    this.clearCanvas();
  }

  private applyEnvelope(envelope: Envelope) {
    if ("op" in envelope) {
      if (envelope.op === "add") {
        if (!this.existingShapes.some((s) => s.id === envelope.shape.id)) {
          this.existingShapes.push(envelope.shape);
        }
      } else if (envelope.op === "update") {
        const idx = this.existingShapes.findIndex((s) => s.id === envelope.shape.id);
        if (idx !== -1) this.existingShapes[idx] = envelope.shape;
      } else if (envelope.op === "delete") {
        this.existingShapes = this.existingShapes.filter((s) => s.id !== envelope.id);
        if (this.selectedId === envelope.id) this.selectedId = null;
      }
    } else if (envelope.shape) {
      if (!this.existingShapes.some((s) => s.id === envelope.shape.id)) {
        this.existingShapes.push(envelope.shape);
      }
    }
  }

  initHandlers() {
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "chat") {
        try {
          const envelope = JSON.parse(message.message) as Envelope;
          this.applyEnvelope(envelope);
          this.clearCanvas();
        } catch (e) {
          console.error("Bad shape payload", e);
        }
      }
    };
  }

  clearCanvas() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = "rgba(0, 0, 0)";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);
    this.ctx.lineWidth = 2 / this.scale;

    this.existingShapes.forEach((shape) => this.drawShape(shape));

    if (this.selectedId) {
      const selected = this.existingShapes.find((s) => s.id === this.selectedId);
      if (selected) this.drawSelection(selected);
    }
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (this.ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private drawShape(shape: Shape) {
    this.ctx.strokeStyle = "rgba(255, 255, 255)";
    this.ctx.fillStyle = "rgba(255, 255, 255)";

    if (shape.type === "rect") {
      this.ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.type === "circle") {
      this.ctx.beginPath();
      this.ctx.arc(shape.centerX, shape.centerY, Math.abs(shape.radius), 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (shape.type === "pencil") {
      if (shape.points.length < 2) return;
      this.ctx.beginPath();
      this.ctx.moveTo(shape.points[0]!.x, shape.points[0]!.y);
      for (let i = 1; i < shape.points.length; i++) {
        this.ctx.lineTo(shape.points[i]!.x, shape.points[i]!.y);
      }
      this.ctx.stroke();
      this.ctx.closePath();
    } else if (shape.type === "arrow") {
      this.ctx.beginPath();
      this.ctx.moveTo(shape.x1, shape.y1);
      this.ctx.lineTo(shape.x2, shape.y2);
      this.ctx.stroke();

      const angle = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1);
      const headLen = 12 / this.scale;
      this.ctx.beginPath();
      this.ctx.moveTo(shape.x2, shape.y2);
      this.ctx.lineTo(
        shape.x2 - headLen * Math.cos(angle - Math.PI / 6),
        shape.y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      this.ctx.moveTo(shape.x2, shape.y2);
      this.ctx.lineTo(
        shape.x2 - headLen * Math.cos(angle + Math.PI / 6),
        shape.y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      this.ctx.stroke();
    } else if (shape.type === "text") {
      this.ctx.font = `${TEXT_FONT_SIZE}px 'Plus Jakarta Sans', sans-serif`;
      this.ctx.fillText(shape.content, shape.x, shape.y);
    } else if (shape.type === "sticky") {
      this.ctx.save();
      this.ctx.fillStyle = shape.color;
      const r = 8;
      this.ctx.beginPath();
      // @ts-ignore - roundRect is supported in modern browsers
      this.ctx.roundRect(shape.x, shape.y, Math.abs(shape.width), Math.abs(shape.height), r);
      this.ctx.fill();

      this.ctx.fillStyle = "#1E2530";
      this.ctx.font = `14px 'Plus Jakarta Sans', sans-serif`;
      const lines = this.wrapText(shape.content, Math.abs(shape.width) - 20);
      lines.forEach((line, i) => {
        this.ctx.fillText(line, shape.x + 10, shape.y + 24 + i * 18);
      });
      this.ctx.restore();
    }
  }

  private getBBox(shape: Shape): BBox {
    if (shape.type === "rect" || shape.type === "sticky") {
      return {
        x: Math.min(shape.x, shape.x + shape.width),
        y: Math.min(shape.y, shape.y + shape.height),
        width: Math.abs(shape.width),
        height: Math.abs(shape.height),
      };
    }
    if (shape.type === "circle") {
      return {
        x: shape.centerX - shape.radius,
        y: shape.centerY - shape.radius,
        width: shape.radius * 2,
        height: shape.radius * 2,
      };
    }
    if (shape.type === "arrow") {
      return {
        x: Math.min(shape.x1, shape.x2),
        y: Math.min(shape.y1, shape.y2),
        width: Math.abs(shape.x2 - shape.x1),
        height: Math.abs(shape.y2 - shape.y1),
      };
    }
    if (shape.type === "text") {
      this.ctx.font = `${TEXT_FONT_SIZE}px 'Plus Jakarta Sans', sans-serif`;
      const width = Math.max(this.ctx.measureText(shape.content || " ").width, 10);
      return { x: shape.x, y: shape.y - TEXT_FONT_SIZE, width, height: TEXT_FONT_SIZE + 6 };
    }
    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    return {
      x: minX,
      y: minY,
      width: Math.max(...xs) - minX,
      height: Math.max(...ys) - minY,
    };
  }

  private drawSelection(shape: Shape) {
    const box = this.getBBox(shape);
    const pad = 6 / this.scale;
    this.ctx.save();
    this.ctx.strokeStyle = "#3B5BFF";
    this.ctx.lineWidth = 1.5 / this.scale;
    this.ctx.setLineDash([5 / this.scale, 4 / this.scale]);
    this.ctx.strokeRect(box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2);
    this.ctx.setLineDash([]);

    const hs = HANDLE_SIZE / this.scale;
    this.ctx.fillStyle = "#3B5BFF";

    if (shape.type === "arrow") {
      this.ctx.fillRect(shape.x1 - hs / 2, shape.y1 - hs / 2, hs, hs);
      this.ctx.fillRect(shape.x2 - hs / 2, shape.y2 - hs / 2, hs, hs);
    } else if (shape.type !== "pencil" && shape.type !== "text") {
      const handles = getHandlePositions(box);
      Object.values(handles).forEach((h) => {
        this.ctx.fillRect(h.x - hs / 2, h.y - hs / 2, hs, hs);
      });
    }
    this.ctx.restore();
  }

  private hitTest(x: number, y: number): Shape | null {
    for (let i = this.existingShapes.length - 1; i >= 0; i--) {
      const shape = this.existingShapes[i]!;
      if (shape.type === "pencil") {
        const box = this.getBBox(shape);
        if (pointInBBox(x, y, box, 8 / this.scale)) return shape;
      } else if (shape.type === "circle") {
        const dist = Math.hypot(x - shape.centerX, y - shape.centerY);
        if (dist <= Math.abs(shape.radius) + 4 / this.scale) return shape;
      } else if (shape.type === "arrow") {
        if (distToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2) <= 6 / this.scale) return shape;
      } else {
        if (pointInBBox(x, y, this.getBBox(shape))) return shape;
      }
    }
    return null;
  }

  private hitTestHandle(x: number, y: number, shape: Shape): AnyHandle | null {
    if (shape.type === "pencil" || shape.type === "text") return null;

    const tolerance = HANDLE_SIZE / this.scale;

    if (shape.type === "arrow") {
      if (Math.hypot(x - shape.x1, y - shape.y1) <= tolerance) return "start";
      if (Math.hypot(x - shape.x2, y - shape.y2) <= tolerance) return "end";
      return null;
    }

    const handles = getHandlePositions(this.getBBox(shape));
    for (const [name, pos] of Object.entries(handles) as [HandleName, { x: number; y: number }][]) {
      if (Math.abs(x - pos.x) <= tolerance && Math.abs(y - pos.y) <= tolerance) {
        return name;
      }
    }
    return null;
  }

  private broadcast(envelope: Envelope) {
    this.socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify(envelope),
        roomId: this.roomId,
      })
    );
  }

  private pushHistory(entry: HistoryEntry) {
    this.undoStack.push(entry);
    this.redoStack = [];
  }

  private sendNewShape(shape: Shape) {
    this.existingShapes.push(shape);
    this.broadcast({ op: "add", shape });
    this.pushHistory({ type: "add", id: shape.id });
    this.clearCanvas();
  }

  commitEdit(
    id: string | null,
    type: "text" | "sticky",
    x: number,
    y: number,
    width: number,
    height: number,
    content: string,
    color?: string
  ) {
    if (id) {
      const idx = this.existingShapes.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const before = JSON.parse(JSON.stringify(this.existingShapes[idx])) as Shape;

      if (!content.trim()) {
        this.existingShapes = this.existingShapes.filter((s) => s.id !== id);
        this.selectedId = null;
        this.broadcast({ op: "delete", id });
        this.pushHistory({ type: "delete", shape: before });
      } else {
        const updated = { ...this.existingShapes[idx], content } as Shape;
        this.existingShapes[idx] = updated;
        this.broadcast({ op: "update", shape: updated });
        this.pushHistory({
          type: "update",
          id,
          before,
          after: JSON.parse(JSON.stringify(updated)),
        });
      }
    } else {
      if (!content.trim()) {
        this.clearCanvas();
        return;
      }
      const shape: Shape =
        type === "text"
          ? { id: genId(), type: "text", x, y, content }
          : {
              id: genId(),
              type: "sticky",
              x,
              y,
              width,
              height,
              content,
              color: color || STICKY_PALETTE[0]!,
            };
      this.sendNewShape(shape);
      return;
    }
    this.clearCanvas();
  }

  private deleteSelected() {
    if (!this.selectedId) return;
    const id = this.selectedId;
    const shape = this.existingShapes.find((s) => s.id === id);
    if (!shape) return;
    this.existingShapes = this.existingShapes.filter((s) => s.id !== id);
    this.selectedId = null;
    this.broadcast({ op: "delete", id });
    this.pushHistory({ type: "delete", shape });
    this.clearCanvas();
  }

  private undo() {
    const entry = this.undoStack.pop();
    if (!entry) return;

    if (entry.type === "add") {
      const shape = this.existingShapes.find((s) => s.id === entry.id);
      this.existingShapes = this.existingShapes.filter((s) => s.id !== entry.id);
      this.broadcast({ op: "delete", id: entry.id });
      if (shape) this.redoStack.push({ type: "delete", shape });
    } else if (entry.type === "delete") {
      this.existingShapes.push(entry.shape);
      this.broadcast({ op: "add", shape: entry.shape });
      this.redoStack.push({ type: "add", id: entry.shape.id });
    } else if (entry.type === "update") {
      const idx = this.existingShapes.findIndex((s) => s.id === entry.id);
      if (idx !== -1) this.existingShapes[idx] = entry.before;
      this.broadcast({ op: "update", shape: entry.before });
      this.redoStack.push({
        type: "update",
        id: entry.id,
        before: entry.after,
        after: entry.before,
      });
    }

    this.selectedId = null;
    this.clearCanvas();
  }

  private redo() {
    const entry = this.redoStack.pop();
    if (!entry) return;

    if (entry.type === "add") {
      const shape = this.existingShapes.find((s) => s.id === entry.id);
      this.existingShapes = this.existingShapes.filter((s) => s.id !== entry.id);
      this.broadcast({ op: "delete", id: entry.id });
      if (shape) this.undoStack.push({ type: "delete", shape });
    } else if (entry.type === "delete") {
      this.existingShapes.push(entry.shape);
      this.broadcast({ op: "add", shape: entry.shape });
      this.undoStack.push({ type: "add", id: entry.shape.id });
    } else if (entry.type === "update") {
      const idx = this.existingShapes.findIndex((s) => s.id === entry.id);
      if (idx !== -1) this.existingShapes[idx] = entry.before;
      this.broadcast({ op: "update", shape: entry.before });
      this.undoStack.push({
        type: "update",
        id: entry.id,
        before: entry.after,
        after: entry.before,
      });
    }

    this.selectedId = null;
    this.clearCanvas();
  }

  keyDownHandler = (e: KeyboardEvent) => {
    const active = document.activeElement;
    const isTyping =
      active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
    if (isTyping) return;

    if (e.code === "Space") {
      this.spacePressed = true;
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }
    if (
      ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
      ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")
    ) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (this.selectedTool === "select" && this.selectedId && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      this.deleteSelected();
    }
  };

  keyUpHandler = (e: KeyboardEvent) => {
    if (e.code === "Space") this.spacePressed = false;
  };

  wheelHandler = (e: WheelEvent) => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      this.zoomBy(factor, cx, cy);
    } else {
      this.offsetX -= e.deltaX;
      this.offsetY -= e.deltaY;
      this.clearCanvas();
    }
  };

  dblClickHandler = (e: MouseEvent) => {
    if (this.selectedTool !== "select") return;
    const { x, y } = this.toWorld(e.clientX, e.clientY);
    const hit = this.hitTest(x, y);
    if (hit && (hit.type === "text" || hit.type === "sticky")) {
      this.onEditRequest?.({
        id: hit.id,
        type: hit.type,
        x: hit.x,
        y: hit.y,
        width: hit.type === "sticky" ? hit.width : 220,
        height: hit.type === "sticky" ? hit.height : 30,
        content: hit.content,
        color: hit.type === "sticky" ? hit.color : undefined,
      });
    }
  };

  mouseDownHandler = (e: MouseEvent) => {
    if (this.spacePressed || e.button === 1) {
      this.dragMode = "pan";
      this.panStart = { x: e.clientX, y: e.clientY };
      this.offsetStart = { x: this.offsetX, y: this.offsetY };
      return;
    }

    const { x, y } = this.toWorld(e.clientX, e.clientY);

    if (this.selectedTool === "select") {
      const selectedShape = this.existingShapes.find((s) => s.id === this.selectedId);

      if (selectedShape) {
        const handle = this.hitTestHandle(x, y, selectedShape);
        if (handle) {
          this.dragMode = "resize";
          this.activeHandle = handle;
          this.dragStart = { x, y };
          this.shapeSnapshot = JSON.parse(JSON.stringify(selectedShape));
          return;
        }
      }

      const hit = this.hitTest(x, y);
      if (hit) {
        this.selectedId = hit.id;
        this.dragMode = "move";
        this.dragStart = { x, y };
        this.shapeSnapshot = JSON.parse(JSON.stringify(hit));
      } else {
        this.selectedId = null;
        this.dragMode = "none";
      }
      this.clearCanvas();
      return;
    }

    if (this.selectedTool === "text") {
      this.onEditRequest?.({ id: null, type: "text", x, y, width: 220, height: 30, content: "" });
      return;
    }

    if (this.selectedTool === "sticky") {
      const color = STICKY_PALETTE[Math.floor(Math.random() * STICKY_PALETTE.length)]!;
      this.onEditRequest?.({
        id: null,
        type: "sticky",
        x,
        y,
        width: 200,
        height: 150,
        content: "",
        color,
      });
      return;
    }

    this.clicked = true;
    this.startX = x;
    this.startY = y;

    if (this.selectedTool === "pencil") {
      this.currentPencilPoints = [{ x, y }];
    }
  };

  mouseMoveHandler = (e: MouseEvent) => {
    if (this.dragMode === "pan") {
      this.offsetX = this.offsetStart.x + (e.clientX - this.panStart.x);
      this.offsetY = this.offsetStart.y + (e.clientY - this.panStart.y);
      this.clearCanvas();
      return;
    }

    const { x: currentX, y: currentY } = this.toWorld(e.clientX, e.clientY);

    if (this.selectedTool === "select") {
      if (this.dragMode === "none" || !this.shapeSnapshot || !this.selectedId) return;
      const dx = currentX - this.dragStart.x;
      const dy = currentY - this.dragStart.y;
      const idx = this.existingShapes.findIndex((s) => s.id === this.selectedId);
      if (idx === -1) return;

      if (this.dragMode === "move") {
        const snap = this.shapeSnapshot;
        if (snap.type === "rect" || snap.type === "sticky" || snap.type === "text") {
          this.existingShapes[idx] = { ...snap, x: snap.x + dx, y: snap.y + dy };
        } else if (snap.type === "circle") {
          this.existingShapes[idx] = {
            ...snap,
            centerX: snap.centerX + dx,
            centerY: snap.centerY + dy,
          };
        } else if (snap.type === "arrow") {
          this.existingShapes[idx] = {
            ...snap,
            x1: snap.x1 + dx,
            y1: snap.y1 + dy,
            x2: snap.x2 + dx,
            y2: snap.y2 + dy,
          };
        } else {
          this.existingShapes[idx] = {
            ...snap,
            points: snap.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          };
        }
      } else if (this.dragMode === "resize" && this.activeHandle) {
        const snap = this.shapeSnapshot;

        if (snap.type === "arrow") {
          if (this.activeHandle === "start") {
            this.existingShapes[idx] = { ...snap, x1: currentX, y1: currentY };
          } else if (this.activeHandle === "end") {
            this.existingShapes[idx] = { ...snap, x2: currentX, y2: currentY };
          }
        } else if (snap.type === "rect" || snap.type === "sticky" || snap.type === "circle") {
          const box = this.getBBox(snap);
          const handleKey = this.activeHandle as HandleName;
          const anchor = {
            tl: { x: box.x + box.width, y: box.y + box.height },
            tr: { x: box.x, y: box.y + box.height },
            bl: { x: box.x + box.width, y: box.y },
            br: { x: box.x, y: box.y },
          }[handleKey];

          const newX = Math.min(anchor.x, currentX);
          const newY = Math.min(anchor.y, currentY);
          const newWidth = currentX - anchor.x;
          const newHeight = currentY - anchor.y;

          if (snap.type === "circle") {
            const radius = Math.max(Math.abs(newWidth), Math.abs(newHeight)) / 2;
            this.existingShapes[idx] = {
              ...snap,
              centerX: anchor.x + (currentX - anchor.x) / 2,
              centerY: anchor.y + (currentY - anchor.y) / 2,
              radius,
            };
          } else {
            this.existingShapes[idx] = {
              ...snap,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          }
        }
      }

      this.clearCanvas();
      return;
    }

    if (!this.clicked) return;

    if (this.selectedTool === "pencil") {
      this.currentPencilPoints.push({ x: currentX, y: currentY });
      this.clearCanvas();
      this.drawShape({ id: "preview", type: "pencil", points: this.currentPencilPoints });
      return;
    }

    this.clearCanvas();
    this.ctx.strokeStyle = "rgba(255, 255, 255)";

    if (this.selectedTool === "arrow") {
      this.ctx.beginPath();
      this.ctx.moveTo(this.startX, this.startY);
      this.ctx.lineTo(currentX, currentY);
      this.ctx.stroke();
      return;
    }

    const width = currentX - this.startX;
    const height = currentY - this.startY;

    if (this.selectedTool === "rect") {
      this.ctx.strokeRect(this.startX, this.startY, width, height);
    } else if (this.selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      const centerX = this.startX + (width < 0 ? -radius : radius);
      const centerY = this.startY + (height < 0 ? -radius : radius);
      this.ctx.beginPath();
      this.ctx.arc(centerX, centerY, Math.abs(radius), 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.closePath();
    }
  };

  mouseUpHandler = (e: MouseEvent) => {
    if (this.dragMode === "pan") {
      this.dragMode = "none";
      return;
    }

    if (this.selectedTool === "select") {
      if (this.dragMode !== "none" && this.selectedId && this.shapeSnapshot) {
        const shape = this.existingShapes.find((s) => s.id === this.selectedId);
        if (shape) {
          this.broadcast({ op: "update", shape });
          this.pushHistory({
            type: "update",
            id: shape.id,
            before: this.shapeSnapshot,
            after: JSON.parse(JSON.stringify(shape)),
          });
        }
      }
      this.dragMode = "none";
      this.activeHandle = null;
      this.shapeSnapshot = null;
      return;
    }

    if (!this.clicked) return;
    this.clicked = false;

    const { x: currentX, y: currentY } = this.toWorld(e.clientX, e.clientY);

    const width = currentX - this.startX;
    const height = currentY - this.startY;

    let shape: Shape | null = null;

    if (this.selectedTool === "rect") {
      shape = { id: genId(), type: "rect", x: this.startX, y: this.startY, width, height };
    } else if (this.selectedTool === "circle") {
      const radius = Math.max(Math.abs(width), Math.abs(height)) / 2;
      shape = {
        id: genId(),
        type: "circle",
        radius,
        centerX: this.startX + (width < 0 ? -radius : radius),
        centerY: this.startY + (height < 0 ? -radius : radius),
      };
    } else if (this.selectedTool === "arrow") {
      const dist = Math.hypot(width, height);
      if (dist > 4) {
        shape = { id: genId(), type: "arrow", x1: this.startX, y1: this.startY, x2: currentX, y2: currentY };
      }
    } else if (this.selectedTool === "pencil") {
      this.currentPencilPoints.push({ x: currentX, y: currentY });
      if (this.currentPencilPoints.length >= 2) {
        shape = { id: genId(), type: "pencil", points: this.currentPencilPoints };
      }
      this.currentPencilPoints = [];
    }

    if (!shape) {
      this.clearCanvas();
      return;
    }
    this.sendNewShape(shape);
  };

  initMouseHandlers() {
    this.canvas.addEventListener("mousedown", this.mouseDownHandler);
    this.canvas.addEventListener("mouseup", this.mouseUpHandler);
    this.canvas.addEventListener("mousemove", this.mouseMoveHandler);
    this.canvas.addEventListener("dblclick", this.dblClickHandler);
  }
}