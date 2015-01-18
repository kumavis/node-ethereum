const Rpc = require('./ethRPC.js'),
  Express = require('express'),
  bodyParser = require('body-parser');

module.exports = XhrRpc;

function XhrRpc(opts){

  var app = this.app = opts.app;
  var server = this.server = Express();
  var rpc = this.rpc = new Rpc({app: app});

  // parse application/json even if it doesnt say its json
  server.use(bodyParser.json({ type: 'application/*' }))

  // helpful message for wrong http verb
  server.get('/', function (req, res) {
    res.send('XHR JSON RPC available via POST');
  })

  // extract message and call rpc
  server.post('/', function (req, res) {
    var message = req.body || {};
    rpc.processRpc(message, function(err, data){
      if (err) {
        res.status(500).send({ error: err.message });
      } else {
        res.send(data);
      }
    })
  })

}

//the function that starts the application
XhrRpc.prototype.start = function(options, done) {
  var port = 8080;
  console.log('XhrRpcServer - opening: /:'+port)
  this.server.listen(port);
  done();
};

XhrRpc.prototype.stop = function(done) {
  // TODO - disable server
  done();
};
