var RPC = module.exports = function (app) {
  this.app = app;
};

RPC.prototype.runCall = function (message, cb) {
  var rpcMsg = rpcParse(message);
  if (rpcMsg.error) {
    cb(JSON.stringify(message));
  } else {
    this.app.api[rpcMsg.method](rpcMsg.params, function (results) {
      cb(JSON.stringify({
        'jsonrpc': '2.0',
        'result': results,
        'id': rpcMsg.id
      }));
    });
  }
};

function rpcParse(raw) {
  var data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return {
      'jsonrpc': '2.0',
      'error': {
        'code': -32700,
        'message': 'Parse error'
      },
      'id': null
    };
  }

  if (data.jsonrpc !== '2.0' || !data.method) {
    return {
      'jsonrpc': '2.0',
      'error': {
        'code': -32600,
        'message': 'Invalid Request'
      },
      'id': null
    };
  }
  return data;
}
