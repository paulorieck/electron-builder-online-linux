const express = require("express");
const session = require('express-session');
const clone = require('git-clone');
const rimraf = require('rimraf');
const path = require('path');

var NedbStore = require('nedb-session-store')(session);

var app = express();

const http = require('http');
const WebSocketServer = require('ws').Server;

var server = http.createServer(app);
const wss = new WebSocketServer({server});

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

function runYARN(socket, execution_path, callback) {

    socket.send(JSON.stringify({"op": "console_output", "message": 'Starting "yarn install"'}));

    const {spawn} = require('child_process');

    var args = ["install"];

    const options = {
        cwd: execution_path,
        spawn: false
    }

    const electron = spawn("yarn", args, options);

    electron.stdout.on('data', (log) => {
        console.log('YARN stdout: ${log}');
        socket.send(JSON.stringify({"op": "console_output", "message": 'YARN stdout: ${log}'}));
    });

    electron.stderr.on('data', (log) => {
        console.log(`YARN stderr: ${log}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'YARN stderr: ${log}'}));
    });

    electron.on('close', (code) => {

        console.log(`YARN child process exited with code ${code}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'YARN child process exited with code ${code}'}));

        // Run electron-builder
        callback();

    });

}

function runNPM(socket, execution_path, callback) {

    socket.send(JSON.stringify({"op": "console_output", "message": 'Starting "npm install"'}));

    const {spawn} = require('child_process');

    var args = ["install"];

    const options = {
        cwd: execution_path,
        spawn: false
    }

    const electron = spawn("NPM", args, options);

    electron.stdout.on('data', (log) => {
        console.log('NPM stdout: ${log}');
        socket.send(JSON.stringify({"op": "console_output", "message": 'NPM stdout: ${log}'}));
    });

    electron.stderr.on('data', (log) => {
        console.log(`NPM stderr: ${log}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'NPM stderr: ${log}'}));
    });

    electron.on('close', (code) => {

        console.log(`NPM child process exited with code ${code}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'NPM child process exited with code ${code}'}));

        callback();

    });
    
}

function runElectronBuilder(parameters, execution_path, callback) {

    socket.send(JSON.stringify({"op": "console_output", "message": 'Starting "electron-builder"'}));

    const {spawn} = require('child_process');

    var args = parameters;

    const options = {
        cwd: execution_path,
        spawn: false
    }

    const electron = spawn("electron-builder", args, options);

    electron.stdout.on('data', (log) => {
        console.log('electron-builder stdout: ${log}');
        socket.send(JSON.stringify({"op": "console_output", "message": 'electron-builder stdout: ${log}'}));
    });

    electron.stderr.on('data', (log) => {
        console.log(`electron-builder stderr: ${log}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'electron-builder stderr: ${log}'}));
    });

    electron.on('close', (code) => {

        console.log(`electron-builder child process exited with code ${code}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'electron-builder child process exited with code ${code}'}));

        callback();

    });

}

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

            // Check if necessary parameters where provided


            // Create a temporary folder
            const tempDirectory = require('temp-dir');

            // Downloads the GIT repository content to the newly created repository
            clone(parameters.repository, tempDirectory, [], function () {

                // Run NPM INSTALL or YARN INSTALL
                if ( parameters.install_with === "yarn" ) {

                    runYARN(socket, path.join(tempDirectory, project_name), function () {

                        // Run electron-builder
                        runElectronBuilder(parameters, path.join(tempDirectory, project_name), function () {
                            rimraf(tempDirectory, [], function () { // Removes directory
                                socket.send(JSON.stringify({"op": "job_concluded", "status": true}));
                            });
                        });

                    });

                } else if ( parameters.install_with === "npm" ) {

                    runNPM(socket, path.join(tempDirectory, project_name), function () {

                        // Run electron-builder
                        runElectronBuilder(parameters, path.join(tempDirectory, project_name), function () {
                            rimraf(tempDirectory, [], function () { // Removes directory
                                socket.send(JSON.stringify({"op": "job_concluded", "status": true}));
                            });    
                        });

                    });

                }

            });

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

server.listen(80, function () {
    console.log('IPFSSyncro Web Server listening on port 80!');
});