// SocketIOInstance.js
import io from 'socket.io-client';

import config from "./config.js";

const SERVER_URL = config.SERVER_URL || "http://localhost:3001";

console.log(`Creating connection to Web-Socket server: ${SERVER_URL}`);

const bitw_socket = io(SERVER_URL);

window.bitw_socket = bitw_socket;

export default bitw_socket;
