/*jslint node: true */
"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var assert = require('assert');

var dapi = require('dualapi');
var mockio = require('./mock-io');

describe('dual socket.io client disconnecting', function () {

    var d, socket, io, ioclient;
    beforeEach(function () {
        d = dapi.use(require('../index'))();
        io = mockio();
        ioclient = io.client;
        socket = io.socket();
    });

    describe('after connect', function () {

        var serverSocket;
        var dio;
        beforeEach(function (done) {
            io.listen().on('connection', function (socket) {
                serverSocket = socket;
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });
            dio = d.engineio(ioclient, ['server'], {
                reconnect: 0.5
            });
            d.waitFor(['connect', 'server'])
                .then(function () {
                    done()
                });
        });

        it('should be a function exposed on object returned by d.engionio', function () {
            assert(_.isFunction(dio.disconnect));
        });

        it('should cause disconnect event on server side of socket', function (done) {
            serverSocket.on('close', function () {
                done();
            });
            dio.disconnect();
        });

        it('should cause a disconnect event', function (done) {
            d.waitFor(['disconnect', 'server']).then(function () {
                done();
            });
            dio.disconnect();
        });

        it('should not reconnect', function (done) {
            d.waitFor(['connect', 'server'], function () {
                done('reconnected');
            });
            dio.disconnect();
            done();
        });

        it('should not leave a mounted listener', function () {
            assert.notEqual(0, d.listeners(['server']).length);
            assert.notEqual(0, d.listeners(['server', '**']).length);
            dio.disconnect();
            d.waitFor(['disconnect', 'server'])
                .then(function () {
                    assert.equal(0, d.listeners(['server']).length);
                    assert.equal(0, d.listeners(['server', '**']).length);
                });
        });

        it('should not leave error listener', function () {
            console.log('sending before disconnect');
            d.send(['error']);
            console.log('sent');
            d.waitFor(['disconnect', 'server'])
                .then(function () {
                    // this will cause an error due to a listener
                    // leak holding the old socket, although I don't have a straightforward
                    // way to observe it
                    console.log('sending after disconnect');
                    d.send(['error']);
                });
            dio.disconnect();
        });
    });

    describe('when server is offline', function () {

        var dio;
        beforeEach(function () {
            io.serverOffline();
            dio = d.engineio(ioclient, ['server'], {
                reconnect: 0.5
            });
        });

        it('should *not* retry connecting every 0.5 seconds', function (done) {
            var count = 0;
            io.onConnectionAttempt(function () {
                done('reconnected');
            });
            dio.disconnect();
            done();
        });
    });

    describe('before initial connection', function () {
        it('should cancel any pending connection', function (done) {
            io.listen().on('connection', function (socket) {
                var serverSocket = socket;
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });
            var dio = d.engineio(ioclient, ['server'], {
                reconnect: 0.5
            });
            d.waitFor(['connect', 'server'])
                .then(function () {
                    done('connected anyway');
                });
            dio.disconnect();
            done();
        });
    });
});
