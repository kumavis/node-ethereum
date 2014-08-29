var natUpnp = require('nat-upnp'),
  client = natUpnp.createClient(),
  started = false,
  port;

//map ports
exports.map = function (p, cb) {

  started = true;
  port = p;

  client.portMapping({
    public: port,
    private: port,
    description: 'ethereum-node',
    ttl: 0
  }, function (err) {
    cb(err);
  });
};

//unmaps port
exports.unmap = function (cb) {
  if (started) {
    client.portUnmapping({
      public:port
    }, function () {
      started = false;
      client.close();
      cb();
    });
  } else {
    client.close();
    cb();
  }
};

//wraped for async
exports.extrenalIp = function(done){
  client.externalIp(done);
};
