const path    = require('path');

const express = require("express");
const http    = require("http");
const cors    = require("cors");

const {Server} = require("socket.io");

const utils         = require("./utils");
const gisLocations  = require("./gis-locations");
const llmAssistant  = require("./llm-assistant");
const audioPlaylist = require("./audio-playlist");

var serveindex = require('serve-index')

const SERVER_PORT = process.env.BITW_SERVER_PORT || 3001;
const CLIENT_URL  = process.env.BITW_CLIENT_URL || "http://localhost:3001";

const TargetScore = 5;

const app = express();

app.use(cors());

// Middleware to set the correct MIME type for CSS files
app.use((req, res, next) => {
    if (req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
    }
    next();
});

// Serve static files from the "public" directory
const FullBuildDirectory = path.join(__dirname, '..','client','build');
app.use(express.static(FullBuildDirectory));

var chat = __dirname + '/src';
app.use('/src', serveindex(chat));

//generate a server

cors_origin = CLIENT_URL

const server =  http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: cors_origin,
        methods: ["GET", "POST"],
    },
} );

console.log(`Granting CORS Allow-Origin:`)
console.log(`  ${cors_origin} => [POST,GET]`)


// Initialise data for city locations:
//   'coordinates' are in the form [long,lat,height]

const DefaultFlyingAltitudeMeters = 300.0; // meters

const DefaultStartingLocation = {
    city: "University of Waikato (Hamilton Campus)",
    coordinates: [ 175.3175556, -37.7884167, 100.0]    // A lower altitude works better of the default starting location
};

// For fast hints
//const HintDelayMsecs = 10* 1000;
// Regular speed
const HintDelayMsecs = 20* 1000;


//console.log("*** gisLocations: ", gisLocations.CitiesArray);
const RandomizedCitiesArray = utils.createRandomizedArray(gisLocations.CitiesArray);

// initialise necessary objects
let allPlayers = {};

let cityForEachRoom = {};
let hintsForEachRoom = {};

let cityIndex = 0; 


function resetGuessStates(roomId) {
    // For the players in the given 'roomId' reset their guess state
    
    for (let player in allPlayers) {
        if (allPlayers[player].room === roomId) {
            allPlayers[player].isCorrect = false;
            allPlayers[player].guesses.clear();
        }
    }
}


function startTimerBasedHints(roomId)
{
    let return_status = true;
    
    const hintsJSON = hintsForEachRoom[roomId];    

    if (roomId in  hintsForEachRoom) {
	const timer_id = setInterval(giveNextHint,HintDelayMsecs,roomId);
	hintsJSON.timerId = timer_id;
    }
    else {
	return_status = false;
    }

    return return_status;
}

function stopTimerBasedHints(roomId)
{
    const roomHints = hintsForEachRoom[roomId];
    if (roomHints.timerId != null) {
	clearInterval(roomHints.timerId);
	roomHints.timerId = null;
    }
}

function giveNextHint(roomId)
{
    console.log(`Giving next hint for roomId '${roomId}'`);
    if (!hintsForEachRoom.hasOwnProperty(roomId)) {
	console.log("No users left in room.");
	return;
    }
	
    const roomHints = hintsForEachRoom[roomId];
    
    const countryIndex = roomHints.countryIndex;
    const cityIndex    = roomHints.cityIndex;
    console.log(`  [countryHintIndex=${countryIndex},cityHintIndex=${cityIndex}]`);
    
    if (countryIndex < roomHints['country-hints'].length) {
	const country_hint = roomHints['country-hints'][countryIndex];	
	const countdown = roomHints['country-hints'].length - countryIndex;
	
	const message= (countdown>1) ? `Country Hint #${countdown}: ` + country_hint : country_hint;
	const message_rec = utils.createMessage(roomId,message);
        io.in(roomId).emit("receive_message", message_rec);
	
	roomHints.countryIndex = countryIndex + 1;
    }
    else if (cityIndex < roomHints['city-hints'].length) {
	const city_hint = roomHints['city-hints'][cityIndex];
	const countdown = roomHints['city-hints'].length - cityIndex;

	// inc countdown by 1, to allow for final city anagram hint
	const message= `City Hint #${countdown+1}: ` + city_hint;
	const message_rec = utils.createMessage(roomId,message);
        io.in(roomId).emit("receive_message", message_rec);
	
	roomHints.cityIndex = cityIndex + 1;
    }
    else {

	const city_chars = roomHints.city.split('');
	
	for (let i=city_chars.length-1; i>0; i--) {
	    const j = Math.floor(Math.random() * (i+1));
	    [city_chars[i], city_chars[j]] = [city_chars[j], city_chars[i]];
	}

	const jumbled_city = city_chars.join('');

	const message= `The city is an anagram of '${jumbled_city} `;
	const message_rec = utils.createMessage(roomId,message);
        io.in(roomId).emit("receive_message", message_rec);

	stopTimerBasedHints(roomId);
    }
}

