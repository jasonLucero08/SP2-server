const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://pnduassrodsmyexxhtsf.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBuZHVhc3Nyb2RzbXlleHhodHNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTQyOTkzNDYsImV4cCI6MjAyOTg3NTM0Nn0.QIFL9NTo5iwgaWqAAYYGaB8mo-FgThLzchpDfO_UouU";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://456-server.glitch.me/", // your React app's URL
    // origin: "http://localhost:5173", // your React app's URL
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3000;

let userList = {};
let userChoiceList = {};
let statData = {};
let hasPicked = {};
let userRooms = {};

app.use(
  cors({
    origin: "https://456-server.glitch.me/", // your React app's URL
    // origin: "http://localhost:5173", // your React app's URL
  })
);

app.get("/", (req, res) => {
  res.send("Socket.IO server is running.");
});

// Endpoint to fetch data from Supabase
app.get("/fetch-questions", async (req, res) => {
  try {
    const { data, error } = await supabase.from("questions").select();
    if (error) {
      throw error;
    }

    let randomIndex = Math.floor(Math.random() * data.length);
    // const setQuestions = setLevelQuestions(data);

    // Emit data to all connected clients
    io.emit("question", data[randomIndex]);
    io.emit("timer");

    res.status(200).send(data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  socket.on("createRoom", (callback) => {
    const roomCode = Math.random().toString(36).substring(2, 7);
    socket.join(roomCode);
    userRooms[socket.id] = roomCode;
    console.log(`Room created with code: ${roomCode}`);
    callback(roomCode);
  });

  socket.on("joinRoom", (roomCode, callback) => {
    const room = io.sockets.adapter.rooms.get(roomCode);
    if (room) {
      if (room.size < 2) {
        // Check if the room has less than 2 users
        socket.join(roomCode);
        userRooms[socket.id] = roomCode;
        console.log(`User ${socket.id} joined room ${roomCode}`);
        callback({ success: true });

        // Notify both users when the room has two participants
        if (room.size === 2) {
          io.in(roomCode).emit("roomReady", roomCode);
        }
      } else {
        callback({ success: false, message: "Room is full" });
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

  socket.on("clearStatData", () => {
    statData = {};
  });

  socket.on("clearHasPicked", () => {
    hasPicked = {};
  });

  socket.on("enemyStatChange", (data) => {
    const room = io.sockets.adapter.rooms.get(data.roomCode);
    if (room) {
      statData = {};
      var userName = data.user;
      statData[userName] = { health: data.health, score: data.score };
      io.in(data.roomCode).emit("broadcastStatChange", statData);
    }
  });

  socket.on("sendChoice", (data) => {
    const room = io.sockets.adapter.rooms.get(data.roomCode);
    if (room) {
      var userName = data.uData.username;
      userChoiceList[userName] = {
        choice: data.val,
      };
      hasPicked[userName] = {
        message: data.playerPicked,
      };
      io.in(data.roomCode).emit("showHasPicked", hasPicked);

      if (Object.keys(userChoiceList).length == 2) {
        io.in(data.roomCode).emit("showCorrectChoices", userChoiceList);
      }
    }
  });

  socket.on("clearUserChoiceList", () => {
    userChoiceList = {};
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    console.log(socket.rooms);
    const roomCode = userRooms[socket.id];
    if (roomCode) {
      delete userRooms[socket.id];
      const room = io.sockets.adapter.rooms.get(roomCode);
      if (room && room.size === 1) {
        const remainingUserId = Array.from(room)[0];
        io.to(remainingUserId).emit("winner", "The other user left.");
        console.log(
          `User ${remainingUserId} is the winner by default in room ${roomCode}`
        );
      } else if (!room) {
        console.log(`Room ${roomCode} is now empty`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
