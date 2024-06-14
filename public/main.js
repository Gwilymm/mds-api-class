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
		li.innerHTML = `<span>${user.name}</span> <button onclick="Visio.inviteToVideoCall('${user.id}')" class="bg-green-500 text-white px-2 py-1 rounded">Visio</button>`;
		userList.appendChild(li);
	});
};

const fetchUserPositions = async () => {
	try {
		const response = await fetch("/api/users", { cache: "no-cache" });
		if (!response.ok) {
			throw new Error("Erreur lors de la récupération des utilisateurs: " + response.statusText);
		}
		const users = await response.json();
		updateUserPositions(users);
	} catch (error) {
		console.error("Erreur lors de la récupération des utilisateurs:", error);
	}
};

let ws;
let username;
let userId;

const initializeWebSocket = () => {
	ws = new WebSocket("wss://gwilym.is-a.dev");

	ws.onopen = () => {
		console.log("WebSocket connection opened");
	};

	ws.onmessage = (event) => {
		const data = JSON.parse(event.data);
		if (Array.isArray(data)) {
			updateUserPositions(data);
		} else {
			if (data.type.includes('webrtc') || data.type.includes('call')) {
				Visio.handleWebSocketMessage(data);
			} else {
				handleWebSocketMessage(data);
			}
		}
	};

	ws.onclose = () => {
		console.warn("WebSocket connection closed. Reconnecting...");
		setTimeout(initializeWebSocket, 1000);
	};

	ws.onerror = (error) => {
		console.error("WebSocket error:", error);
	};
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

		if (markers[ userId ]) {
			markers[ userId ].setLatLng([ position.coords.latitude, position.coords.longitude ]);
		} else {
			markers[ userId ] = L.marker([ position.coords.latitude, position.coords.longitude ])
				.addTo(map)
				.bindPopup(username)
				.openPopup();
		}
		map.setView([ position.coords.latitude, position.coords.longitude ], map.getZoom());
	} else {
		console.warn("WebSocket is not open. Cannot update position.");
	}
};

const successCallback = (position) => {
	sendUserPosition(position);
	map.setView([ position.coords.latitude, position.coords.longitude ], 13);

	if (!markers[ userId ]) {
		markers[ userId ] = L.marker([ position.coords.latitude, position.coords.longitude ])
			.addTo(map)
			.bindPopup(username)
			.openPopup();
	}

	setInterval(() => {
		navigator.geolocation.getCurrentPosition(updateUserPosition, errorCallback, {
			enableHighAccuracy: true
		});
	}, 1000);
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
	userId = "user-" + Date.now();
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
	console.log('Initialized user:', username, userId);
	initializeWebSocket();
};

const handleWebSocketMessage = (data) => {
	// Handle WebSocket messages related to the map and geolocation
	if (data.type === "update") {
		updateUserPositions([ data ]);
	}
};

setInterval(fetchUserPositions, 1000);
fetchUserPositions();
initializeWebSocket();