function consumeNextCityForRoom(roomId)
{
    // replace the current city with the next city (cityIndex should be forward at this point)
    const nextCityData = RandomizedCitiesArray[cityIndex];	
    cityForEachRoom[roomId] = nextCityData;
    // increment cityIndex to be at the next globably available city
    cityIndex++;

    return nextCityData;
}

function storeCityHints(hint_city,hint_country,roomId, hintsJSON)
{
    // Callback function from getting LLM Hints
    
    // hintsJSON is a JSON data-structure returned from the LLM
    // It contains two fields: 'country-hints' and 'city-hints', each array of strings

    // Top up 'hintsJSON' with further fields to help with giving out hints
    hintsJSON.city = hint_city; // needed to general anagram/character jumbled version later on
    hintsJSON['country-hints'].push(`The location you are flying over is in the country of ${hint_country}`);
		
    hintsJSON.countryIndex = 0;
    hintsJSON.cityIndex = 0;
		
    hintsForEachRoom[roomId] = hintsJSON;
    console.log(`hintsJSON added for [${roomId}]: `, hintsJSON);
}	    

    
//listen a connection  event from client
//socket is specific to a client  
io.on("connection", (socket) => {
    console.log(`user connected ${socket.id}`);
    //let city = []; // ****

    socket.on("get_starting_location", (callback) => {
	callback = typeof callback == "function" ? callback : () => {};

	console.log("socket.on(get_starting_location):");
	console.log("  returning: ",DefaultStartingLocation);
	callback(DefaultStartingLocation);
    })
    
    //listens from client side if they joined a room - gets data (in this case the room) from that particular client 
    socket.on("join_room", (roomId) => {
	console.log("**** socket.on('join_room'), roomId = ", roomId);
        socket.join(roomId);

        // initialise the allPlayers object for each player
	console.log(`Adding in player with socket.id = ${socket.id}, for roomId=${roomId}`)	   
        allPlayers[socket.id] = {
            room: roomId,
            score: 0,
            isCorrect: false,
            guesses: new Set()
        }

        if (!cityForEachRoom[roomId]) {
	    // First user joining this particular room
            if(cityIndex >= RandomizedCitiesArray.length){ 
		// run out of new city details to issue from the global list
		// => wrap around to beginning issue that one
                cityIndex = 0;
            }
	    else {
		// => store the city details under the roomId, and increment counter
                cityForEachRoom[roomId] = RandomizedCitiesArray[cityIndex];
                cityIndex++;    
            }

            const cityData_for_hints = cityForEachRoom[roomId];
	    const hint_city = cityData_for_hints.city;
	    const hint_country = cityData_for_hints.country;
	    
	    llmAssistant.getLLMHint(hint_city,hint_country, function(hintsJSON) {
		storeCityHints(hint_city,hint_country,roomId, hintsJSON);
	    });
		/*
		// This is the callback function
		// When called, the argument given is the JSON data-structure returned from the LLM
		// It contains two fields: 'country-hints' and 'city-hints', each array of strings

		// Add futher fields to help with giving out hints
		hintsJSON.city = hint_city; // needed to general anagram/character jumbled version later on
		hintsJSON['country-hints'].push(`The location you are flying over is in the country of ${hint_country}`);
		
		hintsJSON.countryIndex = 0;
		hintsJSON.cityIndex = 0;
		
		hintsForEachRoom[roomId] = hintsJSON;
		console.log(`hintsJSON added for [${roomId}]: `, hintsJSON);
	    });	  */  
        }
	
        const cityData = cityForEachRoom[roomId];
	console.log(`Sending city data to newly joined user ${socket.id}: `, cityData);
	socket.emit("append_and_goto_city_data",cityData);
	
        // initialise the cityFotEachRoom object so that each room gets a different city
        console.log(`User with ID ${socket.id} joined room: ${roomId}`);
        console.log(`User ${socket.id} score: ${allPlayers[socket.id].score}`);
    });

    socket.on("start_animation_in_room", (roomId, speed) => {
	console.log(`**** socket.on('start_animation_in_room'), roomId=${roomId}, speed=${speed}`);

	if (startTimerBasedHints(roomId)) {
	    // socket-client already animating, so only need to let others in the room know
	    socket.to(roomId).emit("auto_start_animation", speed);
	}
	else {
	    console.log("Hints data not yet available ... pausing animation");
	    io.in(roomId).emit("pause_animation");
	}
	
    });


    socket.on("start_speedchange_in_room", (roomId, speed) => {
	console.log(`**** socket.on('start_speedchange_in_room'), roomId=${roomId}, speed=${speed}`);

	socket.to(roomId).emit("auto_change_speed", speed);		
    });

    
    socket.on("move_to_next_city", (roomId) => {
	console.log(`**** socket.on('move_to_next_city'), roomId=${roomId}`);

	// **** refactor candidate **** !!!!
	
	stopTimerBasedHints(roomId);

	if (cityIndex >= RandomizedCitiesArray.length) {
	    // Or is this a condition that should signal the end of the game?? // ****
            // set index back to the first city
            cityIndex = 0;
        }

	const nextCityData = consumeNextCityForRoom(roomId);
        io.in(roomId).emit("append_and_goto_city_data", nextCityData);
			
        console.log(`New stored city data for roomId '${roomId}'`,cityForEachRoom[roomId]);

	// Start up hints for the new city
	const hint_city = nextCityData.city;
	const hint_country = nextCityData.country;
		    
	llmAssistant.getLLMHint(hint_city,hint_country, function(hintsJSON) {
	    storeCityHints(hint_city,hint_country,roomId, hintsJSON);
	    startTimerBasedHints(roomId);			
	});

	resetGuessStates(roomId);
    });
    
    //listens from the client side the send_message event
    socket.on("send_message", (data) => {
	console.log("socket.on('send_message') for roomId: " + data.room);
	
	const roomId = data.room;
        let currentCity = cityForEachRoom[roomId].city;
        let player = allPlayers[socket.id];

        // check if the player's guess already exists in their set
	//console.log("**** Player info: ", player);
	//console.log("**** Socket data: ", data);
        if (player.guesses.has(data.message.toLowerCase())) {
	    const correctMsg = utils.createMessage(roomId, `You has already correctly guessed this location.`);
            socket.emit("receive_message", correctMsg);
        }
        else if (data.message.toLowerCase() == currentCity.toLowerCase()) {
	    // The sent mesage is a correct guess by (one of) the users

            // increment player score by 1
            player.score++;
            // add the user's correct guess to their set
            player.guesses.add(data.message);
            // set player's isCorrect to true
            player.isCorrect = true;

            console.log("**** allPlayers:", allPlayers);
	    const correctMsg = utils.createMessage(roomId, `${data.author} guessed correctly!`);	    
            io.in(roomId).emit("receive_message", correctMsg);

	    const isCorrectCount = getCorrectCount(roomId);
            // get the number of players for each room
            //let allRooms = getRoomCount();
	    const numInRoom = getRoomCount(roomId);

	    console.log("**** isCorrectCount = " + isCorrectCount);
	    console.log("**** numInRoom = ", numInRoom);
	    
	    if (isCorrectCount == 1) {
		// First person to guess
		// => get a bonus point
		player.score++;
		
		// => start countdown clock
		if (numInRoom > 1) {
                    io.in(roomId).emit("start_timer");
		}
		socket.emit("correct_guess", true); // (true => and was first to guess correct)
	    }
	    else {
		socket.emit("correct_guess", false); // (false => but not the first guess)
	    }

	    // Check to see if this means someone has won
	    if (checkForWinner(roomId,TargetScore)) {
		// send update score, and then send message declaring a winner

		let playerScore = {
		    id: socket.id,
		    name: data.author,
		    score: player.score,
		};

		io.in(roomId).emit("update_board", playerScore);

		// Give the client time to update the scoreboard, before declaring the winner in an alert box
		setTimeout(function() { io.in(roomId).emit("we_have_a_winner",data.author,TargetScore) }, 1000);
		
	    }
	    
	    if (isCorrectCount == numInRoom) { 
                // if the cityIndex is more than or equal to the length of the cities array
                if (cityIndex >= RandomizedCitiesArray.length) {
		    // Or is this a condition that should signal the end of the game?? // ****
                    // set index back to the first city
                    cityIndex = 0;
                }
		
		// Everyone one has guessed correctly
		// => (i) stop hinting and (ii) go to next city
		
		// **** refactor candidate **** !!!!
		
		stopTimerBasedHints(roomId);
		
		const nextCityData = consumeNextCityForRoom(roomId);		    
                io.in(roomId).emit("append_and_goto_city_data", nextCityData);
		
                console.log(cityForEachRoom[roomId]);
		
		// Start up hints for the new city
		const hint_city = nextCityData.city;
		const hint_country = nextCityData.country;
		
		llmAssistant.getLLMHint(hint_city,hint_country, function(hintsJSON) {
		    storeCityHints(hint_city,hint_country,roomId, hintsJSON);
		    startTimerBasedHints(roomId);			
		});		    
		
		resetGuessStates(roomId);
            }
        }
	else {
            socket.to(roomId).emit("receive_message", data);
        }

        let playerScore = {
            id: socket.id,
            name: data.author,
            score: player.score,
        };

        io.in(roomId).emit("update_board", playerScore);
    });


    // ****
    // Are 'get_city' and 'send_city' every used??
    
    socket.on("get_city", (data) => {
        console.log(data);
        console.log(cityToSend);
        if (cityToSend[socket.id]) {
            socket.emit("send_city", cityToSend[socket.id]);
        } else {
            socket.emit("send_city", "City not set yet");
        }
    })

    socket.on("disconnect", (unusedData) =>{
        console.log("user disconnect", socket.id);

	const player = allPlayers[socket.id];

	if (player) {
	    // 'player' might not exist if the server has been restarte
	    const roomId = player.room;
	    
	    const num_in_room = getRoomCount(roomId);
	    
            delete allPlayers[socket.id];
	    
	    if (num_in_room == 1) {
		// i.e., this is the last player in the room
		// => delete the all the data associated with this room
		console.log(`Last player in roomId '${roomId}' => deleting allocated city data for room`);
		stopTimerBasedHints(roomId);		
		delete cityForEachRoom[roomId];
		delete hintsForEachRoom[roomId];
	    }
	}
    });

    // **** Move to earlier in file, or turn into module
    function getAllRoomCounts() {
	console.log("**** getAkkRoomCounts(), allPlayers: ", allPlayers);
        let roomCounts = {};
        for (let player in allPlayers){
            let room = allPlayers[player].room;
            if (roomCounts[room]){
                roomCounts[room].count++;
            } else {
                roomCounts[room] = { count: 1 };
            }
        }

        return roomCounts;
    }

    function getRoomCount(roomId) {
	console.log("**** getRoomCount(), roomId " + roomId);
        let roomCount = 0;
	
        for (let player in allPlayers){
            let check_roomId = allPlayers[player].room;
	    if (check_roomId == roomId) {
		roomCount++;
	    }
        }

        return roomCount;
    }

    function getCorrectCount(roomId) {
        let isCorrectCount = 0;
        let playerKeys = Object.keys(allPlayers);
	
        for (let i=0; i<playerKeys.length; i++) { 
            let playerKey = playerKeys[i];
            let player = allPlayers[playerKey];
            if (player.room === roomId && player.isCorrect) {
                isCorrectCount++;
            }
        }

	return isCorrectCount;
    }


    function checkForWinner(roomId,scoreToReach) {
	console.log("**** checkForWinner(), roomId " + roomId);

	let foundWinner = false;
		
        for (let player in allPlayers){
            let check_roomId = allPlayers[player].room;
	    if (check_roomId == roomId) {
		if (allPlayers[player].score >= scoreToReach) {
		    foundWinner = true;
		    break;
		}
	    }
        }

        return foundWinner;
    }
    
});

    

