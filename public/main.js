let userId = null;
let username = null;
let ws = null;
let peerConnection = null;
let iceCandidatesQueue = [];

const configuration = {
	iceServers: [
		{ urls: 'stun:stun.l.google.com:19302' },
		{ urls: 'stun:stun1.l.google.com:19302' },
		{ urls: 'stun:stun2.l.google.com:19302' },
		{ urls: 'stun:stun3.l.google.com:19302' },
		{ urls: 'stun:stun4.l.google.com:19302' },
	],
};
L.Icon.Default.imagePath = "https://unpkg.com/leaflet@1.7.1/dist/images/";
const map = L.map("map").setView([ 51.505, -0.09 ], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
	maxZoom: 19,
}).addTo(map);

const markers = {};

const updateUserPositions = (users) => {
	if (!Array.isArray(users)) {
		console.error("La réponse de l'API n'est pas un tableau d'utilisateurs:", users);
		return;
	}
	const userList = document.getElementById("user-list-ul");
	userList.innerHTML = ""; // Clear the list
	users.forEach((user) => {
		if (markers[ user.id ]) {
			markers[ user.id ].setLatLng([ user.position.lat, user.position.lng ]);
		} else {
			markers[ user.id ] = L.marker([ user.position.lat, user.position.lng ])
				.addTo(map)
				.bindPopup(user.name)
				.openPopup();
		}
		// Add user to the list
		const li = document.createElement("li");
		li.className = "flex justify-between items-center p-2 bg-gray-100 rounded shadow";
		li.innerHTML = `<span>${user.name}</span> <button onclick="inviteToVideoCall('${user.id}')" class="bg-green-500 text-white px-2 py-1 rounded">Visio</button>`;
		userList.appendChild(li);
	});
};

const fetchUserPositions = async () => {
	try {
		const response = await fetch("/api/users");
		if (!response.ok) {
			throw new Error("Erreur lors de la récupération des utilisateurs: " + response.statusText);
		}
		const text = await response.text(); // Lire la réponse en tant que texte
		const users = JSON.parse(text); // Convertir le texte en JSON

		updateUserPositions(users);
	} catch (error) {
		console.error("Erreur lors de la récupération des utilisateurs:", error);
	}
};

const sendUserPosition = (position) => {
	if (ws && ws.readyState === WebSocket.OPEN) {
		const data = {
			id: userId,
			name: username,
			position: {
				lat: position.coords.latitude,
				lng: position.coords.longitude,
			},
			type: "update",
		};
		ws.send(JSON.stringify(data));
	} else {
		console.warn("WebSocket is not open. Cannot send position.");
	}
};

const updateUserPosition = (position) => {
	if (ws && ws.readyState === WebSocket.OPEN) {
		const data = {
			id: userId,
			name: username,
			position: {
				lat: position.coords.latitude,
				lng: position.coords.longitude,
			},
			type: "update",
		};
		ws.send(JSON.stringify(data));

		// Mettre à jour le marqueur de l'utilisateur sur la carte
		if (markers[ userId ]) {
			markers[ userId ].setLatLng([ position.coords.latitude, position.coords.longitude ]);
		} else {
			markers[ userId ] = L.marker([ position.coords.latitude, position.coords.longitude ])
				.addTo(map)
				.bindPopup(username)
				.openPopup();
		}

		// Centrer la carte sur la position de l'utilisateur
		map.setView([ position.coords.latitude, position.coords.longitude ], map.getZoom());
	} else {
		console.warn("WebSocket is not open. Cannot update position.");
	}
};

const successCallback = (position) => {
	sendUserPosition(position);
	map.setView([ position.coords.latitude, position.coords.longitude ], 13);

	// Ajouter le marqueur initial de l'utilisateur
	if (!markers[ userId ]) {
		markers[ userId ] = L.marker([ position.coords.latitude, position.coords.longitude ])
			.addTo(map)
			.bindPopup(username)
			.openPopup();
	}

	// Mettre à jour la position de l'utilisateur toutes les 10 secondes
	setInterval(() => {
		navigator.geolocation.getCurrentPosition(updateUserPosition, errorCallback);
	}, 10000);
};

const errorCallback = (error) => {
	const errorMessageElement = document.getElementById("error-message");
	switch (error.code) {
		case error.PERMISSION_DENIED:
			errorMessageElement.textContent = "L'utilisateur a refusé la demande de géolocalisation.";
			break;
		case error.POSITION_UNAVAILABLE:
			errorMessageElement.textContent = "Les informations de localisation sont indisponibles.";
			break;
		case error.TIMEOUT:
			errorMessageElement.textContent = "La demande de localisation a expiré.";
			break;
		case error.UNKNOWN_ERROR:
			errorMessageElement.textContent = "Une erreur inconnue s'est produite.";
			break;
	}
	console.error(error);
};

