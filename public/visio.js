const Visio = (() => {
	let localStream;
	let remoteStream;
	let peerConnection;
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

			const data = {
				type: 'join_room',
				roomId: roomId,
				userId: userId
			};
			ws.send(JSON.stringify(data));

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
		} catch (error) {
			console.error("Error accessing media devices.", error);
		}
	};

	const handleOffer = async (data) => {
		if (!data.offer || !data.offer.sdp) {
			console.error("Received invalid offer data", data);
			return;
		}

		const offerDesc = new RTCSessionElement({
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
				sdp: answer.sdp
			}
		}));
	};





	const handleWebSocketMessage = (data) => {
		if (data.type === 'invite_to_call') {
			if (confirm(`You are invited to a video call by ${data.inviterId}. Do you accept?`)) {
				const response = {
					type: 'call_accepted',
					roomId: data.roomId,
					inviterId: data.inviterId,
				};
				ws.send(JSON.stringify(response));
				startVideoCall(data.roomId);
			}
		} else if (data.type === 'call_accepted') {
			startVideoCall(data.roomId);
		} else if (data.type === 'webrtc_offer') {
			handleOffer(data);
		} else if (data.type === 'webrtc_answer') {
			handleAnswer(data);
		} else if (data.type === 'webrtc_ice_candidate') {
			handleIceCandidate(data);
		}
	};


	const handleAnswer = async (data) => {
		const answerDesc = new RTCSessionDescription({
			type: 'answer',
			sdp: data.answer.sdp
		});
		await peerConnection.setRemoteDescription(answerDesc);
	};

	const handleIceCandidate = async (data) => {
		try {
			await peerConnection.addIceCandidate(data.candidate);
		} catch (e) {
			console.error('Error adding received ice candidate', e);
		}
	};

	const inviteToVideoCall = (invitedUserId) => {
		const roomId = `room-${Date.now()}`;
		const data = {
			type: 'invite_to_call',
			roomId,
			invitedUserId,
			inviterId: userId,
		};
		ws.send(JSON.stringify(data));
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
