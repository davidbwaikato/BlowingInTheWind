
//gets the libraries 
const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const {Server} = require("socket.io");
const path = require("path"); // Import the path module

app.use(cors());

// Middleware to set the correct MIME type for CSS files
app.use((req, res, next) => {
    if (req.url.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
    }
    next();
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, '../client/build')));



//generate a server 
const server =  http.createServer(app);
const io = new Server(server, {
    cors: {
        //might change when we have our own dowmain 
        origin: "http://localhost:3000",
        methods: ["GET", "POST"],
    },
} );

//listen a connection  event from client
//socket is specific to a client  
io.on("connection", (socket) => {
    console.log(`user connected ${socket.id}`);

    //listens from client side if they joined a room - gets data (in this case the room) from that particular client 
    socket.on("join_room", (data) => {
        socket.join(data);
        console.log(`User with ID ${socket.id} joined room: ${data}`)
    });

    //listens from the client side the send_message event
    socket.on("send_message", (data) =>{
        socket.to(data.room).emit("receive_message", data);
    });

    socket.on("disconnect", (data) =>{
        console.log("user disconnect", socket.id);
    });

});

server.listen(3001, ()=> {
    console.log("server running");
});