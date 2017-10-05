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
    // magicInverse();
    try{
        await testGasEstimates();
        await testEncodeDecode();
        await testAddition();
        await testSubtraction();
        await testMultiplication();
        await testFastInvSqrt();
        await testDivision();
        await testZERO();
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
    var binaryString = number.toString(2);
    binaryString = binaryString.substring(1);
    assert(binaryString.length == 236);
    var expString = exponent.toString(2);
    expString = expString.padStart(19, "0");
    assert(expString.length == 19);

    const final = signString + expString + binaryString;
    assert(final.length == 256);
    const tempNumber = new BigNumber(final, 2);
    const hexEncoded = tempNumber.toString(16);
    assert(hexEncoded.length == 64);
    return "0x"+ hexEncoded;
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
    var sign = 1;
    if (binaryString.substring(0,1) == "1"){
        sign = -1;
    }
    const expString = binaryString.substring(1,20);
    assert(expString.length == 19);
    var exponent = new BigNumber(expString, 2);
    const mantString = binaryString.substring(20);
    assert(mantString.length == 236);
    var mantisa = new BigNumber(mantString,2);
    mantisa = mantisa.add(SIGNIF_MIN);
    exponent = exponent.sub(EXP_BIAS+236);
    var number;
    if (exponent.toNumber() > 0){
        var number = mantisa.mul(TWO.pow(exponent)).mul(sign);
    } else if (exponent.toNumber() < 0) {
        var number = mantisa.div(TWO.pow(exponent.abs())).mul(sign);
    } else {
        var number = mantisa.mul(sign);
    }
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
        // console.log(a);
        const testA = decodeBNfromBytes32(a);
        assert(testA.equals(aBN));
        var res = await DeployedTesterContract.testIntToFloat(aBN);
        assert(a == res);
    }

    console.log("Encoding and decoding tested");
}


async function testGasEstimates() {
    var integer ="" + getRandomInt(1, 1000000000000000000001);
    const aBN = new BigNumber(integer);
    const a = encodeBNtoBytes32(aBN);
    integer ="" + getRandomInt(1, 1000000000000000000001);
    const bBN = new BigNumber(integer);
    const b = encodeBNtoBytes32(bBN);

    var res = await DeployedTesterContract.testIntToFloat.estimateGas(a);
    console.log("ENCODE estimate = "+res.toString());
    res = await DeployedTesterContract.testAddBytes.estimateGas(a,b);
    console.log("ADD estimate = "+res.toString());    
    res = await DeployedTesterContract.testSubBytes.estimateGas(a,b);
    console.log("SUB estimate = "+res.toString());
    res = await DeployedTesterContract.testMulBytes.estimateGas(a,b);
    console.log("MUL estimate = "+res.toString());
    res = await DeployedTesterContract.testDivBytes.estimateGas(a,b);
    console.log("DIV estimate = "+res.toString());
    res = await DeployedTesterContract.testLog2Bytes.estimateGas(a);
    console.log("LOG2 estimate = "+res.toString());
    res = await DeployedTesterContract.testFastInvSqrtBytes.estimateGas(a);
    console.log("FAST INV SQRT estimate = "+res.toString());
}
async function testZERO() {
    console.log("Test operations on zero");

    for (var i = 0; i < 10; i++){
        var integer ="" + getRandomInt(-1000000000000000000000, 1000000000000000000001);
        const aBN = new BigNumber(integer);
        const a = encodeBNtoBytes32(aBN);
        const bBN = new BigNumber(0);
        const b = encodeBNtoBytes32(bBN);
        var res = await DeployedTesterContract.testAddBytes(a,b);
        var num = decodeBNfromBytes32(res);
        assert(num.equals(aBN.add(bBN)));
        res = await DeployedTesterContract.testAddBytes(b,a);
        num = decodeBNfromBytes32(res);
        assert(num.equals(bBN.add(aBN)));


        res = await DeployedTesterContract.testSubBytes(a,b);
        num = decodeBNfromBytes32(res);
        assert(num.equals(aBN.sub(bBN)));
        res = await DeployedTesterContract.testSubBytes(b,a);
        num = decodeBNfromBytes32(res);
        assert(num.equals(bBN.sub(aBN)));

        res = await DeployedTesterContract.testMulBytes(a,b);
        num = decodeBNfromBytes32(res);
        assert(num.equals(aBN.mul(bBN)));
        res = await DeployedTesterContract.testMulBytes(b,a);
        num = decodeBNfromBytes32(res);
        assert(num.equals(bBN.mul(aBN)));

        res = await DeployedTesterContract.testDivBytes(b,a);
        num = decodeBNfromBytes32(res);
        assert(num.equals(bBN.div(aBN)));
    }

    console.log("Zero tests done");
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
            if(num.div(aBN.div(bBN)).sub(1).abs().gt(1e-2)){
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
            var integer = ""+ getRandomInt(1, 1000000000000000000000000000001);
            var aBN = new BigNumber(integer);
            const a = encodeBNtoBytes32(aBN);
            var res = await DeployedTesterContract.testLog2Bytes(a);
            var num = decodeBNfromBytes32(res);
            var expected = new BigNumber ("" + Math.log2(aBN.toNumber()));
            if(num.div(expected).sub(1).abs().gt(1e-3)) {
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

async function testFastInvSqrt() {
    console.log("Test fast inv sqrt");

    for (var i = 0; i < 10; i++) {
        try{
            var integer = ""+ getRandomInt(1, 1000000000000);
            var aBN = new BigNumber(integer);
            const a = encodeBNtoBytes32(aBN);
            var res = await DeployedTesterContract.testFastInvSqrtBytes(a);
            var num = decodeBNfromBytes32(res);
            var expected = (new BigNumber(1)).div(aBN.sqrt());
            if(num.div(expected).sub(1).abs().gt(1e-2)) {
                throw("Error in FAST INV SQRT");
            }
        }
        catch(err){
            console.log("Expected "+expected.toString());
            console.log("Got "+num.toString());
            throw(err);
        }
    }
    console.log("Fast inv sqrt test done");
} 

async function magicInverse() {
    const exp = 254; 
    const str = '1.0111111111111111100110111010110101000011000111101101010011011110101001110011011001111100000010111001010000010011111100111110111111110110011110110001010001100111100000010011101000111100001010001010011101100101100001110100101010101011101011001000100010001100101111101001000010010000001110011101011110010100111101001111110110010111010111110101100010010100101111010010001001111011001110100110011001010100100100011111010010001010000101001010101110011101011111110010101000111001001101001101001011001010111010100111011110010111011001110011010001010000001111100100100100111111100101001000100000101001110011110101111000111010110110011110001110011011110010100000001100000100111001101110110011010101111011001100010010100111111110011001011001011001000011101000110101011000111010111111111101100000000010000010111000111110000001100101100001110110101101111111101110010011111010000010100111110101000000011010010100101100001101100001110010000000000101011100010111001100111000111111000001011100100111011110011110010001111011001001111001011';
    const p = str.split('.');
    const magic = (p[0]+p[1].substring(0,exp)).padStart('0',256);
    console.log(magic);
    var aBN = new BigNumber(3);
    const a = encodeBNtoBytes32(aBN);
    console.log(a);
    const threeHalfs =  "0x3FFFF80000000000000000000000000000000000000000000000000000000000"
    const magicHex = new BigNumber(magic, 2);
    console.log("0x"+magicHex.toString(16));
} 

runTests();