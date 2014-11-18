var App = require('../'),
  fs = require('fs'),
  async = require('async');

var app,
  peers = [],
  numberOfPeers = 5, //the amount of peers to create in this test must be more than 3 for the tests to work properly
  startPort = 30316;

describe('basic app functions', function() {

  it('should start', function(done) {
    app = new App();
    app.start(done);
  });

  it('should stop', function(done) {
    app.stop(done);
  });

  it('should start serveral instances', function(done) {
    var count = 0;

    async.whilst(

      function() {
        return count < 5;
      },

      function(callback) {
        var settings = {
          'network': {
            'port': startPort,
            'host': '0.0.0.0'
          },
          'upnp': false,
          'rpc': false
        };

        count++;
        settings.network.port += count;
        settings.path = './test/testClient' + count;

        try {
          fs.mkdirSync(settings.path);
        } catch (e) {}

        var app = new App(settings);
        peers.push(app);
        app.start(callback);

      },

      function() {
        done();
      }
    );
  });

  it('two peers should connect to each other', function(done) {

    peers[1].network.on('message.hello', function() {
      done();
    });
    peers[0].network.connect(startPort + 2, '0.0.0.0');

  });
});
