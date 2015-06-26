/*jslint node: true */
/* global -Promise */
"use strict";

var isFunction =  function (x) {
    return Object.prototype.toString.call(x) == '[object Function]';
};

var makeUnavailable = function (d, point) {
    console.log(point.join('/') + ' is unavailable');
    d.unmount(point);
    d.mount(point, function (body, ctxt) {
        ctxt.return(false, { statusCode: 503 });
    });
};

var mount = function (d, point, socket) {
    console.log(point.join('/') + ' is available');
    d.unmount(point);
    d.mount(point, function (body, ctxt) {
        ctxt.return(true, { statusCode: 200 });
    });
    d.send({
        to: ['connect'].concat(point)
    });
    d.send({
        to: ['connect'].concat(point).concat('**')
    });
    socket.on('disconnect', function () {
        makeUnavailable(d, point);
        d.send({
            to: ['disconnect'].concat(point)
        });
        waitForIndex(d, point, socket);
    });
    socket.on('dual', function (msg) {
        d.send({
            to: msg.to
            , from: point.concat(msg.from)
            , body: msg.body
            , options: msg.options
        });
    });
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
};

var waitForIndex = function (d, point, socket) {
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

module.exports = function(Domain) {
    Domain.prototype.engineio = function (io, point, url, auth) {
        var d = this;
        if (isFunction(url)) {
            auth = url;
            url = false;
        }
        var socket;
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
                if (isFunction(async.then)) {
                    async.then(goAuth);
                } else {
                    goAuth(async);
                }
            });
        }

        makeUnavailable(d, point);
        waitForIndex(d, point, socket);
    };
};
