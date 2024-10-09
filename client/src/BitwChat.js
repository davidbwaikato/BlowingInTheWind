import React, {useEffect, useState } from 'react'
import ScrollToBottom from 'react-scroll-to-bottom';

function BitwChat({socket, username, room}) {
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [scoreList, setScoreList] = useState([]);

    const [playAudioBackground, setPlayAudioBackground] = useState(true);
    const [playAudioMusic,      setPlayAudioMusic] = useState(true);
    
    const sendMessage = async () =>{
        if(currentMessage !== "" ){
            const messageData = {
                room: room,
                author: username,
                message: currentMessage,
                time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes(),

            };
            
            await socket.emit("send_message", messageData);
            //enables us to see our own message
            setMessageList((list) => [...list, messageData]);
            //clears the input box after send message
            setCurrentMessage("");
        }
    };

    //event for keypress of enter to send message 
    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            sendMessage();
        }
    };

 //calls functions whenever there is a change either by you or other people on the socket 
    useEffect(() => {
        socket.on("receive_message", (data) => {
        //displays previous list of messages and the new message           
          setMessageList((list) => [...list, data]);
        });
        
        socket.on("update_board", (data) => {
          setScoreList((list) => {
            const index = list.findIndex(player => player.id === data.id);
            if (index !== -1){
              const updatedScores = [...list];
              updatedScores[index].score = data.score;
              return updatedScores;
            } else {
              return [...list, data];
            }
          });
        });
        
        // Cleanup the socket event listener to avoid memory leaks
        return () => {
        socket.off("receive_message");
        socket.off("update_board");
        socket.off("show_player_scores");
    };
    }, [socket]);

    // audio-background and audio-music    

    useEffect(() => {

	const audio_crossfade_in_thresh_perc  = 0.05;
	const audio_crossfade_out_thresh_perc = 1.0 - audio_crossfade_in_thresh_perc;
	const audio_crossfade_out_delta = 1.0 - audio_crossfade_out_thresh_perc;
	
	const crossfade_audio = (audio_elem) => {
	    //console.log("timeudpate");
	    //console.log(audio_elem);
	    
	    const duration = audio_elem.duration;
	    const current_time = audio_elem.currentTime;
	    const progress = current_time / duration;
	    //console.log("Progress = " + progress);
	    
	    if (progress <= audio_crossfade_in_thresh_perc) {
		const crossfade_vol = progress/audio_crossfade_in_thresh_perc;
		//console.log("Fading in: vol = " + crossfade_vol);
		audio_elem.volume = crossfade_vol;
	    }
	    else if (progress >= audio_crossfade_out_thresh_perc) {
		const crossfade_vol = 1.0 - (progress - audio_crossfade_out_thresh_perc)/audio_crossfade_out_delta;
		//console.log("Fading out: vol = " + crossfade_vol);
		audio_elem.volume = crossfade_vol;
	    }
	};
		
	
	console.log('Init Background Audio');
	const audio_background = document.getElementById('audio-background');
	audio_background.volume = 0.0;
		
	audio_background.addEventListener("timeupdate", function() {
	    crossfade_audio(audio_background);
	});

	audio_background.play();
    }, []); // Empty array ensures it runs only once
    
    const togglePlayAudioBackground = () => {
	const audio = document.getElementById('audio-background');
	const toggle_play_icon = document.getElementById('play-audio-background');

	if (playAudioBackground) {
	    audio.muted = true;
	    toggle_play_icon.src = "icons/audio-background-off.svg";
	    setPlayAudioBackground(false);
	}
	else {
	    audio.muted = false;
	    toggle_play_icon.src = "icons/audio-background-on.svg";
	    setPlayAudioBackground(true);
	}
    };
    
    const togglePlayAudioMusic = () => {
	const audio = document.getElementById('audio-music');
	const toggle_play_icon = document.getElementById('play-audio-music');

	if (playAudioMusic) {
	    audio.muted = true;
	    toggle_play_icon.src = "icons/audio-music-off.svg";
	    setPlayAudioMusic(false);
	}
	else {
	    audio.muted = false;
	    toggle_play_icon.src = "icons/audio-music-on.svg";
	    setPlayAudioMusic(true);
	}	
    };

    
    
    return (
        <div className= "chat-window">
            <div className="chat-header">
            <p>
	      Blowin&#x27; in the Wind
	      <img id="play-audio-background" src="icons/audio-background-on.svg" style={{height: '32px'}} alt="Toogle ambient sound"    onClick={togglePlayAudioBackground} />
	      <img id="play-audio-music"      src="icons/audio-music-on.svg"      style={{height: '32px'}} alt="Toggle background music" onClick={togglePlayAudioMusic}/>
	      <span style={{display: 'none'}}>
	        {/* load in display none div, to pre-cache */}
	        <img alt="" src="icons/audio-background-off.svg" style={{height: '32px'}}/>
	        <img alt="" src="icons/audio-music-on.svg"       style={{height: '32px'}}/>
	      </span>
	    </p>
            </div>
            <div className="chat-body">
            <ScrollToBottom className="message-container">
          {messageList.map((messageContent) => {
            return (
              <div
                className="message"
                id={username === messageContent.author ? "you" : "other"}
              >
                <div>
                  <div className="message-content">
                    <p>{messageContent.message}</p>
                  </div>
                  <div className="message-meta">
                    <p id="time">{messageContent.time}</p>
                    <p id="author">{messageContent.author}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </ScrollToBottom>
          </div>
            <div className="chat-footer">
                <input type = "text" 
                value = {currentMessage}
                placeholder = "Type your guess here..."
                 onChange={(event) => {
                    setCurrentMessage(event.target.value);
                   }}
                onKeyPress={handleKeyPress} // Call sendMessage function on Enter key press
                />
                <button onClick={sendMessage}>&#9658;</button>
            </div>
            <div className="leaderboard">
              <h3 className="leaderboard-header">LEADERBOARD</h3>
                  {scoreList.map((scoreContent, index) => {
                    return (
                      <div key={index} className="player-score-div">
                        <span className="player-name">{scoreContent.name}: </span>
                        <span className="player-score">{scoreContent.score}</span>
                      </div>
                    );
                  })}
            </div> 
          </div>
    );
}           

export default BitwChat
