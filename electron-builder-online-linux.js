var express = require("express");
var session = require('express-session');

var NedbStore = require('nedb-session-store')(session);

var app = express();

const http = require('http');
const WebSocketServer = require('ws').Server;

var server = http.createServer(app);
const wss = new WebSocketServer({server});

var confs = JSON.parse(fs.readFileSync("configs.json"));

var connected_clients = [];
var sockets = []

var session_conf = 
{
    secret: 'electron-builder-online-linux_h6cg89rjdfl0x8',
    cookie:{
        maxAge: 3600000
    },
    store: new NedbStore({
        filename: 'nedbs/sessions.db'
    })
};
var sess = session(session_conf);
console.log("store: "+sess.store);

app.use(sess);

app.use(express.static('www'));

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({extended: true})); // to support URL-encoded bodies

wss.on('error', err => {
    console.dir(err);
});

server.listen(8080, function () {
    console.log('Electron Builder Online Web Server listening on port 8080!');
});

wss.on('connection', (socket, req) => {

    console.log('WebSocket client connected...');
    sess(req, {}, () => {
        console.log('Session is parsed!');
    });

    socket.on('error', err => {
        console.dir(err);
    });

    socket.on('message', data => {
        
        data = JSON.parse(data);

        if ( data.op === "subscribe" ) {

            var parameters = data.parameters;

            

        }

    });

    socket.on('close', () => {

        // Eliminates socket from sockets array
        console.log('Socket closed');

    });

});

wss.on('listening', () => {
    console.log('Listening...');
});

// -----Web Socket (END) --------------------

server.listen(confs.mirror_server, function () {
    console.log('IPFSSyncro Web Server listening on port '+confs.mirror_server+'!');
});