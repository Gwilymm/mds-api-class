let userId = null;
let username = null;
let ws = null;
let peerConnection = null;
let iceCandidatesQueue = [];

const configuration = {
	iceServers: [ { urls: "stun:stun.l.google.com:19302" } ],
};

L.Icon.Default.imagePath = "https://unpkg.com/leaflet@1.7.1/dist/images/";

const map = L.map("map").setView([ 51.505, -0.09 ], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
	maxZoom: 19,
}).addTo(map);

const markers = {};



/**
 * The updateUserPositions function updates the positions of users on a map and displays them in a list
 * with an option to invite them to a video call.
 * @param users - The `users` parameter in the `updateUserPositions` function is expected to be an
 * array of user objects. Each user object should have the following properties:
 * @returns The `updateUserPositions` function does not explicitly return a value. It updates the
 * positions of users on a map and updates the user list in the HTML document based on the provided
 * `users` array.
 */
const updateUserPositions = (users) => {
	if (!Array.isArray(users)) {
		console.error(
			"La réponse de l'API n'est pas un tableau d'utilisateurs:",
			users
		);
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
		li.className =
			"flex justify-between items-center p-2 bg-gray-100 rounded shadow";
		li.innerHTML = `<span>${user.name}</span> <button onclick="inviteToVideoCall('${user.id}')" class="bg-green-500 text-white px-2 py-1 rounded">Visio</button>`;
		userList.appendChild(li);
	});
};


/**
 * The function fetches user positions from an API endpoint, handles errors, and updates the user
 * positions accordingly.
 */
const fetchUserPositions = async () => {
	try {
		const response = await fetch("/api/users");
		if (!response.ok) {
			throw new Error(
				"Erreur lors de la récupération des utilisateurs: " +
				response.statusText
			);
		}
		const text = await response.text(); // Lire la réponse en tant que texte
		const users = JSON.parse(text); // Convertir le texte en JSON

		updateUserPositions(users);
	} catch (error) {
		console.error(
			"Erreur lors de la récupération des utilisateurs:",
			error
		);
	}
};


/**
 * The function `sendUserPosition` sends the user's position data over a WebSocket connection if the
 * connection is open.
 * @param position - The `position` parameter in the `sendUserPosition` function is an object that
 * contains the user's coordinates. It has a `coords` property which in turn has `latitude` and
 * `longitude` properties representing the user's current latitude and longitude position.
 */
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


/**
 * The updateUserPosition function updates the user's position on a map and sends the updated position
 * data via WebSocket.
 * @param position - The `updateUserPosition` function takes a `position` parameter, which is expected
 * to be an object containing coordinates information. The coordinates information should have a
 * `coords` property, which in turn should have `latitude` and `longitude` properties representing the
 * latitude and longitude values of the position.
 */
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
			markers[ userId ].setLatLng([
				position.coords.latitude,
				position.coords.longitude,
			]);
		} else {
			markers[ userId ] = L.marker([
				position.coords.latitude,
				position.coords.longitude,
			])
				.addTo(map)
				.bindPopup(username)
				.openPopup();
		}

		// Centrer la carte sur la position de l'utilisateur
		map.setView(
			[ position.coords.latitude, position.coords.longitude ],
			map.getZoom()
		);
	} else {
		console.warn("WebSocket is not open. Cannot update position.");
	}
};


/**
 * The successCallback function updates the user's position on a map and continuously updates it every
 * 10 seconds.
 * @param position - The `position` parameter in the `successCallback` function contains information
 * about the user's current geolocation coordinates, such as latitude and longitude. This information
 * is used to update the user's position on the map and display a marker at that location. The
 * `position` object typically has a `coords
 */
const successCallback = (position) => {
	sendUserPosition(position);
	map.setView([ position.coords.latitude, position.coords.longitude ], 13);

	// Ajouter le marqueur initial de l'utilisateur
	if (!markers[ userId ]) {
		markers[ userId ] = L.marker([
			position.coords.latitude,
			position.coords.longitude,
		])
			.addTo(map)
			.bindPopup(username)
			.openPopup();
	}

	// Mettre à jour la position de l'utilisateur toutes les 10 secondes
	setInterval(() => {
		navigator.geolocation.getCurrentPosition(
			updateUserPosition,
			errorCallback
		);
	}, 500);
};

/**
 * The function `errorCallback` handles different types of geolocation errors and displays
 * corresponding error messages on the webpage.
 * @param error - The `error` parameter in the `errorCallback` function is an object that represents an
 * error encountered during geolocation. It contains information about the type of error that occurred,
 * such as `PERMISSION_DENIED`, `POSITION_UNAVAILABLE`, `TIMEOUT`, or `UNKNOWN_ERROR`. The function
 * uses a
 */
