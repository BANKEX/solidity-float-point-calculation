pragma solidity ^0.4.17;

import './FloatMath.sol';

contract Tester {
    FloatMath floatLib;

    // using FloatMath for bytes32;
    // using FloatMath for uint256[3];
    
    // bytes32 public res;
    
    // uint256 constant public SIGNIF_BITS = 236;
    // uint256 constant public EXP_BITS = 19;
    // uint256 constant public SIGN_BITS = 1;
    
    // uint256 constant public EXP_MIN = 0;
    // uint256 constant public EXP_BIAS = 262143;
    // uint256 constant public EXP_MAX = 524287;
    
    // uint256 constant public SIGNIF_MAX = (uint256(2) << (SIGNIF_BITS)) - 1;
    // uint256 constant public SIGNIF_MIN = (uint256(1) << SIGNIF_BITS);
    // bytes32 constant public SIGNIF_MAX_BYTES = bytes32(SIGNIF_MAX);
    // bytes32 constant public SIGNIF_MIN_BYTES = bytes32(SIGNIF_MIN);
    

    function testIntToFloat(int256 a) public view returns (bytes32 result) {
        result = floatLib.initFromInt(a);
        return result;
    }    

    function testBytesToArray(bytes32 a) public view returns (uint256[3] result) {
        // result = a.toArray();
        floatLib.toArray(a);
        return result;
    }

    function testAddBytes(bytes32 a, bytes32 b) public view returns (bytes32 result) {
        result = floatLib.add(a,b);
        return result;
    }

    function testSubBytes(bytes32 a, bytes32 b) public view returns (bytes32 result) {
        result = floatLib.sub(a,b);
        return result;
    }

    function testMulBytes(bytes32 a, bytes32 b) public view returns (bytes32 result) {
        result = floatLib.mul(a,b);
        return result;
    }

    function testDivBytes(bytes32 a, bytes32 b) public view returns (bytes32 result) {
        result = floatLib.div(a,b);
        return result;
    }

    function testLog2Bytes(bytes32 a) public view returns (bytes32 result) {
        result = floatLib.log2bytes(a);
        return result;
    }

    function testFastInvSqrtBytes(bytes32 a) public view returns (bytes32 result) {
        result = floatLib.fastInvSqrt(a);
        return result;
    }
     
    function Tester(address _flib) public {
        floatLib = FloatMath(_flib);
    }
    
}