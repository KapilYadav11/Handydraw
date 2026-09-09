import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import { WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";

const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket;
  rooms: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string") {
      return null;
    }

    if (!decoded || !(decoded as JwtPayload).userId) {
      return null;
    }

    return (decoded as JwtPayload).userId;
  } catch (e) {
    return null;
  }
}

wss.on("connection", function connection(ws, request) {
  const url = request.url;
  if (!url) {
    return;
  }

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);

  if (userId === null) {
    ws.close();
    return;
  }

  users.push({
    userId,
    rooms: [],
    ws,
  });

  ws.on("message", async function message(data) {
    let parsedData;
    try {
      parsedData =
        typeof data !== "string" ? JSON.parse(data.toString()) : JSON.parse(data);
    } catch (e) {
      return;
    }

    // {type: "join_room", roomId: "1"}
    if (parsedData.type === "join_room") {
      const user = users.find((x) => x.ws === ws);
      if (user && !user.rooms.includes(parsedData.roomId)) {
        user.rooms.push(parsedData.roomId);
      }
    }

    // {type: "leave_room", roomId: "1"}
    if (parsedData.type === "leave_room") {
      const user = users.find((x) => x.ws === ws);
      if (!user) {
        return;
      }
      user.rooms = user.rooms.filter((x) => x !== parsedData.roomId);
    }

    // {type: "chat", roomId: "1", message: "{...shape json...}"}
    if (parsedData.type === "chat") {
      const roomId = parsedData.roomId;
      const message = parsedData.message;

      try {
        await prismaClient.chat.create({
          data: {
            roomId: Number(roomId),
            message,
            userId,
          },
        });
      } catch (e) {
        console.error("Failed to persist chat/shape:", e);
      }

      users.forEach((user) => {
        if (user.rooms.includes(roomId)) {
          user.ws.send(
            JSON.stringify({
              type: "chat",
              message,
              roomId,
            })
          );
        }
      });
    }
  });

  ws.on("close", () => {
    const index = users.findIndex((u) => u.ws === ws);
    if (index !== -1) {
      users.splice(index, 1);
    }
  });
});

wss.on("listening", () => {
  console.log("WebSocket server running on port 8080");
});