const errorCallback = (error) => {
	const errorMessageElement = document.getElementById("error-message");
	switch (error.code) {
		case error.PERMISSION_DENIED:
			errorMessageElement.textContent =
				"L'utilisateur a refusé la demande de géolocalisation.";
			break;
		case error.POSITION_UNAVAILABLE:
			errorMessageElement.textContent =
				"Les informations de localisation sont indisponibles.";
			break;
		case error.TIMEOUT:
			errorMessageElement.textContent =
				"La demande de localisation a expiré.";
			break;
		case error.UNKNOWN_ERROR:
			errorMessageElement.textContent =
				"Une erreur inconnue s'est produite.";
			break;
	}
	console.error(error);
};

/* The above code is a JavaScript function that initializes a user by performing the following steps: */
const initializeUser = async () => {
	username = document.getElementById("username").value.trim();
	if (!username) {
		alert("Veuillez entrer un nom");
		return;
	}
	userId = "user-" + Date.now(); // Générer un ID unique pour l'utilisateur
	document.getElementById("user-form").style.display = "none";

	try {
		/* The above JavaScript code is checking for geolocation permission using the
		`navigator.permissions.query` method. It then checks if the permission state is either "granted"
		or "prompt". If the permission is granted or needs to be prompted, it calls
		`navigator.geolocation.getCurrentPosition` to get the current position. If the permission is not
		granted, it displays an alert message saying "Géolocalisation refusée" which means "Geolocation
		denied" in French. */

		const geoPermission = await navigator.permissions.query({
			name: "geolocation",
		});
		if (
			geoPermission.state === "granted" ||
			geoPermission.state === "prompt"
		) {
			navigator.geolocation.getCurrentPosition(
				successCallback,
				errorCallback
			);
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
	/* The above code is setting up an event listener for WebSocket messages. When a message is received,
	it is parsed as JSON and then a switch statement is used to determine the type of message.
	Depending on the message type, different actions are taken: */
	ws.onmessage = async (event) => {
		const message = JSON.parse(event.data);
		console.log("WebSocket message received:", message);

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
				const accept = confirm(
					`${message.from} vous invite à une visioconférence. Acceptez-vous ?`
				);
				if (accept) {
					startVideoCall(message.from);
				}
				break;
			case "update":
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
			const data = {
				id: userId,
				type: "disconnect",
			};
			ws.send(JSON.stringify(data));
		}
	});
};

/**
 * The `startVideoCall` function in JavaScript initiates a video call by accessing the user's media
 * devices, setting up a peer connection, sending ICE candidates and offers, and handling remote video
 * streams.
 * @param id - The `id` parameter in the `startVideoCall` function represents the unique identifier of
 * the user or peer with whom you want to initiate a video call. This identifier is used to establish a
 * connection and communicate with the specific user over the WebRTC protocol. It could be a user ID,
 * username
 */
const startVideoCall = async (id) => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
		document.getElementById("local-video").srcObject = stream;
		document.getElementById("video-chat").style.display = "block";

		peerConnection = new RTCPeerConnection(configuration);

		stream
			.getTracks()
			.forEach((track) => peerConnection.addTrack(track, stream));

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log("Sending ICE candidate:", event.candidate);
				ws.send(
					JSON.stringify({
						type: "candidate",
						candidate: event.candidate,
						to: id,
					})
				);
			}
		};

		peerConnection.ontrack = (event) => {
			const remoteStream = event.streams[ 0 ];
			console.log("Remote Stream:", remoteStream);

			const remoteVideo = document.getElementById("remote-video");
			if (remoteVideo) {
				remoteVideo.srcObject = remoteStream;
				console.log("Remote video element found and stream assigned.");
			} else {
				console.error("Remote video element not found.");
			}
		};

		const offer = await peerConnection.createOffer();
		await peerConnection.setLocalDescription(offer);
		console.log("Local Description Set with Offer:", offer);

		ws.send(JSON.stringify({ type: "offer", offer: offer, to: id }));
	} catch (error) {
		console.error("Error starting video call:", error);
		alert(
			"Erreur lors de l'accès aux périphériques médias : " + error.message
		);
	}
};

/**
 * The `handleVideoOffer` function in JavaScript sets up a video call by handling the offer,
 * establishing a peer connection, exchanging ICE candidates, and displaying video streams.
 * @param offer - The `offer` parameter in the `handleVideoOffer` function is an object that represents
 * the session description of the remote peer's offer to start a WebRTC video call. It typically
 * includes information about the codecs, encryption settings, and other details required to establish
 * the connection. This offer is used by
 * @param from - The `from` parameter in the `handleVideoOffer` function represents the identifier or
 * address of the peer from whom the video offer is received. It is used to specify the destination of
 * ICE candidates and the answer when sending them back in the WebRTC communication process.
 */
