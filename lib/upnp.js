const natUpnp = require('nat-upnp');
const getIP = require('external-ip')();
const log = require('npmlog');

const client = natUpnp.createClient();
var started = false;
var port;

//map ports
exports.map = function(p, cb) {
  started = true;
  port = p;

  client.portMapping({
    public: port,
    private: port,
    description: 'ethereum-node',
    ttl: 0
  }, function(err) {
    if (err) {
      if(err){
        log.warn('unpn', err.toString());
      }
      cb();
    }
  });
};

//unmaps port
exports.unmap = function(cb) {
  if (started) {
    client.portUnmapping({
      public: port
    }, function() {
      started = false;
      client.close();
      cb();
    });
  } else {
    try {
      client.close();
    } catch (e) {}
    cb();
  }
};

//wraped for async
exports.extrenalIp = function(done) {
  if (started) {
    client.externalIp(function(err, ip) {
      err = null;
      //ignore timeout erros
      done(null, ip);
    });
  } else {
    getIP(function(err, ip) {
      done(err, ip);
    });
  }
};
