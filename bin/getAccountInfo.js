var Ethereum = require('../'),
    SHA3 = require('sha3'),
    rlp = require('rlp'),
    levelup = require('levelup');

var internals = {},
    Blockchain = Ethereum.Blockchain,
    VM = Ethereum.VM,
    Utils = Ethereum.utils,
    Account = Ethereum.Account,
    Trie = Ethereum.Trie,
    stateDB = levelup('/home/null/.ethereum/state');

var state = new Trie(stateDB);
var preState = new Buffer('f59585ef7ba9770cabb3dcbb4f60d4606ca145edc276afdc15964beced1c5c0a', 'hex');
var postState = new Buffer('e29fd98c044f24cadd747ee282d21ad0dd46101d04b2c217036a75de94eae971', 'hex');
var from = new Buffer('d553779eb424ed1cc3833b1be47ddf56ffe6e208', 'hex');
var to = new Buffer('746e738311a9a98ce647a8f1566b78414f38fee0', 'hex');

var created = VM.generateAddress(from, new Buffer([1]));
state.root = postState;

//get the from account 

state.get(from, function (err, preFromAccount) {
    preFromAccount = new Account(preFromAccount);
    console.log(Utils.BAToJSON(preFromAccount.raw));


    //state.root = postState;

    // state.get(from, function (err, postFromAccount) {
    //     postFromAccount = new Account(postFromAccount);

    //     state.get(new Buffer(created, 'hex'), function (err, postToAccount) {
    //         postToAccount = new Account(postToAccount);
    //         var stateRoot = postToAccount.stateRoot;
    //         console.log(JSON.stringify({
    //             preFromAccount: Utils.bufferToJSON(preFromAccount.raw),
    //             postFromAccount: Utils.bufferToJSON(postFromAccount.raw),
    //             postToAccount: Utils.bufferToJSON(postToAccount.raw),
    //             to: created
    //         }));
    //         // state.root = stateRoot;
    //         // var rs = state.createReadStream();
    //         // rs.on('data', function (data) {
    //         //     console.log('key' + data.key.toString('hex'));
    //         //     console.log('val' + data.value.toString('hex'));
    //         // })

    //     });
    // });



    // state.root = preFromAccount.stateRoot;
    // var stream = state.createReadStream();
    // stream.on("data", function (data) {
    //     console.log("key: " + data.key.toString("hex"));
    //     var decoded = rlp.decode(data.value);
    //     //console.log(data.value.toString('hex'));
    //     console.log("decoded: " + decoded.toString('hex'));
    // });
});
