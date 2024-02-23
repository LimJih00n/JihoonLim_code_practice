import http from "http";
import SocketIO from "socket.io";
import express from "express";
const app = express();
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.set("views", process.cwd() + "/src/views");

app.use("/public", express.static(process.cwd() + "/src/public"));

app.get("/", (req, res) => {
  res.render("home.html");
});

app.get("/*", (req, res) => {
  res.redirect("/");
});

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

let roomOBJ =[
  /* 전체 room을 가지고 있는 리스트
  roomName
  curNum
  users: [ 그 room 에 참여한 사람의 id
    {socketId,nickname}, .. 
  ]
  */
]
const MAXNUM = 5;

wsServer.on("connection",(socket)=>{

  let InroomName = null;
  let Innickname = null;

  socket.on("join_room", (roomName, nickname) => { 
    //room에 들어오면 list에 넣고 user의 정보를 다시 보내준다!
    //이때 보내는 값은 그 방의 전체 인원에 대한 정보이다!
    socket.join(roomName);
    InroomName = roomName;
    Innickname = nickname;
    // 만약에 방이 없다면 새롭게 방을 만들어서 리스트에 넣어야한다!
    //있다면 원래 있는 방에 추가한다!
    let isRoomExist = false;
    let In_roomOBJ = null; //room이 있다면 그 room으로 없다면 새로 만들어야 한다.
    for(let i=0;i<roomOBJ.length;i++){
      if(InroomName == roomOBJ[i].roomName){
        if(roomOBJ[i].curNum >= MAXNUM){
          socket.emit("reject_join");
          return;
        }
        isRoomExist = true;
        In_roomOBJ = roomOBJ[i];
        break;
      }
    }
    if(!isRoomExist){ // 만들어주기만!
      In_roomOBJ = {
        roomName : InroomName,
        curNum : 0,
        users: []
      }
      roomOBJ.push(In_roomOBJ);
    }

    In_roomOBJ.users.push({
      socketId: socket.id,
      nickname : Innickname,
    });
    In_roomOBJ.curNum++;
    console.log(roomOBJ);
    socket.join(roomName);
    socket.emit("accept_join", In_roomOBJ.users); // users : nickname과 socket id  {} obj
    //In_roomOBJ 지금 들어온거 바로 담는 obj
  });

  socket.on("offer", (offer, remoteSocketId, localNickname) => { //  socketid: 보내온 곳, remoteSocketID: 보낼 곳
    socket.to(remoteSocketId).emit("offer", offer, socket.id, localNickname); //어디서 왔는지도 함께 보낸다!
  });
  
  socket.on("answer", (answer, remoteSocketId) => {
    socket.to(remoteSocketId).emit("answer", answer, socket.id);
  });

  socket.on("ice", (ice, remoteSocketId) => {
    socket.to(remoteSocketId).emit("ice", ice, socket.id);
  });

});


const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);