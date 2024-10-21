const path    = require('path');

const express = require("express");
const http    = require("http");
const cors    = require("cors");

const {Server} = require("socket.io");

const utils         = require("./utils");
const llmAssistant  = require("./llm-assistant");
const audioPlaylist = require("./audio-playlist");

var serveindex = require('serve-index')


const SERVER_PORT = process.env.BITW_SERVER_PORT || 3001;
const CLIENT_URL  = process.env.BITW_CLIENT_URL || "http://localhost:3001";

BITW_APP_NAME = "BITW";

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

const HintDelayMsecs = 10* 1000;

const CitiesArray = [
    { city: "Auckland",      country: "New Zealand", coordinates: [ 174.763336,  -36.848461, 300.0]},
    { city: "Rome",          country: "Italy",       coordinates: [  12.496366,   41.902782, 300.0]},
    { city: "Paris",         country: "France",      coordinates: [   2.349014,   48.864716, 300.0]},
    { city: "Tokyo",         country: "Japan",       coordinates: [ 139.817413,   35.672855, 300.0]},
    //{ city: "Dubai",         country: "",            coordinates: [  55.296249,   25.276987, 300.0]},
    { city: "Hamilton",      country: "New Zealand", coordinates: [ 175.269363,  -37.781528, 300.0]},
    { city: "Toronto",       country: "Canada",      coordinates: [ -79.384293,   43.653908, 300.0]},
    { city: "Sydney",        country: "Australia",   coordinates: [ 151.209900,  -33.865143, 300.0]},
    { city: "San Francisco", country: "USA",         coordinates: [-122.431297,   37.773972, 300.0]},
    { city: "New York",      country: "USA",         coordinates: [ -73.935242,   40.730610, 300.0]},
    //{ city: "Seoul",         country: "South Korea", coordinates: [ 127.024612,   37.532600, 300.0]},
    //{ city: "New Delhi",     country: "India",       coordinates: [  77.216721,   28.644800, 300.0]},
    { city: "Barcelona",     country: "Spain",       coordinates: [   2.154007,   41.390205, 300.0]},
    { city: "Athens",        country: "Greece",      coordinates: [  23.727539,   37.983810, 300.0]},
    { city: "Budapest",      country: "Hungary",     coordinates: [  19.040236,   47.497913, 300.0]},
    //{ city: "Moscow",        country: "Russia",      coordinates: [  37.618423,   55.751244, 300.0]},
    //{ city: "Cairo",         country: "Egypt",       coordinates: [  31.233334,   30.033333, 300.0]},
    { city: "Copenhagen",    country: "Denmark",     coordinates: [  12.568337,   55.676098, 300.0]},
    { city: "London",        country: "England",     coordinates: [  -0.118092,   51.509865, 300.0]},
] 

// Method for shuffling an array
//   https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
/*
function shuffleArray(array){
    let currentIndex = array.length;
    while(currentIndex != 0){
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}
*/

// shuffle cities array
let shuffledCitiesArray = [...CitiesArray]
utils.shuffleArray(shuffledCitiesArray);

// initialise necessary objects
let allPlayers = {};

let cityForEachRoom = {};
let hintsForEachRoom = {};

let cityIndex = 0; 

function getTimeStamp()
{
    const date_now = new Date();
    const hours = date_now.getHours();
    const mins  = date_now.getMinutes();
    
    const time_str = hours + ":" + String(mins).padStart(2,"0");

    return time_str;
}


function createMessageTemplate(roomId)
{
    const time_str = getTimeStamp();
				   
    let message_template = {
        room: roomId,
        author: 'BITW Assistant',
        message: null,
	time: time_str
    };

    return message_template;
}

function giveNextHint(roomId)
{
    console.log("**** giveNextHint() from roomId: " + roomId);
    
    const roomHints = hintsForEachRoom[roomId];
    
    const countryIndex = roomHints.countryIndex;
    const cityIndex    = roomHints.cityIndex;
    
    if (countryIndex < roomHints['country-hints'].length) {
	const country_hint = roomHints['country-hints'][countryIndex];	
	const countdown = roomHints['country-hints'].length - countryIndex;
	
	let message = createMessageTemplate(roomId);
	message.message = `Country Hint #${countdown}: ` + country_hint;
        io.in(roomId).emit("receive_message", message);
	
	roomHints.countryIndex = countryIndex+ 1;
    }
    else if (cityIndex < roomHints['city-hints'].length) {
	const city_hint = roomHints['city-hints'][cityIndex];
	const countdown = roomHints['city-hints'].length - cityIndex;

	let hint_message = createMessageTemplate(roomId);
	hint_message.message = `City Hint #${countdown}: ` + city_hint;
        io.in(roomId).emit("receive_message", hint_message);
	
	roomHints.cityIndex = cityIndex+ 1;
    }
    else {
	console.log("Time to send the anagram/word jumble");
    }
}

