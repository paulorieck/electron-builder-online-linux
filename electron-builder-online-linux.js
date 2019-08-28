const express = require("express");
const session = require('express-session');
const clone = require('git-clone-promise');
const rimraf = require('rimraf');
const path = require('path');
const os = require('os');
const fs = require('fs');

var NedbStore = require('nedb-session-store')(session);

var confs = {};

if ( !fs.existsSync(path.join(os.homedir(), '.electron-builder-online')) ) {
    fs.mkdirSync(path_module.join(homedir, ".electron-builder-online"));
}

if ( fs.existsSync(path.join(os.homedir(), '.electron-builder-online', 'configs.json')) ) {

    confs = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.electron-builder-online', 'configs.json')));

    if ( typeof confs.linux_server_port === "undefined" ) {
        confs.linux_server_port = 8080;
    }

} else {

    confs = {"linux_server_port": 8080};

}
fs.writeFileSync(path.join(os.homedir(), '.electron-builder-online', 'configs.json'), JSON.stringify(confs));

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
        filename: path.join(os.homedir(), '.electron-builder-online', 'nedbs', 'sessions.db')
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
        console.log('YARN stdout: '+log);
        socket.send(JSON.stringify({"op": "console_output", "message": 'YARN stdout: '+log}));
    });

    electron.stderr.on('data', (log) => {
        console.log('YARN stderr: '+log);
        socket.send(JSON.stringify({"op": "console_output", "message": 'YARN stderr: '+log}));
    });

    electron.on('close', (code) => {

        console.log('YARN child process exited with code '+code);
        socket.send(JSON.stringify({"op": "console_output", "message": 'YARN child process exited with code '+code}));

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

    const electron = spawn("npm", args, options);

    electron.stdout.on('data', (log) => {
        console.log('NPM stdout: '+log);
        socket.send(JSON.stringify({"op": "console_output", "message": 'NPM stdout: '+log}));
    });

    electron.stderr.on('data', (log) => {
        console.log('NPM stderr: '+log);
        socket.send(JSON.stringify({"op": "console_output", "message": 'NPM stderr: '+log}));
    });

    electron.on('close', (code) => {

        console.log(`NPM child process exited with code ${code}`);
        socket.send(JSON.stringify({"op": "console_output", "message": 'NPM child process exited with code '+code}));

        callback();

    });
    
}

function runElectronBuilder(socket, parameters, execution_path, callback) {

    socket.send(JSON.stringify({"op": "console_output", "message": 'Starting "electron-builder"'}));

    const {exec, spawn} = require('child_process');

    console.log("parameters.gh_token: "+parameters.gh_token);

    var args = ["--publish=always"];

    const options = {
        cwd: execution_path,
        spawn: false,
        env: {GH_TOKEN: parameters.gh_token, PATH: process.env.PATH}
    }

    const electron = spawn("electron-builder", args, options);

    electron.stdout.on('data', (log) => {
        console.log('electron-builder stdout: '+log);
        socket.send(JSON.stringify({"op": "console_output", "message": 'electron-builder stdout: '+log}));
    });

    electron.stderr.on('data', (log) => {
        console.log('electron-builder stderr: '+log);
        socket.send(JSON.stringify({"op": "console_output", "message": 'electron-builder stderr: '+log}));
    });

    electron.on('close', (code) => {

        console.log('electron-builder child process exited with code '+code);
        socket.send(JSON.stringify({"op": "console_output", "message": 'electron-builder child process exited with code '+code}));

        callback();

    });

}

wss.on('connection', (socket, req) => {

    console.log('WebSocket client connected...');
    sess(req, {}, () => {
        //console.log('Session is parsed!');
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
            console.log("tempDirectory: "+tempDirectory+", parameters.name: "+parameters.name+", parameters.repository: "+parameters.repository);

            // If the directory exists remove it
            rimraf(path.join(tempDirectory, parameters.name), [], function () { // Removes directory

                // Downloads the GIT repository content to the newly created repository
                clone(parameters.repository, path.join(tempDirectory, parameters.name)).then(() => {

                    console.log("Clonned your repo succesfully!");

                    // Run NPM INSTALL or YARN INSTALL
                    if ( parameters.install_with === "yarn" ) {

                        runYARN(socket, path.join(tempDirectory, parameters.name), function () {

                            // Run electron-builder
                            runElectronBuilder(socket, parameters, path.join(tempDirectory, parameters.name), function () {
                                rimraf(path.join(tempDirectory, parameters.name), [], function () { // Removes directory
                                    socket.send(JSON.stringify({"op": "job_concluded", "status": true}));
                                });
                            });

                        });

                    } else if ( parameters.install_with === "npm" ) {

                        runNPM(socket, path.join(tempDirectory, parameters.name), function () {

                            // Run electron-builder
                            runElectronBuilder(socket, parameters, path.join(tempDirectory, parameters.name), function () {
                                rimraf(path.join(tempDirectory, parameters.name), [], function () { // Removes directory
                                    socket.send(JSON.stringify({"op": "job_concluded", "status": true}));
                                });    
                            });

                        });

                    }

                }).catch(function (error) {
                    console.log("Error: "+error);
                });

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

server.listen(confs.linux_server_port, function () {
    console.log('Electron-builder-online-linux Web Server listening on port '+confs.linux_server_port+'!');
});