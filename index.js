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
        console.log('connecting');
        if (url) {
            socket = io.connect(url);
        } else {
            socket = io.connect();
        }
        
        if (auth) {
            socket.on('dual-auth', function (challenge) {
                var goAuth = function (response) {
                    socket.emit('dual-auth', response);
                };

                var async = auth(challenge);
                if (async && isFunction(async.then)) {
                    async.then(goAuth);
                } else {
                    goAuth(async);
                }
            });
        }

        var toServer = function (msg) {
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
            socket.removeListener('dual', toServer);
            socket.removeListener('disconnect', handleDisconnect);
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
            socket.on('disconnect', handleDisconnect);
            socket.on('dual', toServer);
            d.mount(point.concat('::serverRoute'), function (body, ctxt) {
                socket.emit('dual', {
                    to: ctxt.params.serverRoute
                    , from: ctxt.from
                    , body: ctxt.body
                    , options: ctxt.options
                });
            });
            d.mount(['error'], function (body, ctxt) {
                socket.emit('dual', ctxt.toJSON());
            });
            d.send({
                to: ['connect'].concat(point)
            });
        };

        var waitForIndex = function () {
            var indexListener = function (msg) {
                if (msg.to[0] === 'index'
                    && msg.to.length === 1) {
                    socket.removeListener('dual', indexListener);
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
            socket.on('dual', indexListener);
        };

        makeUnavailable();
        waitForIndex();
    };
};
