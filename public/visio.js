const Visio = (() => {
	let localStream;
	let remoteStream;
	let peerConnection;
	let isCaller = false;  // Dynamically determine or assign based on your app logic
	const configuration = {
		iceServers: [
			{
				urls: "stun:stun.l.google.com:19302",
			},
		],
	};

	const startVideoCall = async (roomId) => {
		try {
			localStream = await navigator.mediaDevices.getUserMedia({
				video: true,
				audio: true,
			});

			document.getElementById("local-video").srcObject = localStream;
			document.getElementById("video-chat").style.display = "block";

			peerConnection = new RTCPeerConnection(configuration);

			localStream.getTracks().forEach((track) => {
				peerConnection.addTrack(track, localStream);
			});

			peerConnection.ontrack = (event) => {
				remoteStream = event.streams[ 0 ];
				document.getElementById("remote-video").srcObject = remoteStream;
			};

			peerConnection.onicecandidate = (event) => {
				if (event.candidate) {
					const data = {
						type: 'webrtc_ice_candidate',
						targetId: roomId,
						candidate: event.candidate,
					};
					ws.send(JSON.stringify(data));
				}
			};

			// Initiate negotiation if this peer is the caller
			if (isCaller) {
				const offer = await peerConnection.createOffer();
				await peerConnection.setLocalDescription(offer);
				ws.send(JSON.stringify({
					type: 'webrtc_offer',
					roomId: roomId,
					offer: offer,
				}));
			}
		} catch (error) {
			console.error("Error accessing media devices.", error);
		}
	};

	const handleWebSocketMessage = (data) => {
		switch (data.type) {
			case 'invite_to_call':
				if (confirm(`You are invited to a video call by ${data.inviterId}. Do you accept?`)) {
					isCaller = false;  // Set based on your logic
					const response = {
						type: 'call_accepted',
						roomId: data.roomId,
						inviterId: data.inviterId,
					};
					ws.send(JSON.stringify(response));
					startVideoCall(data.roomId);
				}
				break;
			case 'call_accepted':
				isCaller = true;  // Set based on your logic
				startVideoCall(data.roomId);
				break;
			case 'webrtc_offer':
				handleOffer(data);
				break;
			case 'webrtc_answer':
				handleAnswer(data);
				break;
			case 'webrtc_ice_candidate':
				handleIceCandidate(data);
				break;
		}
	};

	const handleOffer = async (data) => {
		if (!peerConnection) {
			await startVideoCall(data.roomId);
		}

		if (!data.offer || !data.offer.sdp) {
			console.error("Received invalid offer data", data);
			return;
		}

		const offerDesc = new RTCSessionDescription({
			type: data.offer.type,
			sdp: data.offer.sdp

		});

		await peerConnection.setRemoteDescription(offerDesc);
		const answer = await peerConnection.createAnswer();

		await peerConnection.setLocalDescription(answer);

		ws.send(JSON.stringify({
			type: 'webrtc_answer',
			targetId: data.inviterId,
			answer: {
				type: answer.type,
				sdp: answer.sdp,
			},
		}));
	};

	const handleAnswer = async (data) => {
		if (!data.answer || !data.answer.sdp) {
			console.error("Received invalid answer data", data);
			return;
		}

		// Check if the peer connection is expecting an answer
		if (peerConnection.signalingState !== "have-local-offer") {
			console.error(`Cannot set remote answer in state: ${peerConnection.signalingState}`);
			return;
		}

		try {
			const answerDesc = new RTCSessionDescription(data.answer);
			await peerConnection.setRemoteDescription(answerDesc);
			console.log("Answer successfully set as remote description");
		} catch (error) {
			console.error("Failed to set remote description with error: ", error);
		}
	};

	const handleIceCandidate = async (data) => {
		try {
			await peerConnection.addIceCandidate(data.candidate);
		} catch (e) {
			console.error('Error adding received ice candidate', e);
		}
	};

	const createRoom = (roomId, callback) => {
		const data = {
			type: 'create_room',
			roomId
		};
		ws.send(JSON.stringify(data));
		// Assume callback is called after room is created; this could be handled more robustly with confirmation messages.
		if (callback) callback();
	};

	const inviteToVideoCall = (invitedUserId) => {
		console.log(`Inviting user ${invitedUserId} to video call...`);
		const roomId = `room-${Date.now()}`;
		createRoom(roomId, () => {
			const data = {
				type: 'invite_to_call',
				roomId,
				invitedUserId,
				inviterId: userId,
			};
			console.log(`Room ${roomId} created, inviting ${invitedUserId}`);
			ws.send(JSON.stringify(data));
		});
	};


	const endVideoCall = () => {
		document.getElementById("video-chat").style.display = "none";
		if (peerConnection) {
			peerConnection.close();
			peerConnection = null;
		}
		if (localStream) {
			localStream.getTracks().forEach((track) => track.stop());
		}
		if (remoteStream) {
			remoteStream.getTracks().forEach((track) => track.stop());
		}
	};

	document.addEventListener('DOMContentLoaded', (event) => {
		document.getElementById('end-call-btn').addEventListener('click', endVideoCall);
	});

	return {
		inviteToVideoCall,
		handleWebSocketMessage,
	};
})();
