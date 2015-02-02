var App = require('../'),
  fs = require('fs'),
  path = require('path'),
  cp = require('child_process'),
  async = require('async'),
  Block = require('ethereumjs-lib').Block,
  jsonBC = require('ethereum-tests').blockTests.basicBlockChain.blockchain;

var app;
describe('basic app functions', function() {

  it('should start', function(done) {
    app = new App();
    app.start(done);
  });

  it('should load the blockchain', function(done){
    var blocks = [];
    jsonBC.reverse();
    //lets only process 4 blocks
    jsonBC.slice(0, 4);
    jsonBC.forEach(function(json){
      blocks.push(new Block(json));
    });

    app.processBlocks(blocks, done);
  });

  it('should stop', function(done) {
    app.stop(done);
  });

});
