var AppProcess = (function () 
{
  var peers_connection_ids = [];
  var peers_connection = [];
  var remote_vid_stream = [];
  var remote_aud_stream = [];
  var local_div;
  var serverProcess;
  var audio;
  var isAudioMute = true;//Set mic to mute by default when user joins
  var rtp_aud_senders = [];
  var video_states = 
  {
    None: 0,
    Camera: 1,
  };
  var video_st = video_states.None;
  var videoCamTrack;
  var rtp_vid_senders = [];

  async function _init(SDP_function, my_connid) 
  {
    serverProcess = SDP_function;
    my_connection_id = my_connid;
    eventProcess();
    local_div = document.getElementById("locaVideoPlayer");
  }//Function to initialise connection with signalling server

  function eventProcess() 
  {
    $("#miceMuteUnmute").on("click", async function () //Function to Enable/Disable audio on pressing mic button
    {
      if (!audio) 
      {
        await loadAudio();//Function to request user to allow meet webapp to access microphone
      }
      if (!audio) //If user does'nt allow access to microphone , this alert message is shown
      {
        alert("Audio permission has not granted");
        return;
      }
      if (isAudioMute) //Condition to check if user is unmuting
      {
        audio.enabled = true;
        $(this).html(
          "<span class='material-icons' style='width:100%;'>mic</span>"//Changing mic icon to inform user that they are unmuted
        );
        updateMediaSenders(audio, rtp_aud_senders);//Function to add user's audio track to list of media senders
      } 
      else // When user is muting themselves after being unmuted
      {
        audio.enabled = false;
        $(this).html(
          "<span class='material-icons' style='width:100%;'>mic_off</span>"//changing mic icon to inform user that they are muted
        );
        removeMediaSenders(rtp_aud_senders);//Function to remove user's audio track from list of media senders
      }
      isAudioMute = !isAudioMute;//Change state of mic from muted to unmuted or vice versa
    });

    $("#videoCamOnOff").on("click", async function () //This is accessed by clicking html video button to change state of video
    {
      if (video_st == video_states.Camera) 
      {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.Camera);
      }
    });
   
  }
  async function loadAudio() {//This uses webRTC's get user media to get the mic track from user and add it to audioTracks
    try 
    {
      var astream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      audio = astream.getAudioTracks()[0];
      audio.enabled = false;
    } catch (e) {
      console.log(e);
    }
  }

  function connection_status(connection) //This checks if the user is connected or not and checks his state
  {
    if (
      connection &&
      (connection.connectionState == "new" ||
        connection.connectionState == "connecting" ||
        connection.connectionState == "connected")
    ) {
      return true;
    } 
    else 
    {
      return false;
    }
  }
  async function updateMediaSenders(track, rtp_senders) //This function updates the media senders if a new track is added or if a reack is replaced.
  {
    for (var con_id in peers_connection_ids) {
      if (connection_status(peers_connection[con_id])) 
      {
        if (rtp_senders[con_id] && rtp_senders[con_id].track) 
        {
          rtp_senders[con_id].replaceTrack(track);
        } 
        else 
        {
          rtp_senders[con_id] = peers_connection[con_id].addTrack(track);
        }
      }
    }
  }
  function removeMediaSenders(rtp_senders) //This function is used to remove the track if the rtp sender when they exit the meet
  {
    for (var con_id in peers_connection_ids) 
    {
      if (rtp_senders[con_id] && connection_status(peers_connection[con_id])) 
      {
        peers_connection[con_id].removeTrack(rtp_senders[con_id]);
        rtp_senders[con_id] = null;
      }
    }
  }
  function removeVideoStream(rtp_vid_senders)  //This is used to remove the video stream when the user exits the meet or when user switches off camera
  {
    if (videoCamTrack) 
    {
      videoCamTrack.stop();
      videoCamTrack = null;
      local_div.srcObject = null;
      removeMediaSenders(rtp_vid_senders);
    }
  }
  async function videoProcess(newVideoState)  //This function is used to set the video state of the user's video stream
  {
    if (newVideoState == video_states.None) 
    {
      $("#videoCamOnOff").html(
        "<span class='material-icons' style='width:100%;'>videocam_off</span>"
      );
      
      video_st = newVideoState;

      removeVideoStream(rtp_vid_senders);
      return;
    }
    if (newVideoState == video_states.Camera) 
    {
      $("#videoCamOnOff").html(
        "<span class='material-icons' style='width:100%;'>videocam_on</span>"
      );
    }
    try 
    {
      var vstream = null;
      if (newVideoState == video_states.Camera) 
      {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080,
          },
          audio: false,
        });
      } 
      if (vstream && vstream.getVideoTracks().length > 0) 
      {
        videoCamTrack = vstream.getVideoTracks()[0];
        if (videoCamTrack) {
          local_div.srcObject = new MediaStream([videoCamTrack]);
          updateMediaSenders(videoCamTrack, rtp_vid_senders);
        }
      }
    } catch (e) {
      console.log(e);
      return;
    }
    video_st = newVideoState;
    if (newVideoState == video_states.Camera) 
    {
      $("#videoCamOnOff").html(
        '<span class="material-icons" style="width: 100%;">videocam</span>'
      ); 
    } 
  }
  var iceConfiguration = {
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
      {
        urls: "stun:stun1.l.google.com:19302",
      },
    ],
  };//Describes STUN servers to use as signalling servers

  async function setConnection(connid) //This function is used to set a new webRTC connection between peers
  {
    var connection = new RTCPeerConnection(iceConfiguration);

    connection.onnegotiationneeded = async function (event) //This event is fired when a change has occurred which requires session negotiation.
    {
      await setOffer(connid);
    };

    connection.onicecandidate = function (event) //This is called whenever the local ICE agent needs to deliver a message to the other peer through the signaling server
    {
      if (event.candidate) 
      {
        serverProcess(
          JSON.stringify({ icecandidate: event.candidate }),
          connid
        );
      }
    };
    connection.ontrack = function (event) //This is an event handler which specifies a function to be called when the track event occurs, indicating that a track has been added to the RTCPeerConnection
    {
      if (!remote_vid_stream[connid]) 
      {
        remote_vid_stream[connid] = new MediaStream();//If remote vid stream is not already setup , this function does that
      }
      if (!remote_aud_stream[connid]) 
      {
        remote_aud_stream[connid] = new MediaStream();//If remote aud stream is not already setup , this function does that
      }

      if (event.track.kind == "video")  //This loads video player tracks of the user
      {
        remote_vid_stream[connid]
          .getVideoTracks()
          .forEach((t) => remote_vid_stream[connid].removeTrack(t));
        remote_vid_stream[connid].addTrack(event.track);
        var remoteVideoPlayer = document.getElementById("v_" + connid);
        remoteVideoPlayer.srcObject = null;
        remoteVideoPlayer.srcObject = remote_vid_stream[connid];
        remoteVideoPlayer.load();
      } 
      else if (event.track.kind == "audio") //This loads audio player tracks of the user
      {
        remote_aud_stream[connid]
          .getAudioTracks()
          .forEach((t) => remote_aud_stream[connid].removeTrack(t));
        remote_aud_stream[connid].addTrack(event.track);
        var remoteAudioPlayer = document.getElementById("a_" + connid);
        remoteAudioPlayer.srcObject = null;
        remoteAudioPlayer.srcObject = remote_aud_stream[connid];
        remoteAudioPlayer.load();
      }
    };
    peers_connection_ids[connid] = connid;
    peers_connection[connid] = connection;

    if (
      video_st == video_states.Camera 
    ) {
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders); //Updates Camera state to media senders when the videocamtrack is true
      }
    }
    return connection;
  }

  async function setOffer(connid) //This function is used to create offer to connect with other peers and also to set the local description of the user
  {
    var connection = peers_connection[connid];
    var offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    serverProcess(
      JSON.stringify({
        offer: connection.localDescription,
      }),
      connid
    );
  }
  async function SDPProcess(message, from_connid) //This is used to react to the SDPProcess message to establish a successful connection depending on the type of the message(offer or answer)
  {
    message = JSON.parse(message);//Used to parse the SDPProcess message data
    if (message.answer) //If message is an answer , then the peer has responded and we can set their remote description and form connection
    {
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.answer)
      );
    } 
    else if (message.offer) //If the message is of type offer then the peer is trying to establish connection with us.
    {
      if (!peers_connection[from_connid]) //So if the peer does'nt already have their data in peers_connection
      {
        await setConnection(from_connid);//We form a connection with the peer
      }
      await peers_connection[from_connid].setRemoteDescription(
        new RTCSessionDescription(message.offer)//Then we set a remote desctiption with the peer's data
      );
      var answer = await peers_connection[from_connid].createAnswer();//We now use our data to create an answer message which the peer could use to establish connection with us
      await peers_connection[from_connid].setLocalDescription(answer);//We set this as out local description
      serverProcess(
        JSON.stringify({
          answer: answer,
        }),
        from_connid
      );//we send this answer to the peer by stringifying it
    } 
    else if (message.icecandidate) //If the message is of type ice candidate
    {
      if (!peers_connection[from_connid]) //and if the connection is not set
      {
        await setConnection(from_connid);//We set the connection
      }
      try 
      {
        await peers_connection[from_connid].addIceCandidate(
          message.icecandidate //Then we Add ice candidate to peer connection 
        );
      } catch (e) {
        console.log(e);
      }
    }
  }
  async function closeConnection(connid) //This is called when a peer exits out of the meet
  {
    //We de-initialise all variables used up by the exiting peer
    peers_connection_ids[connid] = null;
    if (peers_connection[connid]) 
    {
      peers_connection[connid].close();
      peers_connection[connid] = null;
    }
    if (remote_aud_stream[connid]) 
    {
      remote_aud_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_aud_stream[connid] = null;
    }
    if (remote_vid_stream[connid]) 
    {
      remote_vid_stream[connid].getTracks().forEach((t) => {
        if (t.stop) t.stop();
      });
      remote_vid_stream[connid] = null;
    }
  }
  return {
    setNewConnection: async function (connid) 
    {
      await setConnection(connid);
    },
    init: async function (SDP_function, my_connid) 
    {
      await _init(SDP_function, my_connid);
    },
    processClientFunc: async function (data, from_connid) 
    {
      await SDPProcess(data, from_connid);
    },
    closeConnectionCall: async function (connid) 
    {
      await closeConnection(connid);
    },
  };
})();
var MyApp = (function () {
  var socket = null;
  var user_id = "";
  var meeting_id = "";
  function init(uid, mid) //This initialises the User's side of the app
  {
    user_id = uid;
    meeting_id = mid;
    $("#meetingContainer").show();
    $("#me h2").text(user_id + "(Me)");
    document.title = user_id;
    event_process_for_signaling_server();//This sets up the webRTC P2P connection among peers
    eventHandeling();
  }

  function event_process_for_signaling_server() 
  {
    socket = io.connect();//This connects the user to the socket

    var SDP_function = function (data, to_connid) //This emits the SDPProcess of the user to the socket (SDPProcess is updated in AppProcess)
    {
      socket.emit("SDPProcess", {
        message: data,
        to_connid: to_connid,
      });
    };
    socket.on("connect", () => { //If connect trigger is sent on socket 
      if (socket.connected) 
      {
        AppProcess.init(SDP_function, socket.id);//This function initialises AppProcess with the following parameters to set up the connection
        if (user_id != "" && meeting_id != "") //When userid and meetingid is not null , then we emit that user is successfully connected
        {
          socket.emit("userconnect", {
            displayName: user_id,
            meetingid: meeting_id,
          });
        }
      }
    });
    socket.on("inform_other_about_disconnected_user", function (data) { //This is invoked when a user disconnects from the meet and we have to remove their data and close the connection with them
      $("#" + data.connId).remove();
      $(".participant-count").text(data.uNumber);
      $("#participant_" + data.connId + "").remove();
      AppProcess.closeConnectionCall(data.connId);
    });
    socket.on("inform_others_about_me", function (data) { //This is invoked when server emits inform_others_about_me on the socket
      // We get the data about the newly added user on the server's side and Establish a connection with them
      addUser(data.other_user_id, data.connId, data.userNumber);
      AppProcess.setNewConnection(data.connId);
    });
    
    socket.on("inform_me_about_other_user", function (other_users) {//This is invoked when server emits nform_me_about_other_user on the socket
      //Here we get the entire array of peers in the meet and check if we have already added them as a peer
      //We iterate through every user to check if they have been connected
      var userNumber = other_users.length;
      var userNumb = userNumber + 1;
      if (other_users) 
      {
        for (var i = 0; i < other_users.length; i++) 
        {
          addUser(
            other_users[i].user_id,
            other_users[i].connectionId,
            userNumb
          );
          AppProcess.setNewConnection(other_users[i].connectionId); 
        }
      }
    });
    socket.on("SDPProcess", async function (data) {
      await AppProcess.processClientFunc(data.message, data.from_connid);//This calls SDPFunction in AppProcess to allow peers to  set remote and local descriptions to establish connections
    });
  }
  function eventHandeling() {//This is used to get meeting url and show full screen when user double clicks on other user's video
    var url = window.location.href;
    $(".meeting_url").text(url);

    $("#divUsers").on("dblclick", "video", function () {
      this.requestFullscreen();
    });
  }

  function addUser(other_user_id, connId, userNum) { //This is used to create attributes for a new user 
    //It clones the video box defined in action.html and initialises video and audio attributes 
    // It also makes the user's id show up in people page and increases the participantn count
    var newDivId = $("#otherTemplate").clone();
    newDivId = newDivId.attr("id", connId).addClass("other");
    newDivId.find("h2").text(other_user_id);
    newDivId.find("video").attr("id", "v_" + connId);
    newDivId.find("audio").attr("id", "a_" + connId);
    newDivId.show();
    $("#divUsers").append(newDivId);
    $(".in-call-wrap-up").append(
      '<div class="in-call-wrap d-flex justify-content-between align-items-center mb-3" id="participant_' +
        connId +
        '"> <div class="participant-img-name-wrap display-center cursor-pointer"> <div class="participant-img"> <img src="public/Assets/images/other.jpg" alt="" class="border border-secondary" style="height: 40px;width: 40px;border-radius: 50%;"> </div> <div class="participant-name ml-2"> ' +
        other_user_id +
        '</div> </div> <div class="participant-action-wrap display-center"> </div> </div>'
    );
    $(".participant-count").text(userNum);
  }

  //This is to dynamically change the action.html page defenitions according to users currently in the meet
  $(document).on("click", ".people-heading", function () {
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
    $(this).addClass("active");
    $(".chat-heading").removeClass("active");
  });

  $(document).on("click", ".meeting-heading-cross", function () {
    $(".g-right-details-wrap").hide(300);
  });
  $(document).on("click", ".top-left-participant-wrap", function () {
    $(".people-heading").addClass("active");
    $(".chat-heading").removeClass("active");
    $(".g-right-details-wrap").show(300);
    $(".in-call-wrap-up").show(300);
    $(".chat-show-wrap").hide(300);
  });
  
  $(document).on("click", ".end-call-wrap", function () {
    $(".top-box-show")
      .css({
        display: "block",
      })
      .html(
        '<div class="top-box align-vertical-middle profile-dialogue-show"> <h4 class="mt-3" style="text-align:center;color:white;">Leave Meeting</h4> <hr> <div class="call-leave-cancel-action d-flex justify-content-center align-items-center w-100"> <a href="/action.html"><button class="call-leave-action btn btn-danger mr-5">Leave</button></a> <button class="call-cancel-action btn btn-secondary">Cancel</button> </div> </div>'
      );
  });
  $(document).mouseup(function (e) {
    var container = new Array();
    container.push($(".top-box-show"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).empty();
      }
    });
  });
  $(document).mouseup(function (e) {
    var container = new Array();
    container.push($(".g-details"));
    container.push($(".g-right-details-wrap"));
    $.each(container, function (key, value) {
      if (!$(value).is(e.target) && $(value).has(e.target).length == 0) {
        $(value).hide(300);
      }
    });
  });//mouseup check
  $(document).on("click", ".call-cancel-action", function () {
    $(".top-box-show").html("");
  });
  $(document).on("click", ".copy_info", function () {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(".meeting_url").text()).select();
    document.execCommand("copy");
    $temp.remove();
    $(".link-conf").show();
    setTimeout(function () {
      $(".link-conf").hide();
    }, 3000);
  });
  $(document).on("click", ".meeting-details-button", function () {
    $(".g-details").slideDown(300);
  });
  $(document).on("click", ".g-details-heading-attachment", function () {
    $(".g-details-heading-show").hide();
    $(".g-details-heading-show-attachment").show();
    $(this).addClass("active");
    $(".g-details-heading-detail").removeClass("active");
  });
  $(document).on("click", ".g-details-heading-detail", function () {
    $(".g-details-heading-show").show();
    $(".g-details-heading-show-attachment").hide();
    $(this).addClass("active");
    $(".g-details-heading-attachment").removeClass("active");
  });
  
  var base_url = window.location.origin;
  
  return {
    _init: function (uid, mid) {
      init(uid, mid);
    },
  };
})();