app.get('/get-audio-music-playlist', (req, res) => {

    res.setHeader("Content-Type", "application/json");

    mp3_filelist_rec = audioPlaylist.readMP3Filelist(FullBuildDirectory,"weather-playlist");
    
    res.end(JSON.stringify(mp3_filelist_rec));
})

app.get('/get-audio-background-playlist', (req, res) => {

    res.setHeader("Content-Type", "application/json");

    mp3_filelist_rec = audioPlaylist.readMP3Filelist(FullBuildDirectory,"ambient-background");
    
    res.end(JSON.stringify(mp3_filelist_rec));
})


app.get('/chatgpt-simple-test', async (req,res) => {

    const message_response = await llmAssistant.getLLMResponseOneShot("What is the capital of England?");    
    const message_response_str = JSON.stringify(message_response);

    res.setHeader("Content-Type", "application/json");    
    res.end(message_response_str);    
})



app.get('/get-llm-hint-london', async (req,res) => {

    const message_response = await llmAssistant.getLLMHintLondon();
    const message_response_str = JSON.stringify(message_response);

    res.setHeader("Content-Type", "application/json");    
    res.end(message_response_str);
})


app.get('/get-llm-hint', async (req,res) => {
    const message_response = await llmAssistant.getLLMHintSync(req.query.city,req.query.country);
    const message_response_str = JSON.stringify(message_response);

    res.setHeader("Content-Type", "application/json");    
    res.end(message_response_str);
    
})


server.listen(SERVER_PORT, ()=> {
    console.log(`Web + Socket.IO server running on port ${SERVER_PORT}`);
});
