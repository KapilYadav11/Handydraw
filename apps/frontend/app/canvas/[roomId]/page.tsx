import { RoomGate } from "@/components/RoomGate";

export default async function CanvasPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <RoomGate roomId={roomId} />;
}