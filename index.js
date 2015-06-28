/*jslint node: true */
/* global -Promise */
"use strict";

var isFunction =  function (x) {
    return Object.prototype.toString.call(x) == '[object Function]';
};

module.exports = function(Domain) {
    Domain.prototype.engineio = function (io, point, options) {
        var d = this;
        options = options || {};
        var url = options.url;
        var auth = options.auth;
        var reconnect;
        if (options.hasOwnProperty('reconnect')) {
            reconnect = options.reconnect;
        } else {
            reconnect = 5;
        }
        var socket;
        var connect = function () {
            if (url) {
                socket = io(url);
            } else {
                socket = io();
            }
            waitForIndex();
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
            if (reconnect) {
                setTimeout(function () {
                    connect();
                }, reconnect);
            }
        };

        var makeUnavailable = function () {
            console.log(point.join('/') + ' is unavailable');
            if (socket) {
                socket.removeListener('message', fromServer);
                socket.removeListener('close', handleDisconnect);
            }
            d.unmount(point);
            d.mount(point, function (body, ctxt) {
                ctxt.return(false, { statusCode: 503 });
            });
        };

        var mount = function () {
            console.log(point.join('/') + ' is available');
            d.unmount(point);
            d.mount(point, function (body, ctxt) {
                ctxt.return(true, { statusCode: 200 });
            });
            socket.on('close', handleDisconnect);
            socket.on('message', fromServer);
            d.mount(point.concat('::serverRoute'), function (body, ctxt) {
                socket.send(JSON.stringify({
                    to: ctxt.params.serverRoute
                    , from: ctxt.from
                    , body: ctxt.body
                    , options: ctxt.options
                }));
            });
            d.mount(['error'], function (body, ctxt) {
                socket.send(JSON.stringify(ctxt));
            });
            d.send({
                to: ['connect'].concat(point)
            });
        };

        var waitForIndex = function () {
            var cleanup = function () {
                socket.removeListener('message', indexListener);
                socket.removeListener('close', goClose);
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
                            socket.send(response);
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
    };
};
