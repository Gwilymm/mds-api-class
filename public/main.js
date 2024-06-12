let ws;
let username;
let userId;
let rtcPeerConnection;
let localStream;
let remoteStream;
let roomId;
let invitedUserId; // Ajoutez cette variable globale pour stocker invitedUserId
let inviterId; // Ajoutez cette variable globale pour stocker inviterId

const mediaConstraints = {
	audio: true,
	video: { width: 1280, height: 720 },
};
const iceServers = {
	iceServers: [
		{ urls: "stun:stun.l.google.com:19302" },
		{ urls: "stun:stun1.l.google.com:19302" },
		{ urls: "stun:stun2.l.google.com:19302" },
		{ urls: "stun:stun3.l.google.com:19302" },
		{ urls: "stun:stun4.l.google.com:19302" },
		{
			urls: 'turn:turn.xirsys.com',
			username: 'YOUR_XIRSYS_USERNAME',
			credential: 'YOUR_XIRSYS_CREDENTIAL'
		}
	],
};

function initializeWebSocket() {
	ws = new WebSocket('wss://gwilym.is-a.dev'); // Remplacez par l'URL de votre serveur WebSocket

	ws.onopen = () => {
		console.log('WebSocket connection opened');
	};

	ws.onmessage = async (message) => {
		const data = JSON.parse(message.data);
		// Journal pour tous les messages WebSocket

		if (data.type === 'update') {
			fetchUserPositions();
		} else if (data.type === 'invite_to_call') {
			console.log('Received invite to call:', data);
			handleIncomingCall(data.roomId, data.inviterId);
		} else if (data.type === 'call_accepted') {
			console.log('Call accepted by remote user:', data);
			await handleCallAccepted(data.roomId, data.inviterId);
		} else if (data.type === 'webrtc_offer') {
			console.log("mes couilles");
			console.log('Received webrtc_offer:', data.sdp);  // Journal de l'offre WebRTC
			if (!rtcPeerConnection) {
				initializePeerConnection();
			}
			await handleOffer(data.sdp, data.roomId, data.inviterId);
		} else if (data.type === 'webrtc_answer') {
			console.log('Received webrtc_answer:', data.sdp);
			await handleAnswer(data.sdp);
		} else if (data.type === 'webrtc_ice_candidate') {
			const candidate = new RTCIceCandidate({
				sdpMLineIndex: data.label,
				candidate: data.candidate,
			});
			console.log('Received ICE candidate:', candidate);
			await rtcPeerConnection.addIceCandidate(candidate);
		}
	};

	ws.onerror = (error) => {
		console.error('WebSocket error:', error);
	};

	ws.onclose = () => {
		console.log('WebSocket connection closed');
	};
}

window.initializeWebSocket = initializeWebSocket;

async function inviteToVideoCall(invitedUserIdParam) {
	roomId = `room-${Date.now()}`;
	invitedUserId = invitedUserIdParam; // Assigner la valeur passée à la variable globale
	ws.send(JSON.stringify({ type: 'invite_to_call', roomId, inviterId: userId, invitedUserId }));
	console.log('Invitation envoyée. Connexion en cours...');
	await startCall(true, roomId);  // Lancer immédiatement la connexion locale à la salle
}

async function handleIncomingCall(roomId, inviterIdParam) {
	const accept = confirm('Vous avez une invitation à rejoindre un appel vidéo. Voulez-vous accepter?');
	if (accept) {
		inviterId = inviterIdParam; // Assigner la valeur passée à la variable globale
		ws.send(JSON.stringify({ type: 'call_accepted', roomId, inviterId }));
		await startCall(false, roomId);
	} else {
		alert('Appel refusé');
	}
}

async function handleCallAccepted(roomId, inviterIdParam) {
	inviterId = inviterIdParam; // Assigner la valeur passée à la variable globale
	console.log('Call accepted. Starting call as inviter.');
	await startCall(true, roomId);
}

