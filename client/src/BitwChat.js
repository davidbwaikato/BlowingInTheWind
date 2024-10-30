import React, {useEffect, useState, useCallback } from 'react'
import ScrollToBottom from 'react-scroll-to-bottom';

import config from "./config.js";

const SERVER_URL = config.SERVER_URL || "http://localhost:3001";

function BitwChat({socket, username, room}) {
    
    const [currentMessage, setCurrentMessage] = useState("");
    const [messageList, setMessageList] = useState([]);
    const [scoreList, setScoreList] = useState([]);

    const [playAudioBackground, setPlayAudioBackground] = useState(true);
    const [playAudioMusic,      setPlayAudioMusic] = useState(true);
    
    const sendMessage = async () =>{
        if(currentMessage !== "" ){
	    const date_now = new Date();
	    const hours = date_now.getHours();
	    const mins  = date_now.getMinutes();
	    
	    const time_str = hours + ":" + String(mins).padStart(2,"0");
	    const message_num = messageList.length + 1;
	    const key = "message-"+message_num;
            const messageData = {
                room:    room,
                author:  username,
                message: currentMessage,
		time:    time_str,
		key:     key

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

    const getTrackInfo = (mp3_track_url) => {
	const mp3_track_url_tail = mp3_track_url.substring(mp3_track_url.lastIndexOf('/')+1)	
	const track_name_raw = decodeURI(mp3_track_url_tail);
	const track_name = track_name_raw.replace(/\.mp3$/i,"").replace(/\s*(\(|\[).*$/,"");

	let track_info = { 'track': track_name };

	if (track_name.lastIndexOf('-')>0) {
	    const track_breakdown = track_name.split(/\s*-\s*/);

	    const artist = track_breakdown[0];
	    const song   = track_breakdown[1];
	    track_info.artist = artist;
	    track_info.song = song;
	    
	}
	
	/*
	const track_breakdown = track_name.match(/^\s*(.+)+\s*-\s*(.+)\s*$/)

	if (track_breakdown) {
	    const artist = track_breakdown[1];
	    const song   = track_breakdown[2];
	    track_info.artist = artist;
	    track_info.song = song;
	}
	*/
	return track_info;
    }
    
		    
    const startPlaylist = useCallback((json_data,audio_elem,max_vol,title_id) => {

	const audio_crossfade_in_thresh_perc  = 0.05;
	const audio_crossfade_out_thresh_perc = 1.0 - audio_crossfade_in_thresh_perc;
	const audio_crossfade_out_delta = 1.0 - audio_crossfade_out_thresh_perc;
	
	const crossfade_audio = (cf_audio_elem, max_vol) => {
	    
	    const duration = cf_audio_elem.duration;
	    const current_time = cf_audio_elem.currentTime;
	    const progress = current_time / duration;
	    
	    if (progress <= audio_crossfade_in_thresh_perc) {
		const crossfade_vol = progress/audio_crossfade_in_thresh_perc;
		cf_audio_elem.volume = max_vol * crossfade_vol;
	    }
	    else if (progress >= audio_crossfade_out_thresh_perc) {
		const crossfade_vol = 1.0 - (progress - audio_crossfade_out_thresh_perc)/audio_crossfade_out_delta;
		cf_audio_elem.volume = max_vol * crossfade_vol;
	    }
	};
	
	let playlist_info = {
	    server_url  : SERVER_URL,
	    prefix_path : json_data['url-path-prefix'],
	};
	
	let mp3_filelist = json_data['mp3-filelist']
	
	let playlist = []
	
	for (const mp3_file of mp3_filelist) {
	    const mp3_url = playlist_info.server_url + playlist_info.prefix_path + "/" + mp3_file;
	    const track_info = getTrackInfo(mp3_url);
	    
	    const playlist_item = { url: mp3_url, track_info: track_info }
	    playlist.push(playlist_item);			
	}
	
	console.log("Setup music playlist");
	playlist_info.playlist = playlist;
	//console.log("Playlist info: ", JSON.stringify(playlist_info));
	
	if (playlist.length > 0) {
	    audio_elem.addEventListener("loadeddata", () => {
		audio_elem.play();
	    });
	    
	    audio_elem.addEventListener("timeupdate", function() {
		crossfade_audio(audio_elem,max_vol);
	    });

	    let playlist_pos = 0;
	    audio_elem.addEventListener("ended", function() {
		console.log("Audio ended");
		playlist_pos = (playlist_pos + 1) % playlist.length;
		const mp3_url = playlist[playlist_pos].url;
		console.log("Selecting next track: ", playlist[playlist_pos].track_info)
		if ((title_id) && (title_id != null)) {
		    const alt_tag_elem = document.getElementById(title_id);
		    alt_tag_elem.title = playlist[playlist_pos].track_info.track;
		}
		
		audio_elem.src = mp3_url;
		// Add track as tooltip on play/mute button
	    });

	    // Start the first track playing
	    const mp3_url = playlist[0].url;
	    console.log("Selected track: ", playlist[0].track_info)
	    if ((title_id) && (title_id != null)) {
		const alt_tag_elem = document.getElementById(title_id);
		alt_tag_elem.title = playlist[0].track_info.track;
	    }
	    audio_elem.src = mp3_url;
	    // Add track tooltip on play/mute button
	}
    }, []);
    
    //calls functions whenever there is a change either by you or other people on the socket 
    useEffect(() => {
        socket.on("receive_message", (data) => {
            //displays previous list of messages and the new message
	    const is_paused = window.isPaused();
	    //console.log("**** @@@@@@ is_paused: ", is_paused);
	    
	    if (window.isPaused()) {
		// If a hint, only allow through if the last one (the anagram)
		if (data.message.startsWith("Country Hint #") || data.message.startsWith("City Hint #")) {
		    if (data.message.startsWith("City hint #1")) {
			// Let the last one through
			setMessageList((list) => [...list, data]);			
		    }
		}
		else {
		    setMessageList((list) => [...list, data]);
		}
	    }
	    else {
		setMessageList((list) => [...list, data]);
	    }
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
          socket.off("show_player_scores"); // **** can this used??
	};
    }, [socket]);

    // audio-background and audio-music    

    useEffect(() => {
	
	console.log('Initialising ambient background audio');
	const audio_background = document.getElementById('audio-background');
	audio_background.volume = 0.0;

	fetch(SERVER_URL+'/get-audio-background-playlist')
	    .then((res) => {
		return res.json();
	    })
	    .then((json_data) => {
		if (json_data['status'] === "ok") {
		    startPlaylist(json_data,audio_background,1.0,null);
		}
	    });
	
	console.log('Initialising music playlist');
	const audio_music = document.getElementById('audio-music');	
	audio_music.volume = 0.0;
		

	// Fetch playlist
	// Note: this may return no songs, if none have been added to the server
	
	fetch(SERVER_URL+'/get-audio-music-playlist')
	    .then((res) => {
		return res.json();
	    })
	    .then((json_data) => {
		if (json_data['status'] === "ok") {
		    startPlaylist(json_data,audio_music,0.3,"play-audio-music");
		}
	    });

    }, [startPlaylist]); // Empty array ensures it runs only once
    
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
	const audio_music = document.getElementById('audio-music');
	const toggle_play_icon = document.getElementById('play-audio-music');

	if (playAudioMusic) {
	    audio_music.muted = true;
	    toggle_play_icon.src = "icons/audio-music-off.svg";
	    setPlayAudioMusic(false);
	}
	else {
	    audio_music.muted = false;
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
            {messageList.map((messageContent,i) => {
            return (
              <div
                className="message"
		key={`message-${i}`}
                id={username === messageContent.author ? "you" : "other"}
              >
                <div key={`message-pair-${i}`}>
                  <div className="message-content" key={`message-content-${i}`}>
                    <p key={`message-content-p-${i}`}>{messageContent.message}</p>
                  </div>
                  <div className="message-meta" key={`message-meta-${i}`}>
                    <p id="time"   key={`message-meta-time-${i}`}>{messageContent.time}</p>
                    <p id="author" key={`message-meta-author-${i}`}>{messageContent.author}</p>
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
                placeholder = "Chat or guess the city here..."
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
