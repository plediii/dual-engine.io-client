/*jslint node: true */
/* global -Promise */
"use strict";

var isFunction =  function (x) {
    return Object.prototype.toString.call(x) == '[object Function]';
};

module.exports = function(Domain) {
    Domain.prototype.engineio = function (io, point, url, auth) {
        var d = this;
        if (isFunction(url)) {
            auth = url;
            url = false;
        }
        var socket;
        if (url) {
            socket = io(url);
        } else {
            socket = io();
        }

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
            waitForIndex(d, point, socket);
        };

        var makeUnavailable = function () {
            console.log(point.join('/') + ' is unavailable');
            socket.removeListener('message', fromServer);
            socket.removeListener('close', handleDisconnect);
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
            console.log('mountin');
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
                    socket.removeListener('message', indexListener);
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
            socket.on('message', indexListener);
        };

        makeUnavailable();
        waitForIndex();
    };
};
