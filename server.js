// Setup basic express server
// const { default: axios } = require("axios");
const express = require("express");
const Redis = require("ioredis");
const redis = new Redis({
  host: "devcs.co.kr",
  port: 10038,
  password: "",
});
const app = express();
const path = require("path");
const server = require("http").createServer(app);
const io = require("socket.io")(server, { cors: { origin: "*" } });
const port = process.env.PORT || 3001;
/**
 * Listen on provided port, on all network interfaces.
 */

const CHAT_EVENT = {
  SEND_MESSAGE: "send message",
  RECEIVED_MESSAGE: "received message",
  JOIN_ROOM: "join room",
  CREATE_ROOM: "create room",
  SEND_PROFILE: "send profile",
  LEAVE_ROOM: "leave room",
  RECEIVED_ALERT: "received alert",
  GET_ALERT_COUNT: "get alert count",
  SEND_ALERT_COUNT: "send alert count",
  READ_ALERT: "read alert",
  SEND_ALERT: "send alert",
};

let user_list = [];

io.listen(port, () => {
  console.log("Server listening at port %d", port);
});

// Routing
// app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log(`connect : ${socket.id}`);

  // redis.hget("admin", "db3f4c8a-995b-41a3-92c8-fc7846ecc265").then((value) => {
  //   console.log("Hash Value:", value);
  // });
  // when the client emits 'new message', this listens and executes
  socket.on(CHAT_EVENT.JOIN_ROOM, ({ roomId }) => {
    console.log(`room join : ${roomId}`);
    socket.join(roomId);
  });

  socket.on(CHAT_EVENT.SEND_MESSAGE, (data) => {
    io.to(data.roomId).emit(CHAT_EVENT.RECEIVED_MESSAGE, data);
    socket.broadcast.emit(CHAT_EVENT.RECEIVED_ALERT);
  });

  socket.on(CHAT_EVENT.SEND_PROFILE, (data) => {
    !user_list.find((user) => user.nickname === data.nickname) &&
      user_list.push({
        nickname: data.nickname,
        socketId: socket.id,
      });
  });

  socket.on(CHAT_EVENT.GET_ALERT_COUNT, ({ nickname }) => {
    redis.llen(nickname, (err, len) => {
      if (err) {
        console.log(err);
      } else {
        io.to(socket.id).emit(CHAT_EVENT.SEND_ALERT_COUNT, {
          count: len,
        });
      }
    });
  });

  socket.on(CHAT_EVENT.READ_ALERT, ({ nickname }) => {
    redis.lrange(nickname, 0, -1, (err, values) => {
      if (err) console.log(err);
      else {
        const data = values.map((value) => JSON.parse(value));
        console.log(nickname);
        if (data.length > 1) {
          redis.ltrim(nickname, -1, 0, (err, response) => {
            if (err) {
              console.error(err);
            } else {
              console.log("List cleared:", response);
            }
          });
        } else {
          redis.lpop(nickname, (err, response) => {
            if (err) {
              console.error(err);
            } else {
              console.log("1 elem cleared:", response);
            }
          });
        }
        io.to(socket.id).emit(CHAT_EVENT.SEND_ALERT, data.reverse());
        io.to(socket.id).emit(CHAT_EVENT.RECEIVED_ALERT);
      }
    });
  });
  socket.on(CHAT_EVENT.LEAVE_ROOM, ({ roomId }) => {
    socket.leave(roomId);
  });

  socket.on("new message", (data) => {
    console.log(`${socket.username} : ${data}`);
    // we tell the client to execute 'new message'
    socket.broadcast.emit("new message", {
      username: socket.username,
      message: data,
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on("add user", (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    console.log("connected : " + socket.id + " num : " + numUsers);
    addedUser = true;
    socket.emit("login", {
      numUsers: numUsers,
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit("user joined", {
      username: socket.username,
      numUsers: numUsers,
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on("typing", () => {
    socket.broadcast.emit("typing", {
      username: socket.username,
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on("stop typing", () => {
    socket.broadcast.emit("stop typing", {
      username: socket.username,
    });
  });

  // when the user disconnects.. perform this
  socket.on("disconnect", () => {
    console.log(`disconnect`);
    user_list = user_list.filter((user) => user.socketId !== socket.id);
    console.log(user_list);
  });
});

// var os = require("os");
// var nodeStatic = require("node-static");
// var http = require("https");
// var socketIO = require("socket.io");
// const fs = require("fs");

// const options = {
//   key: fs.readFileSync("./private.pem"),
//   cert: fs.readFileSync("./public.pem"),
// };

// var fileServer = new nodeStatic.Server();
// var app = http
//   .createServer(options, function (req, res) {
//     fileServer.serve(req, res);
//   })
//   .listen(7777);
