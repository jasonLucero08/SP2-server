const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // your React app's URL
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 4000;

var userList = {};

app.use(
  cors({
    origin: "http://localhost:5173", // your React app's URL
  })
);

app.get("/", (req, res) => {
  res.send("Socket.IO server is running.");
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("createRoom", (callback) => {
    const roomCode = Math.random().toString(36).substring(2, 7);
    socket.join(roomCode);
    console.log(`Room created with code: ${roomCode}`);
    callback(roomCode);
  });

  socket.on("joinRoom", (roomCode, callback) => {
    const room = io.sockets.adapter.rooms.get(roomCode);
    if (room) {
      socket.join(roomCode);
      console.log(`User ${socket.id} joined room ${roomCode}`);
      callback({ success: true });

      // Notify both users when the room has two participants
      if (room.size === 2) {
        io.in(roomCode).emit("roomReady", roomCode);
      }
    } else {
      callback({ success: false, message: "Room not found" });
    }
  });

  socket.on("userDetails", (data, callback) => {
    const room = io.sockets.adapter.rooms.get(data.roomCode);
    if (room) {
      if (data.uData != null) {
        var userName = data.uData.username;
        userList[userName] = data.uData;
      }

      io.in(data.roomCode).emit("receiveUserList", userList);
    }
  });

  socket.on("clearUserList", () => {
    userList = {};
  });

  socket.on("enemyStatChange", (data, callback) => {
    const room = io.sockets.adapter.rooms.get(data.roomCode);
    if (room) {
      var userName = data.user;
      const statData = { key: userName, data: data };
      io.in(data.roomCode).emit("broadcastStatChange", statData);
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