async function startCall(isInviter, roomId) {
	console.log(`Starting call in room: ${roomId} as ${isInviter ? 'inviter' : 'invitee'}`);
	showVideoConference();  // Assurez-vous que la modal est affichée
	await setLocalStream(mediaConstraints);
	initializePeerConnection();  // Réinitialiser la connexion RTC avant de créer une offre/réponse
	addLocalTracks(rtcPeerConnection);
	console.log('Local tracks added.');
	if (isInviter) {
		console.log('Creating offer as inviter');
		await createOffer(roomId);
	}
}

function initializePeerConnection() {
	if (rtcPeerConnection) {
		rtcPeerConnection.close();
		rtcPeerConnection = null;
	}
	rtcPeerConnection = new RTCPeerConnection(iceServers);
	rtcPeerConnection.ontrack = setRemoteStream;
	rtcPeerConnection.onicecandidate = sendIceCandidate;
	console.log('PeerConnection initialized');
}

async function handleOffer(sdp, roomId, inviterId) {
	try {
		if (rtcPeerConnection.signalingState !== "stable") {
			await Promise.all([
				rtcPeerConnection.setLocalDescription({ type: "rollback" }),
				rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(sdp))
			]);
		} else {
			await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
		}
		await createAnswer(roomId, inviterId);
	} catch (error) {
		console.error('Error handling offer:', error);
	}
}

async function handleAnswer(sdp) {
	try {
		if (rtcPeerConnection.signalingState === "have-local-offer") {
			await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
		}
	} catch (error) {
		console.error('Error handling answer:', error);
	}
}

function showVideoConference() {
	document.getElementById('video-chat').style.display = 'block';
}

function endVideoCall() {
	document.getElementById('video-chat').style.display = 'none';
	if (rtcPeerConnection) {
		rtcPeerConnection.close();
		rtcPeerConnection = null;
	}

	document.getElementById('local-video').srcObject = null;
	document.getElementById('remote-video').srcObject = null;
}

async function setLocalStream(mediaConstraints) {
	try {
		localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
		console.log('Local stream obtained:', localStream);
		document.getElementById('local-video').srcObject = localStream;
	} catch (error) {
		console.error('Could not get user media', error);
	}
}

function addLocalTracks(rtcPeerConnection) {
	if (!localStream) {
		console.error('Local stream is not available.');
		return;
	}
	localStream.getTracks().forEach((track) => {
		rtcPeerConnection.addTrack(track, localStream);
		console.log('Added local track:', track);
	});
}

async function createOffer(roomId) {
	try {
		console.log('Creating offer...');
		const sessionDescription = await rtcPeerConnection.createOffer();
		await rtcPeerConnection.setLocalDescription(sessionDescription);

		ws.send(JSON.stringify({
			type: 'webrtc_offer',
			sdp: sessionDescription,
			roomId,
			inviterId: userId,
			invitedUserId
		}));
		console.log('Offer created and sent:', sessionDescription);
	} catch (error) {
		console.error('Error creating offer:', error);
	}
}

async function createAnswer(roomId) {
	try {
		console.log('Creating answer...');
		const sessionDescription = await rtcPeerConnection.createAnswer();
		await rtcPeerConnection.setLocalDescription(sessionDescription);

		ws.send(JSON.stringify({
			type: 'webrtc_answer',
			sdp: sessionDescription,
			roomId,
			inviterId,
			invitedUserId: userId
		}));
		console.log('Answer created and sent:', sessionDescription);
	} catch (error) {
		console.error('Error creating answer:', error);
	}
}

function setRemoteStream(event) {
	if (event.streams && event.streams[ 0 ]) {
		document.getElementById('remote-video').srcObject = event.streams[ 0 ];
		remoteStream = event.streams[ 0 ];
		console.log('Remote stream set:', remoteStream);
	} else {
		console.error('No remote stream available');
	}
}

function sendIceCandidate(event) {
	if (event.candidate) {
		ws.send(JSON.stringify({
			type: 'webrtc_ice_candidate',
			roomId,
			label: event.candidate.sdpMLineIndex,
			candidate: event.candidate.candidate,
			targetId: event.candidate.sdpMid === '0' ? invitedUserId : inviterId
		}));

	}
}
