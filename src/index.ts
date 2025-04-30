import { Socket } from "socket.io";

import express from "express";
import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
import cors from "cors";
import { Room } from "./types";

// Basic express setup
const app = express();
app.use(cors());
const server = http.createServer(app);

const rooms: Record<string, Room> = {};

// Socket.IO server setup
const io = new Server(server, {
	cors: {
		origin: ["http://localhost:3000", "https://admin.socket.io"], // <-- Allow all origins for now. Set specific domains later!  // methods: ["GET", "POST"],
		credentials: true,
	},
});

// When a client connects
io.on("connection", (socket: Socket) => {
	// Example: when a client sends a message
	console.log("Client connected", socket.id);
	socket.on(
		"createRoom",
		({ repetition, phrase, ownerName, partnerName }, callback) => {
			const roomId = createRoom(
				socket,
				phrase,
				repetition,
				ownerName,
				partnerName
			);
			callback(roomId);
		}
	);

	socket.on(
		"joinRoom",
		(
			roomId: string,
			callback: ({ room, error }: { room?: Room; error?: string }) => void
		) => {
			if (!rooms[roomId]) {
				callback({ error: "Room not found" });
				return;
			}
			socket.join(roomId);
			socket.broadcast.emit("joined-room", roomId, socket.id);
			console.log("Joined room", roomId, socket.id);
			callback({ room: rooms[roomId] });
		}
	);
	// Handle disconnection

	socket.on("typing", (roomId: string, text: string) => {
		rooms[roomId].currentPhrase = text;
		socket.to(roomId).emit("typing", text);
	});

	socket.on("disconnect", (reason) => {
		console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
	});
});

// Start server
const PORT = process.env.PORT || 3001;

instrument(io, {
	auth: false,
	mode: "development",
});

server.listen(PORT, () => {
	console.log(`🚀 Server listening on http://localhost:${PORT}`);
});

function createRoom(
	socket: Socket,
	phrase: string,
	repetition: number,
	ownerName: string,
	partnerName: string
) {
	const roomId = Math.random().toString(36).substring(2, 8);
	rooms[roomId] = {
		phrase,
		repetition,
		ownerName,
		partnerName,
		createdBy: socket.id,
		hits: 0,
		misses: 0,
		currentPhrase: "",
	};
	return roomId;
}
