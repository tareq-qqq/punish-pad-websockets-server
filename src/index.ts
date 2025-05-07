import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response, response } from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { Room } from "./types";
import admin from "firebase-admin";
import serviceAccount from "../punish-pad-firebase-admin-private-key.json" with {type: "json"};

dotenv.config();



// Basic express setup
const app = express();
app.use(cors());
app.use(bodyParser.json());
const server = http.createServer(app);

const rooms: Record<string, Room> = {};

const FRONTEND_URL = process.env.FRONTEND_URL;
console.log("front end url", FRONTEND_URL);
// Socket.IO server setup



admin.initializeApp({
	credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const io = new Server(server, {
	cors: {
		origin: ["https://admin.socket.io", FRONTEND_URL as string], // <-- Allow all origins for now. Set specific domains later!
		methods: ["GET", "POST"],
		credentials: true,
	},
});

// When a client connects
io.on("connection", (socket: Socket) => {
	// Example: when a client sends a message
	console.log("Client connected", socket.id);
	socket.on(
		"create-room",

		({ repetitions, phrase, ownerName, partnerName }, callback) => {
			const roomId = createRoom(
				socket,
				phrase,
				parseInt(repetitions),
				ownerName,
				partnerName
			);
			socket.join(roomId);
			console.log(rooms[roomId]);
			callback({ room: rooms[roomId] });
		}
	);

	socket.on("punishment-message", (roomId: string, message: string) => {
		console.log(message);
		socket.to(roomId).emit("punishment-message", roomId, message);
	});

	socket.on(
		"join-room",
		(
			roomId: string,
			callback: ({ room, error }: { room?: Room; error?: string }) => void
		) => {
			if (!rooms[roomId]) {
				callback({ error: "Room not found" });
				return;
			}
			// jon the room
			socket.join(roomId);

			// emit that you joined the room
			socket.to(roomId).emit("joined-room", roomId, socket.id);

			console.log("Joined room", roomId, socket.id);
			console.log(rooms[roomId]);

			//acknowledge
			callback({ room: rooms[roomId] });
		}
	);
	// Handle disconnection

	// don't allow the same browser to join the same room twice
	socket.on("typing", (roomId: string, text: string) => {
		if (rooms[roomId]) {
			rooms[roomId].currentPhrase = text;
			console.log("'" + rooms[roomId].currentPhrase + "'");
		}
		socket.to(roomId).emit("typing", text);
	});

	socket.on("submit-phrase", async (roomId: string, phrase: string, date: Date) => {
		console.log("submit-phrase", phrase, roomId);
		const room = rooms[roomId];
		let correct = false;
		if (room) {
			if (phrase.trim() === room.phrase) {
				room.hits++;
				correct = true;
			} else {
				room.misses++;
			}
			console.log(room.hits);

			console.log("phrase-submitted", phrase, roomId, room.phrase);
			io.to(roomId).emit("phrase-submitted", room.hits, room.misses);
			room.messages.push({
				id: Math.random().toString(36).substring(2, 8),
				content: phrase,
				createdAt: date,
				correct,
			});
			io.to(roomId).emit("message-added", room.messages);

			console.log(typeof room.hits, typeof room.repetition);

			if (room.hits === room.repetition) {
				console.log("finished");
				room.status = "finished";
				io.to(roomId).emit("room-finished", roomId);

				const res = await admin.messaging().sendEachForMulticast({
					tokens: room.tokens,
					webpush: {
						fcmOptions: {
							link: `${FRONTEND_URL}/room/${roomId}`,
						},
					},
					notification: {
						title: "Punish Pad - room finished",
						body: `${room.partnerName} has finished their punishment.`,
					},
				});

				console.log(res.responses[0].error?.message)
			}
		}
	});

	socket.on("disconnect", (reason) => {
		console.log(`❌ Client disconnected: ${socket.id} (${reason})`);
	});
});

app.post("/send-token", (req: Request, res: Response) => {
	const { token, roomId } = req.body;
	if (!roomId) {
		res.send({ message: "Room id is required" }).status(400);
		return;
	}
	if (!rooms[roomId]) {
		res.send({ message: "Room not found" }).status(404);
		return;
	}
	if (!rooms[roomId].tokens.includes(token)) {
		rooms[roomId].tokens.push(token);
	}
	console.log(rooms[roomId].tokens);
	res.send({ message: "success" });
});

// Start server
const PORT = process.env.PORT;
console.log("port", PORT);

// instrument(io, {
// 	auth: false,
// 	mode: "development",
// });

server.listen(PORT, () => {
	console.log(`🚀 Server listening on port ${PORT}`);
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
		phrase: phrase.trim(),
		repetition,
		ownerName,
		partnerName,
		createdBy: socket.id,
		hits: 0,
		misses: 0,
		currentPhrase: "",
		roomId,
		status: "playing",
		messages: [],
		tokens: [],
	};
	return roomId;
}
