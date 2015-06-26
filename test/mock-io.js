/*jslint node: true */
"use strict";

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var socket = function () {
    
    var sideA = new EventEmitter();
    var sideB = new EventEmitter();
    var sideAemit = _.bind(sideA.emit, sideA);
    var sideBemit = _.bind(sideB.emit, sideB);
    var connected = true;

    var socketDisconnect = function () {
        if (connected) { 
            connected = false;
            sideBemit.call(sideB, 'disconnect');
            sideAemit.call(sideA, 'disconnect');
        }
    };

    var socketReconnect = function () {
        if (!connected) { 
            connected = true;
            sideBemit.call(sideB, 'connect');
            sideAemit.call(sideA, 'connect');
        }
    };

    
    _.extend(sideA, {
        emit: function () {
            if (connected) { 
                sideBemit.apply(sideB, arguments);
            }
        }
        , disconnect: socketDisconnect
        , reconnect: socketReconnect
    });

    _.extend(sideB, {
        emit: function () {
            if (connected) {
                sideAemit.apply(sideA, arguments);
            }
        }
        , disconnect: socketDisconnect
        , reconnect: socketReconnect
    });

    return {
        sideA: sideA
        , sideB: sideB
        , disconnect: function (quiet) {
            connected = false;
            if (!quiet) {
                sideAemit('disconnect');
                sideBemit('disconnect');
            }
        }
        , connect: function () {
            connected = true;
            sideA.emit('connect');
            sideB.emit('connect');
        }
    };
};


module.exports = function (behavior) {
    var sockets = [];
    var listenEmitter = new EventEmitter();

    return {
        connect: function (url) {
            var s = socket();
            s.sideA.url = url;
            s.sideB.url = url;
            setTimeout(function () {
                listenEmitter.emit('connect', s.sideA);
                if (behavior) {
                    behavior(s.sideA);
                }
                else {
                    s.sideA.emit('connect');
                }
            }, 0);
            return s.sideB;
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
