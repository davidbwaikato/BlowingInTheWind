// SocketIOInstance.js
import io from 'socket.io-client';

import config from "./config.js";

const SERVER_URL = config.SERVER_URL || "http://localhost:3001";

console.log(`Creating connection to Web-Socket server: ${SERVER_URL}`);

//const socket = io.connect(SERVER_URL);
const socket = io(SERVER_URL);

export default socket;