const handleVideoOffer = async (offer, from) => {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true,
		});
		document.getElementById("local-video").srcObject = stream;
		document.getElementById("video-chat").style.display = "block";

		peerConnection = new RTCPeerConnection(configuration);

		stream
			.getTracks()
			.forEach((track) => peerConnection.addTrack(track, stream));

		peerConnection.onicecandidate = (event) => {
			if (event.candidate) {
				console.log("Sending ICE candidate:", event.candidate);
				ws.send(
					JSON.stringify({
						type: "candidate",
						candidate: event.candidate,
						to: from,
					})
				);
			}
		};

		peerConnection.ontrack = (event) => {
			const remoteStream = event.streams[ 0 ];
			console.log("Remote Stream:", remoteStream);

			const remoteVideo = document.getElementById("remote-video");
			if (remoteVideo) {
				remoteVideo.srcObject = remoteStream;
				console.log("Remote video element found and stream assigned.");
			} else {
				console.error("Remote video element not found.");
			}
		};

		await peerConnection.setRemoteDescription(
			new RTCSessionDescription(offer)
		);
		console.log("Remote Description Set with Offer:", offer);
		const answer = await peerConnection.createAnswer();
		await peerConnection.setLocalDescription(answer);
		console.log("Local Description Set with Answer:", answer);

		ws.send(JSON.stringify({ type: "answer", answer: answer, to: from }));

		// Process queued ICE candidates
		while (iceCandidatesQueue.length) {
			const candidate = iceCandidatesQueue.shift();
			console.log("Adding queued ICE candidate:", candidate);
			await peerConnection.addIceCandidate(
				new RTCIceCandidate(candidate)
			);
		}
	} catch (error) {
		console.error("Error handling video offer:", error);
		alert(
			"Erreur lors de l'accès aux périphériques médias : " + error.message
		);
	}
};

/**
 * The function `handleVideoAnswer` processes a received video answer by setting the remote description
 * and adding any queued ICE candidates to the peer connection.
 * @param answer - The `answer` parameter in the `handleVideoAnswer` function is typically a session
 * description object that contains the SDP (Session Description Protocol) answer received from the
 * remote peer during a WebRTC call. This answer is used to set the remote description on the local
 * peer connection to establish the connection between
 */
const handleVideoAnswer = async (answer) => {
	try {
		console.log("Received Answer:", answer);
		await peerConnection.setRemoteDescription(
			new RTCSessionDescription(answer)
		);
		console.log("Remote Description Set with Answer:", answer);

		// Process queued ICE candidates
		while (iceCandidatesQueue.length) {
			const candidate = iceCandidatesQueue.shift();
			console.log("Adding queued ICE candidate:", candidate);
			await peerConnection.addIceCandidate(
				new RTCIceCandidate(candidate)
			);
		}
	} catch (error) {
		console.error("Error handling video answer:", error);
	}
};

/**
 * The function `handleNewICECandidate` processes and adds ICE candidates to a peer connection,
 * handling cases where the connection is not yet established.
 * @param candidate - The `handleNewICECandidate` function you provided is responsible for handling new
 * ICE candidates in a WebRTC context. The function first logs the new ICE candidate received. It then
 * checks if there is an existing `peerConnection` and if it has a remote description set.
 */
const handleNewICECandidate = async (candidate) => {
	try {
		console.log("New ICE candidate:", candidate);
		if (peerConnection) {
			if (peerConnection.remoteDescription) {
				await peerConnection.addIceCandidate(
					new RTCIceCandidate(candidate)
				);
				console.log("Added ICE candidate:", candidate);
			} else {
				console.log("Queuing ICE candidate:", candidate);
				iceCandidatesQueue.push(candidate);
			}
		} else {
			console.log(
				"Queuing ICE candidate (no peer connection):",
				candidate
			);
			iceCandidatesQueue.push(candidate);
		}
	} catch (error) {
		console.error("Error adding received ICE candidate", error);
	}
};

/**
 * The function `inviteToVideoCall` sends a video call invitation to a specified user ID using
 * WebSocket if the connection is open.
 * @param id - The `id` parameter in the `inviteToVideoCall` function represents the unique identifier
 * of the user to whom you want to send an invitation for a video call.
 */
const inviteToVideoCall = (id) => {
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ type: "invite", to: id, from: userId }));
		console.log("Invitation sent to:", id);
	} else {
		console.warn("WebSocket is not open. Cannot send invitation.");
	}
};

/**
 * The `endVideoCall` function closes the peer connection, stops camera and microphone tracks, and
 * hides the video chat elements.
 */
const endVideoCall = () => {
	if (peerConnection) {
		peerConnection.close();
		peerConnection = null;
		console.log("Peer connection closed");
		// Close camera and mic
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


{ urls: "stun:stun.l.google.com:19302" },
{ urls: "stun:stun1.l.google.com:19302" },
{ urls: "stun:stun2.l.google.com:19302" },
{ urls: "stun:stun3.l.google.com:19302" },
{ urls: "stun:stun4.l.google.com:19302" },
