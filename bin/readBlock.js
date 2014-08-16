var rlp = require('rlp');
var levelup = require('levelup');

var db = levelup('./db/block');
var blocks = [];

db.createReadStream({
    keyEncoding: 'binary',
    valueEncoding: 'binary'
}).on('data', function (data) {
    var block = rlp.decode(data.value);
    block = buffersToStrings(block);
    blocks.push({
        hash: data.key.toString('hex'),
        serialized: data.value.toString('hex'),
        block: block
    });
    //console.log(data.key.toString('hex'));
}).on('error', function (err) {
    console.log('Oh my!', err);
}).on('end', function(){
    console.log(JSON.stringify(blocks));
});

var buffersToStrings = function (ba) {
    //ba = buffer array
    if (Buffer.isBuffer(ba)) {
        return ba.toString('hex');
    } else if (ba instanceof Array) {
        var array = [];
        for (var i = 0; i < ba.length; i++) {
            array.push(buffersToStrings(ba[i]));
        }
        return array;
    } else {
        console.error('WTF: ' + ba);
    }
};
