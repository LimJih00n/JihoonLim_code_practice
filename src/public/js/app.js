//front 각 클라이언트마다 각각 실행!
const socket = io();

const welcome = document.getElementById("welcome");
const myFace = document.getElementById("myFace");
const call = document.getElementById("call");

call.hidden = true;

const welcome_Form = welcome.querySelector("form");



let myStream;
let roomName;
let nickName;

let pcObj = { // 지금 클라이언트가 연결되어 있는 peer클라이언트들의 리스트

  // remoteSocketId: pc(연결객체)
}; // 지금 클라이언트가 들어가 있는 방만 생각하면 된다! 받아온 socketID와 연결


function addVideoToGrid(videoElement, remoteSocketId) {
  const videoGrid = document.getElementById('videoGrid');
  const videoContainer = document.createElement('div');
  videoContainer.classList.add('videoContainer');
  videoContainer.id = 'video-' + remoteSocketId; // Unique ID for each video container
  videoContainer.appendChild(videoElement);
  videoGrid.appendChild(videoContainer);
}


function paintPeerFace(peerStream, remoteSocketId, remoteNickname) {
  // Create a video element for the peer's stream
  const video = document.createElement("video");
  video.autoplay = true;
  video.playsInline = true;
  video.width = "400";
  video.height = "400";
  video.srcObject = peerStream;

  // Create a container for the video and nickname
  const videoContainer = document.createElement("div");
  videoContainer.id = remoteSocketId;
  const nicknameContainer = document.createElement("h3");
  nicknameContainer.id = "userNickname";
  nicknameContainer.innerText = remoteNickname;

  // Append the video and nickname to the container
  videoContainer.appendChild(video);
  videoContainer.appendChild(nicknameContainer);

  // Add the container to the grid
  addVideoToGrid(videoContainer, remoteSocketId);
}

function handleIce(event, remoteSocketId) {
  if (event.candidate) {
    socket.emit("ice", event.candidate, remoteSocketId);
  }
}

function handleAddStream(event, remoteSocketId, remoteNickname) {
  const peerStream = event.stream;
  paintPeerFace(peerStream, remoteSocketId, remoteNickname);
}

function createConnection(remoteSocketId, remoteNickname) { // 만들때 스트림 연결, ice 보냄!
  const myPeerConnection = new RTCPeerConnection({
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
  myPeerConnection.addEventListener("icecandidate", (event) => {
    handleIce(event, remoteSocketId);
  });
  myPeerConnection.addEventListener("addstream", (event) => {
    handleAddStream(event, remoteSocketId, remoteNickname);
  });
  

  myStream //
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));

  pcObj[remoteSocketId] = myPeerConnection; // id - peer connection 저장!

  //sortStreams();
  return myPeerConnection;
}

async function getMedia(){
  try{
    myStream = await navigator.mediaDevices.getUserMedia({
      audio:true,
      video:true
    })
    myFace.srcObject = myStream;
  }catch(e){
    console.log(e);
  }
}

async function initCall() { // 카메라 띄우기!
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
}


async function handleWelcomeSubmit(event) { 
  event.preventDefault();
  const room_input = welcome_Form.querySelector("#room");
  const nick_input = welcome_Form.querySelector("#nick");
  socket.emit("join_room", room_input.value,nick_input.value); // room에 들어가고 카메라를 켠다!
  roomName = room_input.value;
  nickName = nick_input.value;
  room_input.value = "";
  nick_input.value = "";
}

//시작하는 줄! room에 들어온다
welcome_Form.addEventListener("submit", handleWelcomeSubmit); // 부터 시작한다!!

socket.on("accept_join",async(userObjArr)=>{
  await initCall();

  const length = userObjArr.length; // 현재 방안에 있는 사람수 1명만 있으면 나만키고끝 아니면 링크 해줘야한다!
  if (length === 1) {
    return;
  }
  for(let i=0;i<length-1;i++){ 
    //반복문 돌면서 각각 보냄
    // 내가 항상 마지막에 있다! 들어온 사람 기준
    // 들어온 사람이 앞에 있는 애들한테 offer 보내서 통신 시작하는 것!
    // offer를 다 보낸다!
    //이때 서버를 거친다!
    try{
      const newPC = createConnection(userObjArr[i].socketId,userObjArr[i].nickName); // offer보낼때 연결만듦 -> 어디에 연결 할 것인지!
      const offer = await newPC.createOffer();
      await newPC.setLocalDescription(offer); // local 설정
      socket.emit("offer", offer, userObjArr[i].socketId, nickName); // emit 보냄

    }catch(e){
      console.log(e);
    }
  }
});

socket.on("offer", async (offer, remoteSocketId, remoteNickname) => { // offer 받을때도 연결만듦! 다리 와서 놓는 중!
  try { //offer 받았다! 어디서 준것인지 보고 connection 만든다!
    const newPC = createConnection(remoteSocketId, remoteNickname); // 연결할애
    await newPC.setRemoteDescription(offer);
    const answer = await newPC.createAnswer();
    await newPC.setLocalDescription(answer);
    socket.emit("answer", answer, remoteSocketId); // answer 보낸다!
  
  } catch (err) {
    console.error(err);
  }
});

socket.on("answer", async (answer, remoteSocketId) => { //id로 peer를 저장해둠!
  await pcObj[remoteSocketId].setRemoteDescription(answer); //연결에 응답
});

socket.on("ice", async (ice, remoteSocketId) => {
  await pcObj[remoteSocketId].addIceCandidate(ice);
});