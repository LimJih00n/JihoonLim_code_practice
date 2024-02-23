const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream; //local stream
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let peerInfo = {}; // userID에 따라 다르게 가짐

//userID따라서 다 check해줘야한다!

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try{
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
    await getCameras();
  }catch(e){
    console.log(e);
  }
}

function handleMuteClick() {
  
  myStream.getAudioTracks().forEach(track => { track.enabled = ! track.enabled });
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream.getVideoTracks().forEach(track => { track.enabled = ! track.enabled });
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}
async function handleCameraChange() {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) { // 카메라 바뀌었을때 바꾼거로 보내주는 코드!
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);


const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

function handleIce(data) {
  console.log(data)
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  console.log(data)
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}

async function makeConnection(userId) {
  peerInfo[userId] = new Object();
  peerInfo[userId].peerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
});
peerInfo[userId].peerConnection.addEventListener("icecandidate", handleIce);
peerInfo[userId].peerConnection.addEventListener("addstream", handleAddStream);

  myStream // 자신의 video, audio track을 모두 자신의 RTCPeerConnection에 등록한다.
    .getTracks()
    .forEach(async (track) => await peerInfo[userId].peerConnection.addTrack(track, myStream));
}




async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

async function handleWelcomeSubmit(event) { // welcome이 들어오면 같은 room에 있는 상대와 connection을 한다!
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value); // connection에 내 정보 추가해두고 부름!
  roomName = input.value;
  input.value = "";
}

//시작하는 줄! room에 들어온다
welcomeForm.addEventListener("submit", handleWelcomeSubmit); // 부터 시작한다!!

// Socket Code

socket.on("welcome", async () => { // 방에 들어오면 상대방에게 offer를 보낸다!
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer); // local offer 설정
  console.log("sent the offer");
  socket.emit("offer", offer, roomName);
});
socket.on("offer", async (offer) => {
  console.log("received the offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received candidate");
  myPeerConnection.addIceCandidate(ice);
});