const initializeUser = async () => {
	username = document.getElementById("username").value.trim();
	if (!username) {
		alert("Veuillez entrer un nom");
		return;
	}
	userId = "user-" + Date.now(); // Générer un ID unique pour l'utilisateur
	document.getElementById("user-form").style.display = "none";

	try {
		const geoPermission = await navigator.permissions.query({ name: "geolocation" });
		if (geoPermission.state === "granted" || geoPermission.state === "prompt") {
			navigator.geolocation.getCurrentPosition(successCallback, errorCallback);
		} else {

			alert("Géolocalisation refusée");
		}
	} catch (error) {
		console.error("Erreur d'accès aux périphériques:", error);
		alert("Erreur d'accès aux périphériques : " + error.message);
	}

	// Initialise WebSocket connection
	ws = new WebSocket("wss://gwilym.is-a.dev");
	ws.onopen = () => {
		console.log("WebSocket connected");
	};

	ws.onmessage = async (event) => {
		const message = JSON.parse(event.data);

		switch (message.type) {
			case "offer":
				await handleVideoOffer(message.offer, message.from);
				break;
			case "answer":
				await handleVideoAnswer(message.answer);
				break;
			case "candidate":
				await handleNewICECandidate(message.candidate);
				break;
			case "invite":
				const accept = confirm(`${message.from} vous invite à une visioconférence. Acceptez-vous ?`);
				if (accept) {
					joinRoom(message.roomId);
					startVideoCall(message.roomId);
				}
				break;
			case "room-created":
				joinRoom(message.roomId);
				startVideoCall(message.roomId);
				break;
			case "user-connected":
				console.log(`User connected to room: ${message.roomId}`);
				break;
			case "update":
				updateUserPositions(message.users);
				break;
			default:
				console.warn("Unknown message type:", message.type);
		}
	};






	ws.onclose = () => {
		console.log("WebSocket disconnected");
	};
	ws.onerror = (error) => {
		console.error("WebSocket error:", error);
	};

	window.addEventListener("beforeunload", () => {
		if (ws && ws.readyState === WebSocket.OPEN) {
			const data = { id: userId, type: "disconnect" };
			ws.send(JSON.stringify(data));
		}
	});
};

const startVideoCall = async (roomId) => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		document.getElementById("local-video").srcObject = stream;
		document.getElementById("video-chat").style.display = "block";

		peerConnection = new RTCPeerConnection(configuration);

		stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log("Sending ICE candidate:", event.candidate);
				ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate, roomId }));
			}
		};

		peerConnection.ontrack = (event) => {
			const remoteStream = event.streams[ 0 ];
			document.getElementById("remote-video").srcObject = remoteStream;
		};

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		ws.send(JSON.stringify({ type: "offer", offer, roomId }));
	} catch (error) {
		console.error("Error starting video call:", error);
		alert("Erreur lors de l'accès aux périphériques médias : " + error.message);
	}
};




const handleVideoOffer = async (offer, from) => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
		document.getElementById("local-video").srcObject = stream;
		document.getElementById("video-chat").style.display = "block";

		peerConnection = new RTCPeerConnection(configuration);

		stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log("Sending ICE candidate:", event.candidate);
				ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate, to: from }));
			}
		};

		peerConnection.ontrack = (event) => {
			const remoteStream = event.streams[ 0 ];
			document.getElementById("remote-video").srcObject = remoteStream;
		};

		await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);
		ws.send(JSON.stringify({ type: "answer", answer, to: from }));

		// Process queued ICE candidates
		while (iceCandidatesQueue.length) {
			const candidate = iceCandidatesQueue.shift();
			await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
		}
	} catch (error) {
		console.error("Error handling video offer:", error);
		alert("Erreur lors de l'accès aux périphériques médias : " + error.message);
	}
};



const joinRoom = (roomId) => {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: 'join-room', roomId }));
		console.log("Joining room:", roomId);
	} else {
		console.warn("WebSocket is not open. Cannot join room.");
	}
};



const handleVideoAnswer = async (answer) => {
	try {
		await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

		// Process queued ICE candidates
		while (iceCandidatesQueue.length) {
			const candidate = iceCandidatesQueue.shift();
			await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
		}
	} catch (error) {
		console.error("Error handling video answer:", error);
	}
};


const handleNewICECandidate = async (candidate) => {
	try {
		console.log("New ICE candidate:", candidate);
		if (peerConnection) {
			if (peerConnection.remoteDescription) {
				await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
				console.log("Added ICE candidate:", candidate);
			} else {
				console.log("Queuing ICE candidate:", candidate);
				iceCandidatesQueue.push(candidate);
			}
		} else {
			console.log("Queuing ICE candidate (no peer connection):", candidate);
			iceCandidatesQueue.push(candidate);
		}
	} catch (error) {
		console.error("Error adding received ICE candidate", error);
	}
};



const inviteToVideoCall = (id) => {
	if (ws && ws.readyState === WebSocket.OPEN) {
		const roomId = `room-${Date.now()}`;
		ws.send(JSON.stringify({ type: 'invite', to: id, from: userId, roomId }));
		console.log("Invitation sent to:", id);
	} else {
		console.warn("WebSocket is not open. Cannot send invitation.");
	}
};




const endVideoCall = () => {
	if (peerConnection) {
		peerConnection.close();
		peerConnection = null;
		console.log("Peer connection closed");
		const localVideo = document.getElementById("local-video");
		if (localVideo.srcObject) {
			localVideo.srcObject.getTracks().forEach((track) => track.stop());
			localVideo.srcObject = null;
		}
	}
	document.getElementById("video-chat").style.display = "none";
	document.getElementById("local-video").srcObject = null;
	document.getElementById("remote-video").srcObject = null;
};

// Fetch user positions every 5 seconds
setInterval(fetchUserPositions, 5000);

// Initial fetch
fetchUserPositions();
