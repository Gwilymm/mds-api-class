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
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// WebSocket pour les mises à jour en temps réel
wss.on('connection', (ws) => {
	let peerConnection; // Ajoutez cette ligne pour suivre les connexions de pairs

	ws.on('message', async (message) => {
		let data;
		try {
			data = JSON.parse(message);
		} catch (error) {
			console.error('Invalid JSON:', error);
			return;
		}

		if (data.type === 'update') {
			const user = users.find(u => u.id === data.id);
			if (user) {
				user.position = data.position;
				user.name = data.name;
			} else {
				users.push({ id: data.id, name: data.name, position: data.position, ws });
			}
		} else if (data.type === 'disconnect') {
			users = users.filter(user => user.id !== data.id);
		} else if (data.type === 'invite_to_call') {
			const targetUser = users.find(user => user.id === data.invitedUserId);
			if (targetUser) {
				const roomId = data.roomId;
				targetUser.ws.send(JSON.stringify({ type: 'invite_to_call', roomId, inviterId: data.inviterId }));
			}
		} else if (data.type === 'call_accepted') {
			const inviter = users.find(user => user.id === data.inviterId);
			if (inviter) {
				inviter.ws.send(JSON.stringify({ type: 'call_accepted', roomId: data.roomId }));
			}
		} else if (data.type === 'join_room') {
			const targetUser = users.find(user => user.id !== data.userId && user.ws.readyState === WebSocket.OPEN);
			if (targetUser) {
				peerConnection = new RTCPeerConnection({
					iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ],
				});

				peerConnection.onicecandidate = (event) => {
					if (event.candidate) {
						ws.send(JSON.stringify({
							type: 'webrtc_ice_candidate',
							targetId: data.userId,
							candidate: event.candidate,
						}));
					}
				};

				const offer = await peerConnection.createOffer();
				await peerConnection.setLocalDescription(offer);

				targetUser.ws.send(JSON.stringify({ type: 'webrtc_offer', roomId: data.roomId, inviterId: data.userId, offer: offer }));
			}
		} else if ([ 'webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate' ].includes(data.type)) {
			const targetUser = users.find(user => user.id === data.targetId);
			if (targetUser) {
				targetUser.ws.send(JSON.stringify(data));
			}
		}

		broadcastUserPositions();
	});

	ws.on('close', () => {
		users = users.filter(user => user.ws !== ws);
		broadcastUserPositions();
	});

	ws.on('error', (error) => {
		console.error('WebSocket error:', error);
	});
});

const broadcastUserPositions = () => {
	const usersWithoutWS = users.map(user => ({
		id: user.id,
		name: user.name,
		position: user.position
	}));

	wss.clients.forEach(client => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(usersWithoutWS));
		}
	});
};

const port = 3000;
server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
