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

function sha1(str) {
    var rotate_left = function (n, s) {
        var t4 = (n << s) | (n >>> (32 - s));
        return t4;
    };

    var cvt_hex = function (val) {
        var str = '';
        var i;
        var v;

        for (i = 7; i >= 0; i--) {
            v = (val >>> (i * 4)) & 0x0f;
            str += v.toString(16);
        }
        return str;
    };

    var blockstart;
    var i, j;
    var W = new Array(80);
    var H0 = 0x67452301;
    var H1 = 0xEFCDAB89;
    var H2 = 0x98BADCFE;
    var H3 = 0x10325476;
    var H4 = 0xC3D2E1F0;
    var A, B, C, D, E;
    var temp;

    // utf8_encode
    str = unescape(encodeURIComponent(str));
    var str_len = str.length;

    var word_array = [];
    for (i = 0; i < str_len - 3; i += 4) {
        j = str.charCodeAt(i) << 24 | str.charCodeAt(i + 1) << 16 | str.charCodeAt(i + 2) << 8 | str.charCodeAt(i + 3);
        word_array.push(j);
    }

    switch (str_len % 4) {
        case 0:
            i = 0x080000000;
            break;
        case 1:
            i = str.charCodeAt(str_len - 1) << 24 | 0x0800000;
            break;
        case 2:
            i = str.charCodeAt(str_len - 2) << 24 | str.charCodeAt(str_len - 1) << 16 | 0x08000;
            break;
        case 3:
            i = str.charCodeAt(str_len - 3) << 24 | str.charCodeAt(str_len - 2) << 16 | str.charCodeAt(str_len - 1) << 8 | 0x80;
            break;
    }

    word_array.push(i);

    while ((word_array.length % 16) != 14) {
        word_array.push(0);
    }

    word_array.push(str_len >>> 29);
    word_array.push((str_len << 3) & 0x0ffffffff);

    for (blockstart = 0; blockstart < word_array.length; blockstart += 16) {
        for (i = 0; i < 16; i++) {
            W[i] = word_array[blockstart + i];
        }
        for (i = 16; i <= 79; i++) {
            W[i] = rotate_left(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        }

        A = H0;
        B = H1;
        C = H2;
        D = H3;
        E = H4;

        for (i = 0; i <= 19; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (~B & D)) + E + W[i] + 0x5A827999) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 20; i <= 39; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0x6ED9EBA1) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 40; i <= 59; i++) {
            temp = (rotate_left(A, 5) + ((B & C) | (B & D) | (C & D)) + E + W[i] + 0x8F1BBCDC) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        for (i = 60; i <= 79; i++) {
            temp = (rotate_left(A, 5) + (B ^ C ^ D) + E + W[i] + 0xCA62C1D6) & 0x0ffffffff;
            E = D;
            D = C;
            C = rotate_left(B, 30);
            B = A;
            A = temp;
        }

        H0 = (H0 + A) & 0x0ffffffff;
        H1 = (H1 + B) & 0x0ffffffff;
        H2 = (H2 + C) & 0x0ffffffff;
        H3 = (H3 + D) & 0x0ffffffff;
        H4 = (H4 + E) & 0x0ffffffff;
    }

    temp = cvt_hex(H0) + cvt_hex(H1) + cvt_hex(H2) + cvt_hex(H3) + cvt_hex(H4);
    return temp.toLowerCase();
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
    var ws = this;
    socket.on('data', this.parseData.bind(this));
    socket.on('close', function () {ws.emit('close');});
    this.emit('open');
    this.waitForHandshake();
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
    var ws = new WebSocket(host, options);
    ws.initializeServer();
    return ws;
};
