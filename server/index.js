const fs      = require('fs');
const path    = require('path');

const express = require("express");
const http    = require("http");
const cors    = require("cors");

const {Server} = require("socket.io");

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
//app.use(express.static(path.join(__dirname, '../client/build'))); // ****

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


const CitiesArray = [
    { city: "Auckland", coordinates: [174.763336, -36.848461, 300.0]},
    { city: "Rome", coordinates: [12.496366, 41.902782, 300.0]},
    { city: "Paris", coordinates: [2.349014, 48.864716, 300.0]},
    { city: "Tokyo", coordinates: [139.817413, 35.672855, 300.0]},
    //{ city: "Dubai", coordinates: [55.296249, 25.276987, 300.0]},
    { city: "Hamilton", coordinates: [175.269363, -37.781528, 300.0]},
    { city: "Toronto", coordinates: [-79.384293, 43.653908, 300.0]},
    { city: "Sydney", coordinates: [151.209900, -33.865143, 300.0]},
    { city: "San Francisco", coordinates: [-122.431297, 37.773972, 300.0]},
    { city: "New York", coordinates: [-73.935242, 40.730610, 300.0]},
    //{ city: "Seoul", coordinates: [127.024612, 37.532600, 300.0]},
    //{ city: "New Delhi", coordinates: [77.216721, 28.644800, 300.0]},
    { city: "Barcelona", coordinates: [2.154007, 41.390205, 300.0]},
    { city: "Athens", coordinates: [23.727539, 37.983810, 300.0]},
    { city: "Budapest", coordinates: [19.040236, 47.497913, 300.0]},
    //{ city: "Moscow", coordinates: [37.618423, 55.751244, 300.0]},
    //{ city: "Cairo", coordinates: [31.233334, 30.033333, 300.0]},
    { city: "Copenhagen", coordinates: [12.568337, 55.676098, 300.0]},
    { city: "London", coordinates: [-0.118092, 51.509865, 300.0]},
] 

// Method for shuffling an array
//   https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array

function shuffleArray(array){
    let currentIndex = array.length;
    while(currentIndex != 0){
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
}

// shuffle cities array
let shuffledCitiesArray = [...CitiesArray]
shuffleArray(shuffledCitiesArray);

// initialise necessary objects
let allPlayers = {};
let cityForEachRoom = {};
let cityIndex = 0; 

//listen a connection  event from client
//socket is specific to a client  
io.on("connection", (socket) => {
    console.log(`user connected ${socket.id}`);
    let city = [];

    socket.on("get_starting_location", (callback) => {
	callback = typeof callback == "function" ? callback : () => {};

	console.log("socket.on(get_starting_location):");
	console.log("  returning: ",DefaultStartingLocation);
	callback(DefaultStartingLocation);
    })
    
    //listens from client side if they joined a room - gets data (in this case the room) from that particular client 
    socket.on("join_room", (roomIdData) => {
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
            if(cityIndex > shuffledCitiesArray.length){
                cityIndex = 0;
            } else {
                cityForEachRoom[roomIdData] = shuffledCitiesArray[cityIndex];
                cityIndex++;    
            }
        }
        city = cityForEachRoom[roomIdData];
        const cityData = cityForEachRoom[roomIdData];
        console.log(`Sending city data to room ${roomIdData}`, cityData);
        io.to(roomIdData).emit("city_data", cityData);

        // initialise the cityFotEachRoom object so that each room gets a different city
        console.log(`User with ID ${socket.id} joined room: ${roomIdData}`);
        console.log(`User ${socket.id} score: ${allPlayers[socket.id].score}`);

    });


    //listens from the client side the send_message event
    socket.on("send_message", (data) =>{
        let currentCity = cityForEachRoom[data.room].city;
        let player = allPlayers[socket.id];

	const date_now = new Date();
	const hours = date_now.getHours();
	const mins  = date_now.getMinutes();
	
	const time_str = hours + ":" + String(mins).padStart(2,"0");
				   
        let correctMsg = {
            room: data.room,
            author: 'BITW Assistant',
            message: `${data.author} guessed correctly!`,
            //time: new Date(Date.now()).getHours() + ":" + new Date(Date.now()).getMinutes() // ****
	    time: time_str
        };

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

            for (let i = 0; i < playerKeys.length; i += 2) {  // ****
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
                if (isCorrectCount == Math.ceil(allRooms[data.room].count / 2)) { // ****
                    // if the cityIndex is more than or equal to the length of the cities array
                    if (cityIndex >= shuffledCitiesArray.length){
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

    function getRoomCount(){
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

function readdir_mp3_filelist(mp3_directory)
{
    // Default is for there to be no files listed
    let returnJSON = { "status": null, "mp3-filelist": [] };
    
    let mp3_files = []

    const audio_mp3_dir = path.join('audio',mp3_directory)    
    const full_mp3_directory = path.join(FullBuildDirectory,audio_mp3_dir)

    try {

	//if (!fs.lstatSync(full_mp3_directory).isDirectory()) {
	if (!fs.existsSync(full_mp3_directory)) {
	    const warn_message = "Warning: Failed to find directory: "
		  + full_mp3_directory + "\n"
	          + "No music tracks will be available to be played while playing ${BITW_APP_NAME}";
	    console.warn(warn_message);
	    
	    returnJSON['warning']  = `Failed to find '${mp3_directory}'.  No music tracks will be played while playing ${BITW_APP_NAME}`;
	}
	else {
	    let files = fs.readdirSync(full_mp3_directory,"utf8");
	    
	    files.forEach(function (file) {
		let full_mp3_file = path.join(full_mp3_directory, file);
		
		if (file.endsWith(".mp3")) {
		    const file_url = encodeURI(file);
		    mp3_files.push(file_url);
		}
	    });

	    shuffleArray(mp3_files);
	    
	    returnJSON['url-path-prefix'] = "/"+audio_mp3_dir;	    
	    returnJSON['mp3-filelist'] = mp3_files;
	}
	
	returnJSON['status'] = "ok";
    }
    catch (err) {
	const err_message = "Failed to read directory: " + full_mp3_directory;
	
	console.error(err_message);
	console.error();
	console.error(err);

	returnJSON['status'] ="failed";
	returnJSON['error']  = `Failed to read directory '${mp3_directory}'`;
    }

    return returnJSON;
}
    

app.get('/get-audio-music-playlist', (req, res) => {

    res.setHeader("Content-Type", "application/json");

    mp3_filelist_rec = readdir_mp3_filelist("weather-playlist");
    
    res.end(JSON.stringify(mp3_filelist_rec));
})

app.get('/get-audio-background-playlist', (req, res) => {

    res.setHeader("Content-Type", "application/json");

    mp3_filelist_rec = readdir_mp3_filelist("ambient-background");
    
    res.end(JSON.stringify(mp3_filelist_rec));
})

server.listen(SERVER_PORT, ()=> {
    console.log(`Web + Socket.IO server running on port ${SERVER_PORT}`);
});
