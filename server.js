const express = require("express");
const path = require("path");
var app = express();
const socket = require('socket.io');
const port = process.env.PORT || 8080; // We set default port as 8080 but if its not available then its dynamically chosen
//starting the server
var server=app.listen(process.env.PORT || 5000,function(){
    console.log("Listening on port ${PORT}`");
  });


const io = require("socket.io")(server, {
  allowEIO3: true, // false by default
});
app.use(express.static(path.join(__dirname, "")));
//-----------------------------------------------------------------------------------------
//Set up server for connecting to socket.io and initialising directory to let users get files from
//the app.
//-----------------------------------------------------------------------------------------
var userConnections = [];//array to keep track of connected users
io.on("connection", (socket) => { //When new user establishes a connection with socket
  console.log("socket id is ", socket.id);
  socket.on("userconnect", (data) => {
    console.log("userconnent", data.displayName, data.meetingid);
    var other_users = userConnections.filter(
      (p) => p.meeting_id == data.meetingid
    );
    userConnections.push({
      connectionId: socket.id,
      user_id: data.displayName,
      meeting_id: data.meetingid,
    });//Pushes the user data to the userConnections array
    var userCount = userConnections.length;//Gets number of users in array

    console.log(userCount);
    other_users.forEach((v) => {
      socket.to(v.connectionId).emit("inform_others_about_me", {
        other_user_id: data.displayName,
        connId: socket.id,
        userNumber: userCount,
      });
    });//Establishes mesh-like connection with each user who is already in the meet
    socket.emit("inform_me_about_other_user", other_users);
  });
  
  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connid).emit("SDPProcess", {
      message: data.message,
      from_connid: socket.id,
    });
  });//Uses SDPProcess data to establish connection with the signalling server

  socket.on("disconnect", function () {//Remove user when they disconnect
    console.log("Disconnected");
    var disUser = userConnections.find((p) => p.connectionId == socket.id);
    if (disUser) {
      var meetingid = disUser.meeting_id;
      userConnections = userConnections.filter(
        (p) => p.connectionId != socket.id
      );
      var list = userConnections.filter((p) => p.meeting_id == meetingid);
      list.forEach((v) => {
        var userNumberAfUserLeave = userConnections.length;
        socket.to(v.connectionId).emit("inform_other_about_disconnected_user", {//Informs other users in meet about disconnected user
          connId: socket.id,
          uNumber: userNumberAfUserLeave,
        });
      });
    }
  });
});



