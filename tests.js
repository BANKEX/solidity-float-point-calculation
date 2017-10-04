#!/usr/bin/env node
const assert = require('assert');
const comp = require('./compile');
const moment = require('moment');
const coinstring = require('coinstring');
var fs = require("fs");
var solc = require('solc');
var Artifactor = require("truffle-artifactor"); 
var async = require("async");
var TestRPC = require("ethereumjs-testrpc");
var TruffleContract = require('truffle-contract');
var Web3 = require("web3");
const util = require('util');
var TesterContract;
var FloatLibContract
var DeployedTesterContract;
var DeployedFloatLibContract;
var allAccounts;
var fromBtcWif = coinstring.createDecoder(0x80);
var DECIMAL_MULTIPLIER_BN;
var web3;
var BigNumber;
var sendAsyncPromisified;
var getBlockNumberPromisified;
var getBalancePromisified;
var getAccountsPromisified;

const SET_DECIMALS = 18;

function startVM(){
    var provider = TestRPC.provider({
        total_accounts: 10,
        time:new Date(),
        verbose:false,
        gasPrice: 0,
      accounts:[
          {secretKey:"0x"+fromBtcWif("5JmrM8PB2d5XetmVUCErMZYazBotNzSeMrET26WK8y3m8XLJS98").toString('hex'), balance: 1e30},
          {secretKey:"0x"+fromBtcWif("5HtkDncwskEM5FiBQgU1wqLLbayBmfh5FSMYtLngedr6C6NhvWr").toString('hex'), balance: 1e30},
          {secretKey:"0x"+fromBtcWif("5JMneDeCfBBR1M6mX7SswZvC8axrfxNgoYKtu5DqVokdBwSn2oD").toString('hex'), balance: 1e30}    
      ],
        mnemonic: "42"
        // ,
        // logger: console
      });
      web3 = new Web3(provider);
      BigNumber = web3.BigNumber;
      sendAsyncPromisified = util.promisify(provider.sendAsync).bind(provider);
      var tmp_func = web3.eth.getBalance;
      delete tmp_func['call'];
      getBlockNumberPromisified= util.promisify(web3.eth.getBlockNumber);
      getBalancePromisified = util.promisify(tmp_func).bind(web3.eth);
      DECIMAL_MULTIPLIER_BN = new BigNumber(10**SET_DECIMALS);
      getAccountsPromisified = util.promisify(web3.eth.getAccounts);
}




function getBalance(address) {
    return async function(){
        var res = await getBalancePromisified.call(web3.eth, address);
        return res;
    }
}



function printResultsArray(results){
    results.forEach((el) => {
        if (el.__proto__ && el.__proto__.constructor.name == "BigNumber"){
            console.log(el.toNumber());
        }
        else if (typeof el == "string"){
            console.log(el);
        }
        else{
            console.log(web3.toAscii(el));
        }
    })
}


function deployContracts() {
    return async function() {
            console.log("Deploying contract...");
            DeployedFloatLibContract = await FloatLibContract.new();
            DeployedTesterContract = await TesterContract.new(DeployedFloatLibContract.address);
    }
}


function mine(numBlocks){
    return async function() {
    console.log("Mining a block");
    for (var i=0; i< numBlocks; i++){
        await sendAsyncPromisified({
                jsonrpc: "2.0",
                method: "evm_mine",
                params: [],
                id: new Date().getTime()
        });
    }
    }
}

async function populateAccounts(){
    allAccounts = await getAccountsPromisified();
    TesterContract= new TruffleContract(require("./build/contracts/Tester.json"));
    FloatLibContract = new TruffleContract(require("./build/contracts/FloatMath.json"));
    [TesterContract,FloatLibContract].forEach(function(contract) {
        contract.setProvider(web3.currentProvider);
        contract.defaults({
        gas: 3.5e6,
        from: allAccounts[0]
        })
    });
}

async function runTests() {
    await comp();

    await startVM();
    await populateAccounts();

    await deployContracts()();

    try{
        await testEncodeDecode();
        await testAddition();
        await testSubtraction();
        await testDivision();
        await testMultiplication();
        await testLog2(); 
    }
    catch(err){
        console.log(err);
        console.log("Test failed");
    }
}

const SIGNIF_BITS = 236;
const EXP_BIAS = 262143;

function encodeBNtoBytes32(number) {
    if (number.equals(0)){
        return "0x" + "0"*64;
    }
    // console.log(number.toNumber())
    var signString = "0"
    if (number < 0) {
        signString = "1";
    }

    const TWO = new BigNumber(2);
    const SIGNIF_MIN = TWO.pow(SIGNIF_BITS);
    const SIGNIF_MAX = TWO.pow(SIGNIF_BITS+1).sub(1);

    assert(SIGNIF_MIN.toString(2).length == 237);
    assert(SIGNIF_MAX.toString(2).length == 237);
    var exponent = new BigNumber(EXP_BIAS+236);
    number = number.abs();
    while (number.gt(SIGNIF_MAX)){
        number = number.divToInt(2);
        exponent = exponent.add(1);
    }
    while (number.lt(SIGNIF_MIN)){
        number = number.mul(2);
        exponent = exponent.sub(1);
    }
    assert(number.isInt());
    // console.log(SIGNIF_MIN.toString(2));
    var binaryString = number.toString(2);
    // console.log(binaryString);
    // console.log(binaryString.length);
    binaryString = binaryString.substring(1);
    assert(binaryString.length == 236);
    // console.log(binaryString);
    // console.log(binaryString.length);
    // console.log(exponent.toNumber());
    var expString = exponent.toString(2);
    expString = expString.padStart(19, "0");
    // console.log(expString);
    assert(expString.length == 19);

    const final = signString + expString + binaryString;
    assert(final.length == 256);
    // console.log(final);
    const tempNumber = new BigNumber(final, 2);
    const hexEncoded = tempNumber.toString(16);
    assert(hexEncoded.length == 64);
    return "0x"+ hexEncoded;
    // var res = number.div()
}

