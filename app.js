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
		console.log('Message received from client:', data);

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
		} else if (data.type === 'invite') {
			const targetUser = users.find(user => user.id === data.to);
			if (targetUser) {
				targetUser.ws.send(JSON.stringify(data));
			}
		} else if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
			const targetUser = users.find(user => user.id === data.to);
			if (targetUser) {
				targetUser.ws.send(JSON.stringify(data));
			}
		}

		// Diffuser les nouvelles positions à tous les clients connectés
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
	});

	ws.on('close', () => {
		users = users.filter(user => user.ws !== ws);

		// Diffuser les nouvelles positions à tous les clients connectés
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
	});
});
const port = 3000;
server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
