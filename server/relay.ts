import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { WebSocketServer, type WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 3000);
const DIST_DIR = join(import.meta.dirname, "..", "dist");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

async function serveStatic(requestPath: string): Promise<{ body: Buffer; contentType: string } | null> {
  const relativePath = requestPath === "/" ? "index.html" : requestPath.slice(1);
  const filePath = join(DIST_DIR, relativePath);
  if (!filePath.startsWith(DIST_DIR)) return null;

  try {
    const body = await readFile(filePath);
    const contentType = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
    return { body, contentType };
  } catch {
    try {
      const body = await readFile(join(DIST_DIR, "index.html"));
      return { body, contentType: CONTENT_TYPES[".html"] };
    } catch {
      return null;
    }
  }
}

const httpServer = createServer((request, response) => {
  serveStatic(request.url ?? "/").then((file) => {
    if (!file) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": file.contentType }).end(file.body);
  });
});

const rooms = new Map<string, Set<WebSocket>>();

function roomFor(roomId: string): Set<WebSocket> {
  let sockets = rooms.get(roomId);
  if (!sockets) {
    sockets = new Set();
    rooms.set(roomId, sockets);
  }
  return sockets;
}

function leaveRoom(roomId: string, socket: WebSocket): void {
  const sockets = rooms.get(roomId);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) rooms.delete(roomId);
}

const wsServer = new WebSocketServer({ server: httpServer });

wsServer.on("connection", (socket) => {
  let joinedRoomId: string | null = null;

  socket.on("message", (data, isBinary) => {
    const raw = isBinary ? data : data.toString();

    if (!joinedRoomId) {
      const handshake = JSON.parse(raw.toString());
      if (handshake.type !== "join" || typeof handshake.room !== "string") {
        socket.close();
        return;
      }
      const room: string = handshake.room;
      joinedRoomId = room;
      roomFor(room).add(socket);
      return;
    }

    for (const peer of roomFor(joinedRoomId)) {
      if (peer !== socket && peer.readyState === peer.OPEN) {
        peer.send(raw);
      }
    }
  });

  socket.on("close", () => {
    if (joinedRoomId) leaveRoom(joinedRoomId, socket);
  });

  socket.on("error", () => {
    if (joinedRoomId) leaveRoom(joinedRoomId, socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
