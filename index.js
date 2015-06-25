/*jslint node: true */
/* global -Promise */
"use strict";

var io = require('socket.io-client');
var client = require('./lib/client');

module.exports = function (d, point, auth, url) {
    return client(io, d, point, auth, url);
};