function decodeBNfromBytes32(bytesString) {
    bytesString = bytesString.substring(2);
    if (bytesString == '0'*64){
        return new BigNumber(0);
    }
    assert(bytesString.length == 64);
    const TWO = new BigNumber(2);
    const SIGNIF_MIN = TWO.pow(SIGNIF_BITS);
    const SIGNIF_MAX = TWO.pow(SIGNIF_BITS+1).sub(1);
    const tempNumber = new BigNumber(bytesString, 16);
    const binaryString = tempNumber.toString(2).padStart(256,"0");
    assert(binaryString.length == 256);
    // console.log(binaryString);
    var sign = 1;
    if (binaryString.substring(0,1) == "1"){
        sign = -1;
    }
    const expString = binaryString.substring(1,20);
    // console.log(expString);
    assert(expString.length == 19);
    var exponent = new BigNumber(expString, 2);
    // console.log(exponent.toNumber());
    const mantString = binaryString.substring(20);
    assert(mantString.length == 236);
    var mantisa = new BigNumber(mantString,2);
    mantisa = mantisa.add(SIGNIF_MIN);
    exponent = exponent.sub(EXP_BIAS+236);
    // console.log(exponent.toNumber());
    var number;
    if (exponent.toNumber() > 0){
        var number = mantisa.mul(TWO.pow(exponent)).mul(sign);
    } else if (exponent.toNumber() < 0) {
        var number = mantisa.div(TWO.pow(exponent.abs())).mul(sign);
    } else {
        var number = mantisa.mul(sign);
    }
    // console.log(number.toExponential());
    return number;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

async function testEncodeDecode(){
    console.log("Test encoding");

    for (var i = 0; i < 10; i++){
        var integer = "" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
        const aBN = new BigNumber(integer);
        const a = encodeBNtoBytes32(aBN);
        console.log(a);
        const testA = decodeBNfromBytes32(a);
        assert(testA.equals(aBN));
        var res = await DeployedTesterContract.testUintToFloat(aBN);
        assert(a == res);
    }

    console.log("Encoding and decoding tested");
}

async function testAddition() {
    console.log("Test add");

    for (var i = 0; i < 10; i++){
        var integer ="" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
        const aBN = new BigNumber(integer);
        const a = encodeBNtoBytes32(aBN);
        integer = "" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
        const bBN = new BigNumber(integer);
        const b = encodeBNtoBytes32(bBN);
        var res = await DeployedTesterContract.testAddBytes(a,b);
        const num = decodeBNfromBytes32(res);
        assert(num.equals(aBN.add(bBN)));
    }

    console.log("Add test done");
} 

async function testSubtraction() {
    console.log("Test sub");

    for (var i = 0; i < 10; i++){
        var integer ="" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
        const aBN = new BigNumber(integer);
        const a = encodeBNtoBytes32(aBN);
        integer = "" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
        const bBN = new BigNumber(integer);
        const b = encodeBNtoBytes32(bBN);
        var res = await DeployedTesterContract.testSubBytes(a,b);
        const num = decodeBNfromBytes32(res);
        assert(num.equals(aBN.sub(bBN)));
    }

    console.log("Sub test done");
} 

async function testMultiplication() {
    console.log("Test mul");

    for (var i = 0; i < 10; i++) {
        try{
            var integer ="" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
            var aBN = new BigNumber(integer);
            const a = encodeBNtoBytes32(aBN);

            integer = "" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
            var bBN = new BigNumber(integer);
            const b = encodeBNtoBytes32(bBN);
            var res = await DeployedTesterContract.testMulBytes(a,b);
            var num = decodeBNfromBytes32(res);
            if(!num.equals( aBN.mul(bBN) ) ) {
                throw("Error in MUL");
            }
        }
        catch(err){
            console.log("Expected "+aBN.mul(bBN).toString());
            console.log("Got "+num.toString());
            throw(err);
        }
    }
    console.log("Mul test done");
} 

async function testDivision() {
    console.log("Test div");

    for (var i = 0; i < 10; i++){
        try{
            var integer ="" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
            var aBN = new BigNumber(integer);
            const a = encodeBNtoBytes32(aBN);

            integer = "" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
            var bBN = new BigNumber(integer);
            const b = encodeBNtoBytes32(bBN);
            var res = await DeployedTesterContract.testDivBytes(a,b);
            var num = decodeBNfromBytes32(res);
            if(!num.equals( aBN.div(bBN) ) ){
                throw("Error in DIV");
            }
        }
        catch(err){
            console.log("Expected "+aBN.div(bBN).toString());
            console.log("Got "+num.toString());
            throw(err);
        }
    }

    console.log("Div test done");
} 

async function testLog2() {
    console.log("Test log2");

    for (var i = 0; i < 10; i++) {
        try{
            var integer = ""+ getRandomInt(1, 1025);
            // integer = "1000";
            var aBN = new BigNumber(integer);
            const a = encodeBNtoBytes32(aBN);
            var res = await DeployedTesterContract.testLog2Bytes(a);
            var num = decodeBNfromBytes32(res);
            var expected = new BigNumber ("" + Math.log2(aBN.toNumber()));
            if(num.div(expected).sub(1).abs().gt(1e-9)) {
                throw("Error in LOG2");
            }
        }
        catch(err){
            console.log("Expected "+expected.toString());
            console.log("Got "+num.toString());
            throw(err);
        }
    }
    console.log("Log2 test done");
} 

runTests();