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


module.exports = function (behavior) {
    var sockets = [];
    var listenEmitter = new EventEmitter();

    return {
        client: function (url) {
            var s = socket();
            s.serverSide.url = url;
            s.clientSide.url = url;
            setTimeout(function () {
                listenEmitter.emit('connection', s.serverSide);
                s.clientSide.emit('open');
            }, 0);
            return s.clientSide;
        }
        , listen: function () {
            return listenEmitter;
        }
        , socket: socket
        , sockets: function () {
            return sockets;
        }
    };
};

module.exports.socket = socket;
