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

        it('should leave a listener which returns 503 status code after disconnect', function (done) {
            dio.disconnect();
            d.waitFor(['disconnect', 'server'])
                .then(function () {
                    d.request(['server'])
                    .spread(function (body, options) {
                        assert.equal(503, options.statusCode);
                        done();
                    });
                });
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
