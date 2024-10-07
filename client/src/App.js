import { useState } from 'react';
import './App.css';
import BitwChat from './BitwChat';
import socket from './SocketInstance';


function App() {
  //initialises user and room state 
  const [username, serUserName] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);

  const joinRoom = async () => {
    if (username !== "" && room !== "") {
	socket.emit("join_room", room);
	console.log("**** Away to call window.joinRoom().  This seems to duplicate the socket.emit('join_room') call");
	window.joinRoom(room);
	setShowChat(true);
    }
  };

  return (
    <div className="App">
      {/* shows the chat only when show chat is set to true */}
      {!showChat ? (
      <div className = "joinChatContainer">
      <h3>Join Game</h3>
      <input type = "text" placeholder = "Enter Name ..." 
      //whenever the user changes their input, it also changes the username in the username state
       onChange={(event) => {
        serUserName(event.target.value);
       }}/>

      <input type = "text" placeholder = "Room ID ..." 
      //whenever the user changes their input, it also changes the username in the username state
	  onChange={(event) => {
	      //console.log("room id change")
           setRoom(event.target.value);
          }}
	  onKeyUp={(event) => {
	      console.log("room id key up");
	      console.log(event);	      
	      if (event.keyCode === 13 || event.which === 13) {
		  joinRoom();
	      }
	  }}	  
	 />
      
      <button onClick={joinRoom}>Start/Join a Game</button>
      </div>
      ) : (
       
       <BitwChat socket={socket} username={username} room={room} />
  )}
    </div>
  );
}

export default App;
