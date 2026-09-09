import { HTTP_BACKEND } from "@/config";
import axios from "axios";
import type { Shape } from "./Game";

type Envelope =
  | { op: "add"; shape: Shape }
  | { op: "update"; shape: Shape }
  | { op: "delete"; id: string }
  | { shape: Shape }; // legacy format from before select/move existed

export async function getExistingShapes(roomId: string): Promise<Shape[]> {
  const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
  const messages = res.data.messages as { message: string }[];

  // messages come back newest-first; replay oldest-first to rebuild final state
  const chronological = [...messages].reverse();

  const shapeMap = new Map<string, Shape>();

  for (const m of chronological) {
    let envelope: Envelope;
    try {
      envelope = JSON.parse(m.message);
    } catch {
      continue;
    }

    if ("op" in envelope) {
      if (envelope.op === "add" || envelope.op === "update") {
        shapeMap.set(envelope.shape.id, envelope.shape);
      } else if (envelope.op === "delete") {
        shapeMap.delete(envelope.id);
      }
    } else if (envelope.shape) {
      // legacy shape with no id — give it one so it can still be selected/deleted
      const legacyShape = envelope.shape as Shape;
      const id = legacyShape.id || `legacy-${shapeMap.size}-${Math.random()}`;
      shapeMap.set(id, { ...legacyShape, id });
    }
  }

  return Array.from(shapeMap.values());
}