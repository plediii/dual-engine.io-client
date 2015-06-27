/*jslint node: true */
"use strict";

var Promise = require('bluebird');
var _ = require('lodash');
var assert = require('assert');

var dapi = require('dualapi');
var mockio = require('./mock-io');

describe('dual socket.io client', function () {

    var d, socket, io, ioclient;
    beforeEach(function () {
        d = dapi.use(require('../index'))();
        io = mockio();
        ioclient = io.client;
        socket = io.socket();
    });
    
    describe('remote url', function () {

        it('should connect to the specified url', function (done) {
            var url = 'http://boondocks.com';
            io.listen().on('connection', function (socket) {
                assert.equal(socket.url, url);
                done();
            });
            d.engineio(ioclient, ['server'], { 
                url: url
                , reconnect: false
            });
        });

    });

    describe('authentication', function () {

        it('should be called when server emits auth', function (done) {
            var authEmitted = false;
            io.listen().on('connection', function (socket) {
                authEmitted = true;
                socket.send('dual-auth');
            });
            d.engineio(ioclient, ['server'], {
                reconnect: false
                , auth: function () {
                    assert(authEmitted);
                    done();
                }});
        });

        it('should *not* be called if the  server does not emit auth', function (done) {
            var authEmitted = false;
            io.listen().on('connection', function (socket) {});
            d.engineio(ioclient, ['server'], {
                reconnect: false
                , auth: function () {
                    done('no auth requested');
                }});
            done();
        });


        it('should return the resolved response ', function (done) {
            io.listen().on('connection', function (socket) {
                socket.on('message', function (msg) {
                    assert.equal(msg, 'oompa');
                    done();
                });
                socket.send('dual-auth');
            });
            d.engineio(ioclient, ['server'], {
                reconnect: false
                , auth: function () {
                    return Promise.resolve('oompa');
                }});
        });

        it('should allow synchronous response ', function (done) {
            io.listen().on('connection', function (socket) {
                socket.on('message', function (msg) {
                    assert.equal(msg, 'oompa');
                    done();
                });
                socket.send('dual-auth');
            });
            d.engineio(ioclient, ['server'], { 
                reconnect: false
                , auth: function () {
                    return 'oompa';
                }});
        });

        it('should transmit auth message from server ', function (done) {
            io.listen().on('connection', function (socket) {
                socket.send('bighead');
            });
            d.engineio(ioclient, ['server'], {
                reconnect: false
                , auth: function (msg) {
                    assert.equal(msg, 'bighead');
                    done();
                }});
        });

    });

    describe('authenticated', function () {

        var serverSocket;
        beforeEach(function (done) {
            io.listen().on('connection', function (socket) {
                serverSocket = socket;
                done();
            });
            d.engineio(ioclient, ['server'], {
                reconnect: false
            });
        });

        describe('connection', function () {

            it('should be emitted when server emits index', function (done) {
                d.mount(['connect', 'server'], function () {
                    done();
                });
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });

            // it('should be emitted to connect/server/** when server emits index', function (done) {
            //     d.mount(['connect', 'server', 'fair'], function () {
            //         done();
            //     });
            //     serverSocket.emit('dual', {
            //         to: ['index']
            //     });
            // });

            it('should be mounted when connect is emitted', function (done) {
                d.mount(['connect', 'server'], function () {
                    assert(d.send(['server']));
                    done();
                });
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });

            it('should not allow events (except redirect) from server before index', function (done) {
                var indexEmitted = false;
                d.mount(['**'], function () {
                    assert(indexEmitted);
                    done();
                });
                serverSocket.send(JSON.stringify({
                    to: ['you']
                }));
                setTimeout(function () {
                    indexEmitted = true;
                    serverSocket.send(JSON.stringify({
                        to: ['index']
                    }));
                }, 100);
            });

            it('should mount server status code on connect', function (done) {
                var indexEmitted = false;
                d.mount(['status'], function (body, ctxt) {
                    assert.equal(200, ctxt.options.statusCode);
                    done();
                });
                d.mount(['connect', 'server'], function () {
                    d.send(['server'], ['status']);
                });
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });

            it('should send messages immediately on connect', function (done) {
                var indexEmitted = false;
                d.mount(['connect', 'server'], function () {
                    d.send(['server', 'piper']);
                });
                serverSocket.on('message', function () {
                    done();
                });
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });

            it('should forward errors immediately on connect', function (done) {
                var indexEmitted = false;
                d.mount(['error'], function () {});
                d.mount(['connect', 'server'], function () {
                    d.send(['error', 'piper']);
                });
                serverSocket.on('message', function () {
                    done();
                });
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
            });


        });

        describe('connected', function () {

            beforeEach(function (done) {
                d.once(['connect', 'server'], function () {
                    done();
                });
                serverSocket.send(JSON.stringify({
                    to: ['index']
                }));
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
                        console.log('means received');
                        assert.deepEqual(ctxt.from, ['server', 'decides']);
                        assert.equal(ctxt.body.him, 'or');
                        assert.equal(ctxt.options.how, 'specifically');
                        done();
                    });
                    serverSocket.send(JSON.stringify({
                        to: ['means']
                        , from: ['decides']
                        , body: {
                            him: 'or'
                        }
                        ,options: {
                            how: 'specifically'
                        }
                    }));
                });

                it('should be transmitted from client to server', function (done) {
                    serverSocket.on('message', function (raw) {
                        var msg = JSON.parse(raw);
                        assert.deepEqual(msg.to, ['decides']);
                        assert.deepEqual(msg.from, ['you', 'did']);
                        assert.equal(msg.body.yeah, 'or');
                        assert.equal(msg.options.how, 'specifically');
                        done();
                    });
                    d.send(['server', 'decides'], ['you', 'did'], { yeah: 'or'}, { how: 'specifically' });
                });

            });

            describe('error events', function () {

                it('should be transmitted to server', function (done) {
                    serverSocket.on('message', function (raw) {
                        var ctxt = JSON.parse(raw);
                        assert.deepEqual(ctxt.to, ['error']);
                        assert.deepEqual(ctxt.from, ['you', 'did']);
                        assert.equal(ctxt.body.up, 'down');
                        assert.equal(ctxt.options.how, 'specifically');
                        done();
                    });
                    d.send(['error'], ['you', 'did'], { up: 'down'}, { how: 'specifically' });
                });
                
            });

            describe('disconnect', function () {
                
                it('should be emitted when the socket disconnects', function (done) {
                    d.waitFor(['disconnect', 'server'])
                        .then(function () {
                            done();
                        });
                    serverSocket.disconnect();
                });

                it('should be emitted to disconnect/server/**', function (done) {
                    d.waitFor(['disconnect', 'server', 'sub', 'host'])
                        .then(function () {
                            done();
                        });
                    serverSocket.disconnect();
                });

                describe('server', function () {
                    it('should respond unavailable', function (done) {
                        serverSocket.disconnect();
                        d.request(['server'])
                            .spread(function (body, options) {
                                assert.equal(options.statusCode, 503);
                                done();
                            });
                    });

                    it('should respond unavailable on subroutes', function (done) {
                        serverSocket.disconnect();
                        d.request(['server', 'ferrets'])
                            .spread(function (body, options) {
                                assert.equal(options.statusCode, 503);
                                done();
                            });
                    });
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
                serverSocket.send(JSON.stringify({
                    to: ['redirect']
                    , body: '/hector'
                    , options: {
                        gale: 'bedecher'
                    }
                }));
            });
        });    
    });

    describe('reconnecting', function () {

        var serverSocket;
        beforeEach(function (done) {
            var firstConnection = true;
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
});
