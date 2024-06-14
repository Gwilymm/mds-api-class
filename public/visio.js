// visio.js

const Visio = {
	localVideo: document.getElementById('local-video'),
	remoteVideo: document.getElementById('remote-video'),
	peerConnection: null,
	localStream: null,

	initialize: async function () {
		try {
			this.localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
			this.localVideo.srcObject = this.localStream;
		} catch (error) {
			console.error('Error accessing media devices.', error);
		}
	},

	setupWebSocket: function () {
		ws = new WebSocket("wss://gwilym.is-a.dev");

		ws.onopen = () => {
			console.log("WebSocket connection opened");
		};

		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			this.handleWebSocketMessage(data);
		};

		ws.onclose = () => {
			console.warn("WebSocket connection closed. Reconnecting...");
			setTimeout(this.setupWebSocket.bind(this), 1000); // Use bind to ensure proper context
		};

		ws.onerror = (error) => {
			console.error("WebSocket error:", error);
		};
	},

	handleWebSocketMessage: async function (data) {
		switch (data.type) {
			case 'offer':
				await this.handleOffer(data.offer);
				break;
			case 'answer':
				await this.handleAnswer(data.answer);
				break;
			case 'ice-candidate':
				await this.handleICECandidate(data.candidate);
				break;
		}
	},

	sendSignalingData: function (data) {
		ws.send(JSON.stringify(data));
	},

	createPeerConnection: function () {
		const configuration = { iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ] };
		this.peerConnection = new RTCPeerConnection(configuration);

		this.peerConnection.onicecandidate = event => {
			if (event.candidate) {
				this.sendSignalingData({ type: 'ice-candidate', candidate: event.candidate });
			}
		};

		this.peerConnection.ontrack = event => {
			this.remoteVideo.srcObject = event.streams[ 0 ];
		};

		this.peerConnection.addStream(this.localStream);
	},

	createOffer: async function () {
		this.createPeerConnection();
		const offer = await this.peerConnection.createOffer();
		await this.peerConnection.setLocalDescription(offer);
		this.sendSignalingData({ type: 'offer', offer: offer });
		document.getElementById('video-chat').style.display = 'block'; // Show video chat on caller
	},

	handleOffer: async function (offer) {
		this.createPeerConnection();
		await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
		const answer = await this.peerConnection.createAnswer();
		await this.peerConnection.setLocalDescription(answer);
		this.sendSignalingData({ type: 'answer', answer: answer });
		document.getElementById('video-chat').style.display = 'block'; // Show video chat on receiver
	},

	handleAnswer: async function (answer) {
		await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
	},

	handleICECandidate: async function (candidate) {
		try {
			await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
		} catch (error) {
			console.error('Error adding received ice candidate', error);
		}
	},

	inviteToVideoCall: function (userId) {
		this.createOffer();
	},

	endCall: function () {
		if (this.peerConnection) {
			this.peerConnection.close();
			this.peerConnection = null;
		}
		document.getElementById('video-chat').style.display = 'none';
	}
};

Visio.initialize();
Visio.setupWebSocket(); // Ensure WebSocket is set up on load
