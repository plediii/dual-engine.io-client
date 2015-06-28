/*jslint node: true */
"use strict";

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var socket = function () {
    
    var serverSide = new EventEmitter();
    var clientSide = new EventEmitter();
    var serverSideemit = _.bind(serverSide.emit, serverSide);
    var clientSideemit = _.bind(clientSide.emit, clientSide);
    var connected = true;

    var socketDisconnect = function () {
        if (connected) { 
            connected = false;
            clientSideemit('close');
            serverSideemit('close');
        }
    };

    var socketReconnect = function () {
        if (!connected) { 
            connected = true;
            serverSideemit('connect');
            clientSideemit('open');
        }
    };

    
    _.extend(serverSide, {
        send: function (msg) {
            if (connected) { 
                clientSideemit('message', msg);
            }
        }
        , disconnect: socketDisconnect
        , reconnect: socketReconnect
    });

    _.extend(clientSide, {
        send: function (msg) {
            if (connected) {
                serverSideemit('message', msg);
            }
        }
        , disconnect: socketDisconnect
        , reconnect: socketReconnect
    });

    return {
        serverSide: serverSide
        , clientSide: clientSide
        , disconnect: function (quiet) {
            connected = false;
            if (!quiet) {
                serverSideemit('disconnect');
                clientSideemit('disconnect');
            }
        }
        , connect: function () {
            connected = true;
            serverSide.emit('connect');
            clientSide.emit('connect');
        }
    };
};


module.exports = function () {
    var sockets = [];
    var listenEmitter = new EventEmitter();
    var offline = false;
    var connectionAttempt;

    return {
        client: function (url) {
            var s = socket();
            if (connectionAttempt) {
                connectionAttempt(s);
            }
            s.serverSide.url = url;
            s.clientSide.url = url;
            setTimeout(function () {
                if (offline) {
                    s.clientSide.emit('close');
                } else {
                    listenEmitter.emit('connection', s.serverSide);
                    s.clientSide.emit('open');
                }
            }, 0);
            return s.clientSide;
        }
        , listen: function () {
            return listenEmitter;
        }
        , serverOffline: function () {
            offline = true;
        }
        , serverOnline: function () {
            offline = false;
        }
        , socket: socket
        , sockets: function () {
            return sockets;
        }
        , onConnectionAttempt: function (cb) {
            connectionAttempt = cb;
        }
    };
};

module.exports.socket = socket;
