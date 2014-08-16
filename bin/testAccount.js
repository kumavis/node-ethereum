var Trie = require('merkle-patricia-tree');
var rlp = require('rlp');
var levelup = require('levelup');
var Account = require('../lib/account');

var db = levelup('/home/null/.ethereum/state');
var root = "e8e9e2cbd2b6109a191434b6eb052f4178223821939f2226df9104f07f50f927";
//var account =  new Buffer('9bcd1d820a8f97a55dc4027cc819e0c17fc93212','hex');

// db.createReadStream({ keyEncoding: 'binary'})
//     .on('data', function (data) {
//         // console.log(data.key, '=', data.value)
//         console.log(data.key.toString('hex'));
//     })
//     .on('error', function (err) {
//         console.log('Oh my!', err)
//     })
//     .on('close', function () {
//         console.log('Stream closed')
//     })
//     .on('end', function () {
//         console.log('Stream closed')
//     })
//
//     {
//       [[0]]: "test"
//       }

var trie = new Trie(db, root);
// var stateRoot;
// trie.get(account, function(err, data){
//     data = rlp.decode(data);
//     console.log(data);
//     console.log(data[2].toString('hex'));
//     stateRoot = data[2];
//     //var account = new Account(data);
//     //storage
//     var trie2 = new Trie(db, stateRoot);
//     var readStream = trie2.createReadStream();
//     readStream.on('data', function(data){
//         console.log(data.value.toString('hex'));
//     });
// });

var stream = trie.createReadStream();
stream.on("data", function (data) {
    console.log("key: " + data.key.toString("hex"));
    var decoded = rlp.decode(data.value);
    console.log(decoded);
});
