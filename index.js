/*jslint node: true */
/* global -Promise */
"use strict";

var isFunction =  function (x) {
    return Object.prototype.toString.call(x) == '[object Function]';
};

module.exports = function(Domain, libs) {
    Domain.prototype.engineio = function (io, point, options) {
        var d = this;
        options = options || {};
        var url = options.url;
        var auth = options.auth;
        var outgoing = options.outgoing;
        var reconnect;
        if (options.hasOwnProperty('reconnect')) {
            reconnect = options.reconnect;
        } else {
            reconnect = 5;
        }
        var socket;
        var connect = function () {
            if (url && isFunction(url)) {
                libs.Promise.resolve(url())
                    .then(function (resolvedUrl) {
                        socket = io(resolvedUrl);
                        waitForIndex();
                    });
            } else {
                if (url) {
                    socket = io(url);
                } else {
                    socket = io();
                }
                waitForIndex();
            }
        };
        var goReconnect = function () {
            if (reconnect) {
                setTimeout(function () {
                    connect();
                }, 1000 * reconnect);
            }
        };
        var tryParse = function (raw) {
            try {
                return JSON.parse(raw);
            } catch (e) {
                return raw;
            }
        };

        var fromServer = function (raw) {
            var msg = tryParse(raw);
            d.send({
                to: msg.to
                , from: point.concat(msg.from)
                , body: msg.body
                , options: msg.options
            });
        };

        var handleDisconnect = function () {
            makeUnavailable();
            d.send({
                to: ['disconnect'].concat(point)
            });
            d.send({
                to: ['disconnect'].concat(point).concat('**')
            });
            goReconnect();
        };

        var errorHandler = function (body, ctxt) {
            socket.send(JSON.stringify(ctxt));
        };

        var makeUnavailable = function () {
            console.log(point.join('/') + ' is unavailable');
            if (socket) {
                socket.removeListener('message', fromServer);
                socket.removeListener('close', handleDisconnect);
            }
            d.unmount(point);
            d.unmount(['error'], errorHandler);
            d.mount(point, function (body, ctxt) {
                ctxt.return(false, { statusCode: 503 });
            });
        };

        var serverSend = function (ctxt) {
            socket.send(JSON.stringify({
                to: ctxt.params.serverRoute
                , from: ctxt.from
                , body: ctxt.body
                , options: ctxt.options
            }));
        };

        var serverHost = function (body, ctxt) {
            serverSend(ctxt);
        };
        if (outgoing) {
            serverHost = function (body, ctxt) {
                outgoing(ctxt);
                serverSend(ctxt);
            };
        }

        var mount = function () {
            console.log(point.join('/') + ' is available');
            d.unmount(point);
            d.mount(point, function (body, ctxt) {
                ctxt.return(true, { statusCode: 200 });
            });
            socket.on('close', handleDisconnect);
            socket.on('message', fromServer);
            d.mount(point.concat('::serverRoute'), serverHost);
            d.mount(['error'], errorHandler);
            d.send({
                to: ['connect'].concat(point)
            });
        };

        var waitForIndex = function () {
            var cleanup = function () {
                if (socket) {
                    socket.removeListener('message', indexListener);
                    socket.removeListener('close', goClose);
                }
            };
            var goClose = function () {
                cleanup();
                goReconnect();
            };
            var indexListener = function (raw) {
                var msg = tryParse(raw);
                if (!msg.to) {
                    if (auth) {
                        var goAuth = function (response) {
                            if (socket) {
                                socket.send(response);
                            }
                        };
                        var async = auth(raw);
                        if (async && isFunction(async.then)) {
                            async.then(goAuth);
                        } else {
                            goAuth(async);
                        }
                    }
                } else if (msg.to[0] === 'index'
                    && msg.to.length === 1) {
                    cleanup();
                    mount(d, point, socket);
                } else if (msg.to[0] == 'redirect' 
                           && msg.to.length === 1) {
                    reconnect = false;
                    d.send({
                        to: ['redirect']
                        , from: point
                        , body: msg.body
                        , options: msg.options
                    });
                }
            };
            socket.on('close', goClose);
            socket.on('message', indexListener);
        };
        makeUnavailable();
        connect();
        return {
            disconnect: function () {
                reconnect = false;
                socket.close();
                socket = null;
            }
        };
    };
};