function startTimerBasedHints(roomId)
{
    const timer_id = setInterval(giveNextHint,HintDelayMsecs,roomId);

    return timer_id;
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
    socket.on("join_room", (roomIdData) => {
	console.log("**** socket.on('join_room'), roomIdData = ", roomIdData);
        socket.join(roomIdData);

        // initialise the allPlayers object for each player
	console.log(`Adding in player with socket.id = ${socket.id}, for roomIdData=${roomIdData}`)	   
        allPlayers[socket.id] = {
            room: roomIdData,
            score: 0,
            isCorrect: false,
            guesses: new Set()
        }

        if (!cityForEachRoom[roomIdData]) {
	    // First user joining this particular room
            if(cityIndex >= shuffledCitiesArray.length){ 
		// run out of new city details to issue from the global list
		// => wrap around to beginning issue that one
                cityIndex = 0;
            }
	    else {
		// => store the city details under the roomIdData, and increment counter
                cityForEachRoom[roomIdData] = shuffledCitiesArray[cityIndex];
                cityIndex++;    
            }

            const cityData_for_hints = cityForEachRoom[roomIdData];
	    console.log("**** cityData_for_hints = ", cityData_for_hints);
	    
	    llmAssistant.getLLMHint(cityData_for_hints.name,cityData_for_hints.country, function(hintsJSON) {
		// contains two fields: 'country-hints' and 'city-hints'
		hintsJSON.countryIndex = 0;
		hintsJSON.cityIndex = 0;
		
		hintsForEachRoom[roomIdData] = hintsJSON;
		console.log("***** away to start timer based hints");
		hintsJSON.timerId = startTimerBasedHints(roomIdData);
	    });
	    
        }
	
        //city = cityForEachRoom[roomIdData]; // ****
        const cityData = cityForEachRoom[roomIdData];
        //console.log(`Sending city data to room ${roomIdData}`, cityData);
        //io.to(roomIdData).emit("city_data", cityData);

	console.log(`Sending city data to newly joined user ${socket.id}: `, cityData);
	socket.emit("city_data",cityData);
	
        // initialise the cityFotEachRoom object so that each room gets a different city
        console.log(`User with ID ${socket.id} joined room: ${roomIdData}`);
        console.log(`User ${socket.id} score: ${allPlayers[socket.id].score}`);

    });


    //listens from the client side the send_message event
    socket.on("send_message", (data) =>{
        let currentCity = cityForEachRoom[data.room].city;
        let player = allPlayers[socket.id];

	// *****
	//const date_now = new Date();
	//const hours = date_now.getHours();
	//const mins  = date_now.getMinutes();
	
	//const time_str = getTimeStamp();
				   
        //let correctMsg = {
        //    room: data.room,
        //    author: 'BITW Assistant',
        //    message: `${data.author} guessed correctly!`,
	//    time: time_str
        //};

	let correctMsg = createMessageTemplate(data.room);
	correctMsg.message = `${data.author} guessed correctly!`;
		
        // check if the player's guess already exists in their set
	console.log("**** player: ", player);
	console.log("**** data: ", data);
        if (player.guesses.has(data.message.toLowerCase())) {
            correctMsg.message = `${data.author} has already guessed correctly.`;
            
            io.in(data.room).emit("receive_message", correctMsg);
        }
        else if (data.message.toLowerCase() == currentCity.toLowerCase()) {
            // increment player score by 1
            player.score++;
            // add the user's correct guess to their set
            player.guesses.add(data.message);
            // set player's isCorrect to true
            player.isCorrect = true;

            console.log(allPlayers);
            io.in(data.room).emit("receive_message", correctMsg);

            let isCorrectCount = 0;
            let playerKeys = Object.keys(allPlayers);

            //for (let i = 0; i < playerKeys.length; i += 2) {  // ****
            for (let i = 0; i < playerKeys.length; i++) {  // ****		
                let playerKey = playerKeys[i];
                let player = allPlayers[playerKey];
                if (player.room === data.room && player.isCorrect) {
                    isCorrectCount++;
                }
            }

            // get the number of players for each room
            let allRooms = getRoomCount();
            // check if the room exists 
            if(allRooms[data.room]){
                // if everyone in the room has guessed correct
                //if (isCorrectCount == Math.ceil(allRooms[data.room].count / 2)) { // ****
		console.log("**** isCorrectCount = ", isCorrectCount);
		const num_in_room = allRooms[data.room].count;

		console.log("**** allRooms[data.room] = ", allRooms[data.room]);
		console.log("**** num_in_room = ", num_in_room);
		
                //if (isCorrectCount == Math.ceil(allRooms[data.room].count)) { // ****
		if (isCorrectCount == num_in_room) { // ****
                    // if the cityIndex is more than or equal to the length of the cities array
                    if (cityIndex >= shuffledCitiesArray.length) {
			// Or is this a condition that should signal the end of the game?? // ****
                        // set index back to the first city
                        cityIndex = 0;
                    }
                    
                    // replace the current city with the next city (cityIndex should be forward at this point)
                    cityForEachRoom[data.room] = shuffledCitiesArray[cityIndex];
                    // increment cityIndex for the next new city
                    cityIndex++;

                    const cityData = cityForEachRoom[data.room];
                    io.to(data.room).emit("city_data", cityData);

                    console.log(cityForEachRoom[data.room]);

                    // reset all player's stats 
                    for (let player in allPlayers) {
                        if (allPlayers[player].room === data.room) {
                            allPlayers[player].isCorrect = false;
                            allPlayers[player].guesses.clear();
                        }
                    }
                }
            }
        } else {
            socket.to(data.room).emit("receive_message", data);
        }

        let playerScore = {
            id: socket.id,
            name: data.author,
            score: player.score,
        };

        io.in(data.room).emit("update_board", playerScore);
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
        delete allPlayers[socket.id];
    });

    function getRoomCount() {
	console.log("**** getRoomCount(), allPlayers: ", allPlayers);
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
    const message_response = await llmAssistant.getLLMHint(req.query.city,req.query.country);
    const message_response_str = JSON.stringify(message_response);

    res.setHeader("Content-Type", "application/json");    
    res.end(message_response_str);
    
})


server.listen(SERVER_PORT, ()=> {
    console.log(`Web + Socket.IO server running on port ${SERVER_PORT}`);
});
