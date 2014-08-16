var Tx = require('../lib/transaction.js');

var SHA3 = require('sha3'),
    assert = require('assert'),
    BigInteger = require('bigi'),
    ecdsa = require('ecdsa'),
    rlp = require('rlp'),
    CoinKey = require('coinkey');

var pk = new Buffer("3dcac7b50dc278c8e4e020400ac94663138eddcf7f23869974f3c8ebd924bdef", 'hex');

var ck = new CoinKey(pk, true);

var test = [
    "00",
    "09184e72a000",
    "2710",
    "0000000000000000000000000000000000000000",
    "00",
    "7f7465737400000000000000000000000000000000000000000000000000000000600057",
    "1b",
    "81cb24ccead346ca5881c0d074fdf9aea8f192576b54dd0ca692edb36c66a26a",
    "1dfca3df56127076498c082eb256e694717cb443a14c44812c999da8a7874db1"
];

var tx = new Tx(test);

var hashR = tx.hash(false);

var signature = ecdsa.sign(hashR, ck.privateKey);

// var curvePt = ecparams.g.multiply(BigInteger.fromBuffer(pk));
// var v = ecdsa.calcPubKeyRecoveryParam(e, signature, curvePt) + 27;

ecdsa.verify(hashR, signature, ck.publicKey);
