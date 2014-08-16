var Trie = require('merkle-patricia-tree');
var TR = require('../lib/transactionReceipt.js');
var rlp = require('rlp');
var utils = require('../lib/utils.js');

var testBlock = {
    'hash': 'fc5ea6ac58c2437e0066721944aacd39c62ffe86bc4cee5b65cb7b12e623ecf3',
    'serialized': 'f9016cf8d3a09f5e06abc1b483cb322983f903b56b10b134d700c58f416603520873945cd69fa01dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d493479472c6c2d924b81d5c2f8b8d82722d0d14d567ab86a05fd7ab25b6b9c40b7e6923804093a83bbb5e661a96b49badc3601af1da61ebf3a01479de8782319d163db43803ec710439c1af7b003995aba2f0904b59f1ceb58483400ff7058609184e72a000830f2f358201f48453af365680a05e8f157bc2b1e47fed5e5cfb49b117fc8ddc1c9415bba1bd55a25515b2ef3504f894f892f86c808609184e72a0008201f4941a26338f0d905e295fccb71fa9ea849ffa12aaf4876a94d74f430000801ca0d61cc692686d37a0ce8dc24e29e7923790d0c539a6d2f26577b7aa67c3c02c91a074945c912f39e584011220037ae0da384902537fe0000ff27db7e1d73ba9e88fa09b28804a78762581995538eb830d96523fa47467f9800dab0202aa45333bc7ec8201f4c0',
    'block': [
        [
            '9f5e06abc1b483cb322983f903b56b10b134d700c58f416603520873945cd69f',
            '1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
            '72c6c2d924b81d5c2f8b8d82722d0d14d567ab86',
            '5fd7ab25b6b9c40b7e6923804093a83bbb5e661a96b49badc3601af1da61ebf3',
            '1479de8782319d163db43803ec710439c1af7b003995aba2f0904b59f1ceb584',
            '400ff7',
            '05',
            '09184e72a000',
            '0f2f35',
            '01f4',
            '53af3656',
            '00',
            '5e8f157bc2b1e47fed5e5cfb49b117fc8ddc1c9415bba1bd55a25515b2ef3504'
        ],
        [
            [
                [
                    '00',
                    '09184e72a000',
                    '01f4',
                    '1a26338f0d905e295fccb71fa9ea849ffa12aaf4',
                    '6a94d74f430000',
                    '00',
                    '1c',
                    'd61cc692686d37a0ce8dc24e29e7923790d0c539a6d2f26577b7aa67c3c02c91',
                    '74945c912f39e584011220037ae0da384902537fe0000ff27db7e1d73ba9e88f'
                ],
                '9b28804a78762581995538eb830d96523fa47467f9800dab0202aa45333bc7ec',
                '01f4'
            ]
        ],
        []
    ]
};

var trans = [
    [
        new Buffer('00', 'hex'),
        new Buffer('09184e72a000', 'hex'),
        new Buffer('01f4', 'hex'),
        new Buffer('1a26338f0d905e295fccb71fa9ea849ffa12aaf4', 'hex'),
        new Buffer('6a94d74f430000', 'hex'),
        new Buffer('00', 'hex'),
        new Buffer('1c', 'hex'),
        new Buffer('d61cc692686d37a0ce8dc24e29e7923790d0c539a6d2f26577b7aa67c3c02c91', 'hex'),
        new Buffer('74945c912f39e584011220037ae0da384902537fe0000ff27db7e1d73ba9e88f', 'hex')
    ],
    new Buffer('9b28804a78762581995538eb830d96523fa47467f9800dab0202aa45333bc7ec', 'hex'),
    new Buffer('01f4', 'hex')
];

var trie = new Trie();
var key = new Buffer(32);
key.fill(0);

var val = rlp.encode(trans);

var tr = new TR(trans);

trie.put(rlp.encode(0), tr.serialize());
trie.put(rlp.encode(1), tr.serialize(), function () {
    console.log(trie.root.toString('hex'));
});

console.log(tr.serialize().toString("hex") === val.toString('hex'));
