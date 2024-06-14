const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = []; // Initialize the list of users
let rooms = []; // Initialize the list of rooms

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/users', (req, res) => {
	res.json(users.map(user => ({ id: user.id, position: user.position, name: user.name })));
});

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
	ws.on('message', async (message) => {
		let data;
		try {
			data = JSON.parse(message);
		} catch (error) {
			console.error('Invalid JSON:', error);
			return;
		}

		switch (data.type) {
			case 'update':
				handleUpdate(ws, data);
				break;
			case 'disconnect':
				handleDisconnect(ws);
				break;
			case 'create_room':
				createRoom(data.roomId, ws);
				break;
			case 'join_room':
				joinRoom(data.roomId, ws);
				break;
			case 'invite_to_call':
			case 'webrtc_offer':
			case 'wejsc_answer':
			case 'webrtc_ice_candidate':
				console.log(`Forwarding ${data.type} to peer in room ${data.roomId}`);
				forwardToPeer(data.roomId, ws, data);
				break;
		}
	});

	ws.on('close', () => {
		handleDisconnect(ws);
	});

	ws.on('error', (error) => {
		console.error('WebSocket error:', error);
	});
});

function createRoom(roomId, userWs) {
	const roomExists = rooms.find(r => r.id === roomId);
	if (!roomExists) {
		const newRoom = { id: roomId, users: [ userWs ] };
		rooms.push(newRoom);
		console.log(`Room created with ID: ${roomId}`);
	} else {
		console.error(`Attempted to create a room that already exists with ID: ${roomId}`);
	}
}

function joinRoom(roomId, userWs) {
	let room = rooms.find(r => r.id === roomId);
	console.log(`User joined room with ID: ${roomId}`);
	if (!room) {
		console.error(`No room found with ID: ${roomId}. Creating room.`);
		createRoom(roomId, userWs);
		room = rooms.find(r => r.id === roomId);
	}
	room.users.push({ ws: userWs });
}

function handleUpdate(ws, data) {
	const user = users.find(u => u.id === data.id);
	if (user) {
		user.position = data.position;
		broadcastUserPositions();
	} else {
		users.push({ ws, id: data.id, name: data.name, position: data.position });
		broadcastUserPositions();
	}
}

function broadcastUserPositions() {
	const positions = users.map(user => ({ id: user.id, name: user.name, position: user.position }));
	users.forEach(user => {
		if (user.ws && user.ws.readyState === WebSocket.OPEN) {
			user.ws.send(JSON.stringify({ type: 'update_positions', positions }));
		}
	});
}

function forwardToPeer(roomId, ws, data) {
	const room = rooms.find(r => r.id === roomId);
	if (!room) {
		console.error(`Room not found with ID: ${roomId}`);
		ws.send(JSON.stringify({ type: 'notification', message: 'Room not found' }));
		return;
	}

	const otherUsers = room.users.filter(user => user.ws !== ws);
	otherUsers.forEach(user => {
		if (user.ws && user.ws.readyState === WebSocket.OPEN) {
			user.ws.send(JSON.stringify(data));
		}
	});
}

function handleDisconnect(ws) {
	users = users.filter(user => user.ws !== ws);
	broadcastUserPositions();
}

const port = 3000;
server.listen(port, () => {
	console.log(`Server is running on port ${1986}`);
});

