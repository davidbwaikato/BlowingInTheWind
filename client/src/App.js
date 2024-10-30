import { useState, useEffect } from 'react';

import './App.css';

import BitwChat from './BitwChat';
import bitw_socket from './SocketInstance';
//import { bitw_io, bitw_socket } from './SocketInstance';

function App() {
  //initialises user and room state 
  const [username, serUserName] = useState("");
  const [room, setRoom] = useState("");
  const [showChat, setShowChat] = useState(false);

  const joinRoom = async () => {
    if (username !== "" && room !== "") {
	console.log("**** away to socket.emit('join_room') with socket: ", bitw_socket);
	bitw_socket.emit("join_room", room);
	window.bitws_setRoomId(room);
	
	setShowChat(true);
    }
  };
    
  useEffect(() => {
      window.onload = function() {
	  console.log("**** App.js window.onload() calling bitws_registerSocketOn() and bitws_initStartngLocation()");
	  window.bitws_registerSocketOn(bitw_socket);
	  window.bitws_initStartingLocation(bitw_socket);
      }      
  }, []);
    
	
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
           setRoom(event.target.value);
          }}
	  onKeyUp={(event) => {
	      if (event.key === 'Enter') {
	      //if (event.keyCode === 13 || event.which === 13) {
		  joinRoom();
	      }
	  }}	  
	 />
      
      <button onClick={joinRoom}>Start/Join a Game</button>
      </div>
      ) : (
       
       <BitwChat socket={bitw_socket} username={username} room={room} />
  )}
    </div>
  );
}

export default App;
