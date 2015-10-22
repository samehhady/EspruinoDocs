/* Copyright (c) 2015 Sameh Hady. See the file LICENSE for copying permission. */
/*
 Simple WebSocket protocol wrapper for Espruino sockets.

 * KEYWORDS: Module,websocket,ws,socket

 Websocket implementation on Espruino, it let you control your Espruino from the cloud without the need to know it's IP.
 You will need to use it with a websocket server.

 Limitations: The module only accept messages less than 127 character.

 How to use the ws module:

 ```javascript
 // Connect to WiFi, then...
 var WebSocket = require("ws");
 var ws = new WebSocket("HOST",{
      port: 8080,
      protocolVersion: 13,
      origin: 'Espruino',
      keepAlive: 60  // Ping Interval in seconds.
    });

 ws.on('open', function() {
 console.log("Connected to server");
 ws.broadcast("New User Joined");
 });

 ws.on('message', function(msg) {
 console.log("MSG: " + msg);
 });

 ws.on('close', function() {
 console.log("Connection closed");
 });
 
 //Send message to server
 ws.send("Hello Server");
 
 //Broadcast message to all users
 ws.broadcast("Hello All");
 
 // Join a room
 ws.join("Espruino");
 
 //Broadcast message to specific room
 ws.broadcast("Hello Room", "Espruino");
 
 // WebSocket Server
 var WebSocketServer = require("ws").Server;
 var wss = new WebSocketServer({port: 8080});
 wss.on('connection', function(ws) {
  ws.on('message', function(message) {
    console.log('received: %s', message);
  });
 ```
 */

/** Minify String.fromCharCode() call */
function strChr(chr) {
    return String.fromCharCode(chr);
}

function hexEncode(str) {
    var b = "";
    var x = [];
    for (var i = 0; i < str.length; i += 2) {
        x.push(String.fromCharCode("0x" + str.substr(i, 2)));
    }
    return btoa(x.join(""));
}

function WebSocket(host, options) {
    this.socket = null;
    options = options || {};
    this.host = host;
    this.port = options.port || 80;
    this.protocolVersion = options.protocolVersion || 13;
    this.origin = options.origin || 'Espruino';
    this.keepAlive = options.keepAlive * 1000 || 60000;
}

function WebSocketServer(options) {
    this.socket = null;
    options = options || {};
    this.port = options.port || 80;
    var sha1 = require("utilities").sha1("encode");
}

WebSocket.prototype.initializeClient = function () {
    require("net").connect({
        host: this.host,
        port: this.port
    }, this.onConnect.bind(this));
};

WebSocket.prototype.initializeServer = function () {
    require("net").createServer(this.onServer.bind(this)).listen(this.port);
};

WebSocket.prototype.onServer = function (socket) {
    this.socket = socket;
    var wss = this;
    socket.on('data', this.handleData.bind(this));
    socket.on('close', function () {wss.emit('close');});
};

WebSocket.prototype.onConnect = function (socket) {
    this.socket = socket;
    var ws = this;
    socket.on('data', this.parseData.bind(this));
    socket.on('close', function () {ws.emit('close');});
    this.emit('open');
    this.handshake();
};

WebSocket.prototype.parseData = function (data) {
    var ws = this;
    this.emit('rawData', data);
    if (data.indexOf('HSmrc0sMlYUkAGmm5OPpG2HaGWk=') > -1) {
        this.emit('handshake');
        var ping = setInterval(function () {
            ws.send('ping', 0x89);
        }, this.keepAlive);
    }

    if (data.indexOf(strChr(0x8A)) > -1) {
        this.emit('pong');
    }

    if (data.indexOf(strChr(0x89)) > -1) {
        this.send('pong', 0x8A);
        this.emit('ping');
    }

    if (data.indexOf(strChr(0x0a)) > -1) {
        data = data.substring(1);
    }

    if (data.indexOf(strChr(0x81)) > -1) {
        var dataLen = data.charCodeAt(1);
        data = data.substring(2);
        var message = "";
        for (var i = 0; i < dataLen; i++) {
            message += data[i];
        }
        this.emit('message', message);
    }
};

WebSocket.prototype.handshake = function () {
    var socketHeader = [
        "GET / HTTP/1.1",
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==",
        "Sec-WebSocket-Version: " + this.protocolVersion,
        "Origin: " + this.origin,
        ""
    ];

    for (var index = 0; index < socketHeader.length; index++) {
        this.socket.write(socketHeader[index] + "\r\n");
    }
};

WebSocketServer.prototype.handleData = function (data) {
    var socketHeader = [
        "HTTP/1.1 101 Switching Protocols",
        "Upgrade: websocket",
        "Connection: Upgrade",
        "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
        ""
    ];
    
    if (data.indexOf("Sec-WebSocket-Key") > -1) {
        for (var index = 0; index < socketHeader.length; index++) {
           this.socket.write(socketHeader[index] + "\r\n");
        }
        this.emit('connection', this);
    }
};

/** Send message based on opcode type */
WebSocket.prototype.send = function (msg, opcode) {
    opcode = opcode === undefined ? 0x81 : opcode;
    if(!JSON.parse(msg)){msg = '{"msg":"' + msg + '"}';}
    this.socket.write(strChr(opcode));
    this.socket.write(strChr(msg.length));
    this.socket.write(msg);
};

/** Broadcast message to room */
WebSocket.prototype.broadcast = function (msg, room) {
    room = room === undefined ? 'all' : room;
    var newMsg = '{"room":"' + room + '", "msg":"' + msg + '"}';
    this.send(newMsg);
};

/** Join a room */
WebSocket.prototype.join = function (room) {
    var newMsg = '{"join":"' + room +'"}';
    this.send(newMsg);
};

exports = function (host, options) {
    var ws = new WebSocket(host, options);
    ws.initializeClient();
    return ws;
};

exports.Server = function (host, options) {
    var wss = new WebSocketServer(options);
    wss.initializeServer();
    return wss;
};
