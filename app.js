const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');
let users = []; // Initialiser la liste des utilisateurs

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// API RESTful pour les utilisateurs
app.get('/api/users', (req, res) => {
	res.json(users);
});

// Route racine
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// WebSocket pour les mises à jour en temps réel
wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		const data = JSON.parse(message);

		if (data.type === 'invite') {
			const targetUser = users.find(user => user.id === data.to);
			if (targetUser) {
				const roomId = `room-${Date.now()}`;
				ws.roomId = roomId; // Assign roomId to the sender
				ws.send(JSON.stringify({ type: 'room-created', roomId }));
				targetUser.ws.roomId = roomId; // Assign roomId to the target
				targetUser.ws.send(JSON.stringify({ type: 'invite', from: data.from, roomId }));
			}
		} else if (data.type === 'join-room') {
			const roomId = data.roomId;
			ws.roomId = roomId;  // Assign the roomId to the WebSocket connection
			ws.send(JSON.stringify({ type: 'user-connected', roomId }));
		} else if ([ 'offer', 'answer', 'candidate' ].includes(data.type)) {
			// Relay the offer, answer, or candidate to the other participant in the same room
			users.filter(user => user.ws.roomId === ws.roomId && user.ws !== ws).forEach(user => {
				user.ws.send(JSON.stringify(data));
			});
		}
	});

	ws.on('close', () => {
		users = users.filter(user => user.ws !== ws);
	});
});


const port = 3000;
server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
