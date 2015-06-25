/*jslint node: true */
"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var assert = require('assert');

var dualproto = require('dual-protocol');
var io = require('./mock-io');

describe('dual socket.io client', function () {

    var d, socket;
    beforeEach(function () {
        d = dualproto.use(require('../index'))();
        socket = io.socket();
    });
    
    describe('remote url', function () {

        it('should connect to the specified url', function (done) {
            var url = 'http://boondocks.com';
            io.listen().on('connect', function (socket) {
                assert.equal(socket.url, url);
                done();
            });
            d.engineio.connect(io, ['server'], url);
        });

    });

    describe('authentication', function () {

        it('should be called when server emits auth', function (done) {
            var authEmitted = false;
            io.listen().on('connect', function (socket) {
                authEmitted = true;
                socket.emit('dual-auth');
            });
            d.engineio.connect(io, dual, ['server'], function () {
                assert(authEmitted);
                done();
            });
        });

        it('should *not* be called if the  server does not emit auth', function (done) {
            var authEmitted = false;
            io.listen().on('connect', function (socket) {});
            d.engineio.connect(io, dual, ['server'], function () {
                done('no auth requested');
            });
            done();
        });


        it('should return the resolved response ', function (done) {
            io.listen().on('connect', function (socket) {
                socket.on('dual-auth', function (msg) {
                    assert.equal(msg, 'oompa');
                    done();
                });
                socket.emit('dual-auth');
            });
            d.engineio.connect(io, dual, ['server'], function () {
                return Promise.resolve('oompa');
            });
        });

        it('should allow synchronous response ', function (done) {
            io.listen().on('connect', function (socket) {
                socket.on('dual-auth', function (msg) {
                    assert.equal(msg, 'oompa');
                    done();
                });
                socket.emit('dual-auth');
            });
            d.engineio.connect(io, dual, ['server'], function () {
                return 'oompa';
            });
        });

        it('should transmit auth message from server ', function (done) {
            io.listen().on('connect', function (socket) {
                socket.emit('dual-auth', 'bighead');
            });
            d.engineio.connect(io, dual, ['server'], function (msg) {
                assert.equal(msg, 'bighead');
                done();
            });
        });

    });

    describe('authenticated', function () {

        beforeEach(function (done) {
            io.listen().on('connect', function (socket) {
                serverSocket = socket;
                done();
            });
            d.engineio.connect(io, dual, ['server']);
        });

        describe('connect', function () {

            it('should be emitted when server emits index', function (done) {
                d.mount(['connect', 'server'], function () {
                    done();
                });
                serverSocket.emit('dual', {
                    to: ['index']
                });
            });

            it('should be emitted to connect/engineio/server/** when server emits index', function (done) {
                d.mount(['connect', 'server', 'fair'], function () {
                    done();
                });
                serverSocket.emit('dual', {
                    to: ['index']
                });
            });

            it('should not be emitted before server emits index', function (done) {
                var indexEmitted = false;
                d.mount(['connect', 'enginio', 'server'], function () {
                    assert(indexEmitted);
                    done();
                });
                serverSocket.emit('dual', {
                    to: ['you']
                });
                setTimeout(function () {
                    indexEmitted = true;
                    serverSocket.emit('dual', {
                        to: ['index']
                    });
                }, 100);
            });

        });

        describe('connected', function () {

            beforeEach(function (done) {
                d.waitFor(['connect', 'server'])
                    .then(function () {
                        done();
                    });
                serverSocket.emit('dual', {
                    to: ['index']
                });
            });

            describe('disconnect', function () {
                
                it('should be emitted when the socket disconnects', function (done) {
                    d.waitFor(['disconnect', 'server'])
                        .then(function () {
                            done();
                        });
                    serverSocket.emit('disconnect');
                });

                describe('server', function () {
                    it('should respond unavailable', function (done) {
                        serverSocket.emit('disconnect');
                        d.request(['server'])
                            .spread(function (body, options) {
                                assert.equal(options.statusCode, 503);
                                done();
                            });
                    });
                });

            });

            describe('server', function () {
                it('should respond true', function (done) {
                    d.request(['server'])
                        .spread(function (body, options) {
                            assert.equal(body, true);
                            assert.equal(options.statusCode, 200);
                            done();
                        });
                });
            });

            describe('messages', function () {

                it('should be transmitted from server to client', function (done) {
                    d.mount(['means'], function (body, ctxt) {
                        assert.deepEqual(ctxt.from, ['server', 'decides']);
                        assert.equal(ctxt.body.him, 'or');
                        assert.equal(ctxt.options.how, 'specifically');
                        done();
                    });
                    serverSocket.emit('dual', {
                        to: ['means']
                        , from: ['decides']
                        , body: {
                            him: 'or'
                        }
                        ,options: {
                            how: 'specifically'
                        }
                    });
                });

                it('should be transmitted from client to server', function (done) {
                    serverSocket.on('dual', function (body, ctxt) {
                        assert.deepEqual(ctxt.to, ['decides']);
                        assert.deepEqual(ctxt.from, ['you', 'did']);
                        assert.equal(ctxt.body.yeah, 'or');
                        assert.equal(ctxt.options.how, 'specifically');
                        done();
                    });
                    d.send(['server', 'decides'], ['you', 'did'], { yeah: 'or'}, { how: 'specifically' });
                });

            });

            describe('error events', function () {

                it('should be transmitted to server', function (done) {
                    serverSocket.on('dual', function (ctxt) {
                        assert.deepEqual(ctxt.to, ['error']);
                        assert.deepEqual(ctxt.from, ['you', 'did']);
                        assert.equal(ctxt.body.up, 'down');
                        assert.equal(ctxt.options.how, 'specifically');
                        done();
                    });
                    d.send(['error'], ['you', 'did'], { up: 'down'}, { how: 'specifically' });
                });
                
            });

        });

        describe('redirect', function () {

            it('should emit a redirect event', function (done) {
                d.mount(['redirect'], function (body, ctxt) {
                    assert(_.isEqual(ctxt.from, ['server']));
                    assert.equal(ctxt.body, '/hector');
                    assert.equal(ctxt.options.gale, 'bedecher');
                    done();
                });
                serverSocket.emit('dual', {
                    to: ['redirect']
                    , body: '/hector'
                    , options: {
                        gale: 'bedecher'
                    }
                });
            });
        });    
    });
});
