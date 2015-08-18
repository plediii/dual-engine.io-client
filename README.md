# dual-engine.io-client [![Build Status](http://jenkins.plediii.net:8080/buildStatus/icon?job=dual-engine.io-client master)](http://jenkins.plediii.net:8080/job/dual-engine.io-client%20master/)

Allow a dualapi domain in a browser to communicate with a dualapi
domain behind an engine.io server.  The server side transport and example use is at [dual-engine.io](https://github.com/plediii/dual-engine.io).


Generally, the server is connected by providing `engine.io-client` to the domain.  The server domain will be provided at the requested mount point (in this case `server/..`), and we will receive `connect/server` upon successful connection.

```javascript
var dualapi = require('dualapi')
   .use(require('dual-engine.io-client'));

var d = dualapi()
    .mount({
        connect: {
            server: function () {
              // server is connected.  say hello
              d.send({ to: ['server', 'hello'], body: 'Hellooo!' });
            }
        }
    });

d.engineio(require('engine.io-client'), ['server']);
```

Use [browserify](http://browserify.org/) to build the client side
javascript.
