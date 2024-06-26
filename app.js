/**
 * The above code sets up a WebSocket server using Express and WebSocket to handle real-time
 * communication between users, allowing them to update their positions and broadcast these updates to
 * other connected users.
 * @param ws - The `ws` parameter in the code represents a WebSocket connection. It is used to send and
 * receive messages between the server and connected clients in real-time. The WebSocket server (`wss`)
 * listens for incoming connections, and when a client connects, a WebSocket instance (`ws`) is created
 * for that client
 * @param data - The `data` parameter in the code represents the information sent over the WebSocket
 * connection. It is expected to be in JSON format and contains details such as the type of message
 * (update or disconnect), user ID, user name, and user position. The code parses this JSON data to
 * extract and process the
 */
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let users = []; // Initialize the list of users

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/users', (req, res) => {
	res.json(users.map(user => ({ id: user.id, position: user.position, name: user.name })));
});

app.get('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

wss.on('connection', (ws) => {
	ws.on('message', (message) => {
		let data;
		try {
			data = JSON.parse(message);
		} catch (error) {
			console.error('Invalid JSON:', error);
			return;
		}

		users.forEach(user => {
			if (user.ws !== ws && user.ws.readyState === WebSocket.OPEN) {
				user.ws.send(JSON.stringify(data));
			}
		});

		switch (data.type) {
			case 'update':
				handleUpdate(ws, data);
				break;
			case 'disconnect':
				handleDisconnect(ws);
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

function handleUpdate(ws, data) {
	const user = users.find(u => u.id === data.id);
	if (user) {
		user.position = data.position;
	} else {
		users.push({ ws, id: data.id, name: data.name, position: data.position });
	}
	broadcastUserPositions();
}

function handleDisconnect(ws) {
	users = users.filter(user => user.ws !== ws);
	broadcastUserPositions();
}

function broadcastUserPositions() {
	const positions = users.map(user => ({ id: user.id, name: user.name, position: user.position }));
	users.forEach(user => {
		if (user.ws.readyState === WebSocket.OPEN) {
			user.ws.send(JSON.stringify({ type: 'update_positions', positions }));
		}
	});
}

const port = 3000;
server.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
