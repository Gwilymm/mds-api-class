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
app.use('/api/users', (req, res) => {
	res.json(users);
});

// Route racine
app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// WebSocket pour les mises à jour en temps réel
wss.on('connection', (ws) => {
	console.log('Client connected');

	// Envoyer les positions actuelles à chaque nouveau client
	ws.send(JSON.stringify(users));

	ws.on('message', (message) => {
		const data = JSON.parse(message);
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
		}

		// Diffuser les nouvelles positions à tous les clients connectés
		wss.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(users));
			}
		});
	});

	ws.on('close', () => {
		console.log('Client disconnected');
		users = users.filter(user => user.ws !== ws);

		// Diffuser la nouvelle liste d'utilisateurs à tous les clients connectés
		wss.clients.forEach(client => {
			if (client.readyState === WebSocket.OPEN) {
				client.send(JSON.stringify(users));
			}
		});
	});
});

const port = 3000;
server.listen(port, () => {
	console.log(`Server is running`);
});
