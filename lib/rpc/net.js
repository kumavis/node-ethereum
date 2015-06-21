
module.exports = {
  listening: listening,
  peerCount: peerCount,
}


function listening(params, cb) {
  if (this.app.network) {
    cb(null, this.app.network.listening);
  } else {
    cb(null, false);
  }
}

function peerCount(params, cb) {
  var peers;
  if (this.app.network) {
    peers = this.app.network.peers.length;
  } else {
    peers = 0;
  }
  cb(null, peers);
}