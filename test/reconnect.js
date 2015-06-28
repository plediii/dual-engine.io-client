/*jslint node: true */
"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var assert = require('assert');

var dapi = require('dualapi');
var mockio = require('./mock-io');

describe('dual socket.io client reconnecting', function () {

    var d, socket, io, ioclient;
    beforeEach(function () {
        d = dapi.use(require('../index'))();
        io = mockio();
        ioclient = io.client;
        socket = io.socket();
    });

    describe('after connect', function () {

        var serverSocket;
        beforeEach(function (done) {
            io.listen().on('connection', function (socket) {
                serverSocket = socket;
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });
            d.engineio(ioclient, ['server'], {
                reconnect: 0.5
            });
            d.waitFor(['connect', 'server'])
                .then(function () {
                    serverSocket.disconnect();
                    d.waitFor(['connect', 'server'])
                        .then(function () {
                            done();
                        });
                });
        });

        it('should not double transmit messages', function (done) {
            var count = 0;
            d.mount(['means'], function (body, ctxt) {
                count++;
                if (count > 1) {
                    done('multiple calls');
                } else {
                    done();
                }
            });
            serverSocket.send(JSON.stringify({
                to: ['means']
            }));
        });

        describe('the disconnect again', function () {
            it('should not double transmit disconnect', function (done) {
                var count = 0;
                d.mount(['disconnect', 'server'], function (body, ctxt) {
                    count++;
                    if (count > 1) {
                        done('multiple calls');
                    } else {
                        done();
                    }
                });
                serverSocket.disconnect();
            });
        });
    });

    describe('when server is offline', function () {

        beforeEach(function (done) {
            io.serverOffline();
            d.engineio(ioclient, ['server'], {
                reconnect: 0.5
            });
            done();
        });

        it('should retry connecting every 0.5 seconds', function (done) {
            var count = 0;
            io.onConnectionAttempt(function () {
                count++;
                if (count === 2) {
                    done();
                }
            });
        });

        describe('then disconnect again', function () {
            
            var serverSocket;
            beforeEach(function (done) {
                io.serverOffline();
                d.engineio(ioclient, ['server'], {
                    reconnect: 0.5
                });
                io.onConnectionAttempt(function () {
                    io.serverOnline();
                    io.onConnectionAttempt(null);
                    io.listen().on('connection', function (socket) {
                        serverSocket = socket;
                        serverSocket.send(JSON.stringify({
                            to: ['index']
                        }));
                    });
                    d.waitFor(['connect', 'server'])
                        .then(function () {
                            done();
                        });
                });
            });

            it('should not double transmit disconnect', function (done) {
                var count = 0;
                d.mount(['disconnect', 'server'], function (body, ctxt) {
                    count++;
                    if (count > 1) {
                        done('multiple calls');
                    } else {
                        done();
                    }
                });
                serverSocket.disconnect();
            });
        });
    });
});
