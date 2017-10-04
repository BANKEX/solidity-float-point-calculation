pragma solidity ^0.4.17;

contract FloatMath {
    
    uint256 constant SIGNIF_BITS = 236;
    uint256 constant EXP_BITS = 19;
    uint256 constant SIGN_BITS = 1;
    
    uint256 constant EXP_MIN = 0;
    uint256 constant EXP_BIAS = 262143;
    uint256 constant EXP_MAX = 524287;
    
    uint256 constant INT128_MAX = (uint256(1) << 127) - 1;
    uint256 constant INT128_MIN = (uint256(1) << 127);
    
    // bytes32 constant SIGN_REMOVAL_MASK = bytes32((uint256(2) << 19) - 1);
    
    uint256 constant SIGNIF_MAX = (uint256(2) << SIGNIF_BITS) - 1;
    uint256 constant SIGNIF_MIN = (uint256(1) << SIGNIF_BITS);
    bytes32 constant SIGNIF_MAX_BYTES = bytes32(SIGNIF_MAX);
    bytes32 constant SIGNIF_MIN_BYTES = bytes32(SIGNIF_MIN);

    bytes32 constant ZERO_BYTES = bytes32(0);

    // uint256 constant MAX_MULTIPLICATION_BITS = uint256(15);    
    // uint256 constant MAX_MULTIPLICATION_DIVISOR = (uint(2) << MAX_MULTIPLICATION_BITS);
    
    
    function toArray(bytes32 a) public pure returns (uint256[3] memory result) {
        if (a == ZERO_BYTES) {
            return result;
        }
        uint256 newSign = uint256(a >> 255);
        uint256 newExp = uint256((a << SIGN_BITS) >> (SIGNIF_BITS+SIGN_BITS));
        // uint256 newExp = uint256((a >> SIGNIF_BITS) & SIGN_REMOVAL_MASK);
        // uint256 newExp = uint256((a >> SIGNIF_BITS));
        uint256 newSignif = uint256((a << (EXP_BITS + SIGN_BITS)) >> (EXP_BITS + SIGN_BITS)) + SIGNIF_MIN;
        return [newSign, newExp, newSignif];
    }
    
    function fromArray(uint256[3] _array) public pure returns (bytes32 packed) {
        if (_array[0] == 0 && _array[1] == 0 && _array[2] == 0) {
            return ZERO_BYTES;
        }
        bytes32 packedSign = bytes32(_array[0] << 255);
        bytes32 packedExp = bytes32(_array[1] << SIGNIF_BITS);
        bytes32 packedSignif = bytes32(_array[2]) ^ SIGNIF_MIN_BYTES;    
        packed = packedSign | packedExp | packedSignif;
    }
    
    function add(bytes32 a, bytes32 b) public pure returns (bytes32 result) {
        uint256[3] memory aArray = toArray(a);
        uint256[3] memory bArray = toArray(b);
        return fromArray(addArrays(aArray, bArray));
    }
    
    function addArrays(uint256[3] aArray, uint256[3] bArray) public pure returns (uint256[3] memory result) {
        if (aArray[0] == 0 && aArray[1] == 0 && aArray[2] == 0) {
            return bArray;
        }
        if (bArray[0] == 0 && bArray[1] == 0 && bArray[2] == 0) {
            return aArray;
        }
        uint256 newExp = aArray[1];
        uint256 expA = aArray[1];
        uint256 expB = bArray[1];
        uint256 signifA = aArray[2];
        uint256 signifB = bArray[2];
        uint256 signA = aArray[0];
        uint256 signB = bArray[0];
        uint256 newSignif = 0;
        uint256 newSign = 0;

        if (expB > expA) {
            newExp = expB;
            signifA = signifA >> (expB - expA);
        } else if (expA > expB) {
            signifB = signifB >> (expA - expB);
        }
        
        if (signA + signB == 2) {
            newSign = 1;
            newSignif = signifA + signifB;
        } else if (signA == 1) {
            if (signifA > signifB) {
                newSignif = signifA - signifB;
                newSign = 1;
            } else if (signifB >= signifA) {
                newSignif = signifB - signifA;
                newSign = 0;
            }
        } else if (signB == 1) {
            if (signifB > signifA) {
                newSignif = signifB - signifA;
                newSign = 1;
            } else if (signifA >= signifB) {
                newSignif = signifA - signifB;
                newSign = 0;
            }
        } else {
            newSignif = signifA + signifB;
            newSign = 0;
        }
        if (newSignif == 0) {
            return [uint256(0), uint256(0), uint256(0)];
        }
        while (newSignif > SIGNIF_MAX) {
            newSignif = newSignif >> 1;
            newExp++;
        }
        while (newSignif < SIGNIF_MIN) {
            newSignif = newSignif << 1;
            newExp--;
        }        
        return [newSign, newExp, newSignif];
    }
   

    function negate(bytes32 a) public pure returns (bytes32 result) {
        if (a == ZERO_BYTES) {
            return a;
        }
        return a ^ bytes32(uint256(1) << 255);
    } 

    function negateArray(uint256[3] aArray) public pure returns (uint256[3] memory result) {
        if (aArray[0] == 0 && aArray[1] == 0 && aArray[2] == 0) {
            return aArray;
        }
        return [(aArray[0] + 1 )%2, aArray[1], aArray[2]];
    }
 
    function sub(bytes32 a, bytes32 b) public pure returns (bytes32 result) {
        uint256[3] memory aArray = toArray(a);
        uint256[3] memory bArray = toArray(negate(b));
        return fromArray(addArrays(aArray, bArray));
    }
    
    function subArrays(uint256[3] aArray, uint256[3] _bArray) public pure returns (uint256[3] memory result) {
        if (aArray[0] == 0 && aArray[1] == 0 && aArray[2] == 0) {
            return negateArray(_bArray);
        }
        if (_bArray[0] == 0 && _bArray[1] == 0 && _bArray[2] == 0) {
            return aArray;
        }
        uint256[3] memory bArray = negateArray(_bArray);
        return addArrays(aArray, bArray);
    }
  
    function mul(bytes32 a, bytes32 b) public pure returns (bytes32 result) {
        uint256[3] memory aArray = toArray(a);
        uint256[3] memory bArray = toArray(b);
        return fromArray(mulArrays(aArray, bArray));
    }
    
    function mulArrays(uint256[3] aArray, uint256[3] bArray) public pure returns (uint256[3] memory result) {
        if (aArray[0] == 0 && aArray[1] == 0 && aArray[2] == 0) {
            return [uint256(0), uint256(0), uint256(0)];
        }
        if (bArray[0] == 0 && bArray[1] == 0 && bArray[2] == 0) {
            return [uint256(0), uint256(0), uint256(0)];
        }
        uint256 newSign = (aArray[0] + bArray[0]) % 2;
        uint256 newExp = (aArray[1] + bArray[1]) - EXP_BIAS;
        if (newExp > EXP_MAX) {
            revert();
            newExp = EXP_MAX;
            newSignif = SIGNIF_MAX;
            return [newSign, newExp, newSignif];
        }

        uint256 topA = aArray[2] >> (SIGNIF_BITS >> 1);
        uint256 botA = aArray[2] << (255 - (SIGNIF_BITS >> 1)) >> 256;

        uint256 topB = bArray[2] >> (SIGNIF_BITS >> 1);
        uint256 botB = bArray[2] << (255 - (SIGNIF_BITS >> 1)) >> 256;

        uint256 bottomMul = botA*botB;
        uint256 midMul = topA*botB + botA*topB;
        uint256 newSignif = topA*topB;

        midMul = midMul + (bottomMul >> (SIGNIF_BITS >> 1));
        newSignif = newSignif + (midMul >> (SIGNIF_BITS >> 1));

        while (newSignif > SIGNIF_MAX) {
            newSignif = newSignif >> 1;
            newExp++;
        }
        return [newSign, newExp, newSignif];
    }   
    
    
    function div(bytes32 a, bytes32 b) public pure returns (bytes32 result) {
        uint256[3] memory aArray = toArray(a);
        uint256[3] memory bArray = toArray(b);
        return fromArray(divArrays(aArray, bArray));
    }
    
    function divArrays(uint256[3] aArray, uint256[3] bArray) public pure returns (uint256[3] memory result) {
        if (aArray[0] == 0 && aArray[1] == 0 && aArray[2] == 0) {
            return [uint256(0), uint256(0), uint256(0)];
        }
        if (bArray[0] == 0 && bArray[1] == 0 && bArray[2] == 0) {
            revert();
        }
        uint256 expA = aArray[1];
        uint256 expB = bArray[1];
        uint256 signifA = aArray[2];
        uint256 signifB = bArray[2];
        uint256 signA = aArray[0];
        uint256 signB = bArray[0];
        uint256 newExp = EXP_BIAS + expA - expB;
        assert(newExp > EXP_MIN && newExp < EXP_MAX);
        uint256 newSign = (signA + signB) % 2;
        uint256 newSignif = 0;
        uint256 cop = signifA;
        if (signifA < signifB) {
            cop = cop << 1;
            newExp--;
        }
        uint256 shift = SIGNIF_BITS;
        for (uint256 i = 0; i < SIGNIF_BITS; i++) {
            newSignif += (cop/signifB) << shift;
            shift--;
            cop = (cop % signifB) << 1;
        }
        return [newSign, newExp, newSignif];
    }    

    function compare(bytes32 a, bytes32 b) public pure returns (int8 result) {
        uint256[3] memory aArray = toArray(a);
        uint256[3] memory bArray = toArray(b);
        return compareArrays(aArray, bArray);
    }
    
    function compareArrays(uint256[3] aArray, uint256[3] bArray) public pure returns (int8 result) {
        if (aArray[0]==0 && bArray[0] == 0) {
            return compareAbsArrays(aArray, bArray);
        } else if (aArray[0]==1 && bArray[0] == 1) {
            return -compareAbsArrays(aArray, bArray);
        } else if (aArray[0] > bArray[0]) {
            return -1;
        }
        return 1;
    }

    function compareAbs(bytes32 a, bytes32 b) public pure returns (int8 result) {
        uint256[3] memory aArray = toArray(a);
        uint256[3] memory bArray = toArray(b);
        return compareAbsArrays(aArray, bArray);
    }

    function compareAbsArrays(uint256[3] aArray, uint256[3] bArray) public pure returns (int8 result) {
        if (aArray[1] > bArray[1]) {
            return 1;
        } else if (aArray[1] < bArray[1]) {
            return -1;
        } else {
            if (aArray[2] > bArray[2]) {
                return 1;
            } else if (aArray[2] < bArray[2]) {
                return -1;
            }
        }
        return 0;
    }

    function log2bytes(bytes32 a) public pure returns (bytes32 result) {
        uint256[3] memory aArray = toArray(a);
        return fromArray(log2Array(aArray));
    }
    
    function log2Array(uint256[3] aArray) public pure returns (uint256[3] memory result) {
        require(aArray[0] == 0);
        result = initFromIntToArray(int256(aArray[1]) - int256(EXP_BIAS));
        uint256[3] memory ONE = initFromIntToArray(1);
        uint256[3] memory TWO = initFromIntToArray(2);
        uint256[3] memory tmp = initFromIntToArray(int256(aArray[2]));
        uint256[3] memory ZERO = [uint256(0), uint256(0), uint256(0)];
        tmp[1] = tmp[1] - SIGNIF_BITS;
        uint256 numIterations = 64;
        for (uint256 i = 1; i <= numIterations; i++) {
            tmp = mulArrays(tmp, tmp);
            ZERO = mulArrays(ZERO, TWO);
            if (i==0) {
                return tmp;
            }
            if (compareArrays(tmp, TWO) == 1) {
                ZERO = addArrays(ZERO, ONE);
                tmp[1] = tmp[1] - 1;
            }
        }
        ZERO[1] = ZERO[1] - numIterations;
        // ZERO[1] = divArrays(ZERO, initFromIntToArray(int256(uint256(1) << numIterations)));
        result = addArrays(result, ZERO);
        return result;
    }

    function initFromInt(int256 a) public pure returns (bytes32 result) {
        uint256[3] memory tmp = initFromIntToArray(a);
        return fromArray(tmp);
    }
    
    function initFromIntToArray(int256 a) public pure returns (uint256[3] memory result) {
        int256 abs = a;
        uint256 newSign = 0;
        if (abs < 0) {
            newSign = 1;
            abs = -abs; 
        }
        uint256 newExp = EXP_BIAS + SIGNIF_BITS;
        uint256 newSignif = uint256(abs);
        while (newSignif > SIGNIF_MAX) {
            newSignif = newSignif >> 1;
            newExp++;
        }
        while (newSignif < SIGNIF_MIN) {
            newSignif = newSignif << 1;
            newExp--;
        }
        assert(newSignif >= SIGNIF_MIN && newSignif <= SIGNIF_MAX);
        assert(newExp < EXP_MAX && newExp > EXP_MIN);
        return [newSign, newExp, newSignif];
    }
    
    function toInt(bytes32 a) public pure returns (int128 result, int128 multiplier, int128 divisor) {
        uint256[3] memory tmp = toArray(a);
        return toIntFromArray(tmp);
    }
    
    function toIntFromArray(uint256[3] a) public pure returns (int128 result, int128 multiplier, int128 divisor) {
        uint256 shiftedMantisa = a[2];
        uint256 requiredShifts = a[1];
        multiplier = 1;
        divisor = 1;
        if (requiredShifts >= EXP_BIAS) {
            requiredShifts = requiredShifts - EXP_BIAS;
            if (a[0] == 0) {
                while (shiftedMantisa > INT128_MAX) {
                    shiftedMantisa = shiftedMantisa >> 1;
                    requiredShifts--;
                }
            } else {
                while (shiftedMantisa > INT128_MIN) {
                    shiftedMantisa = shiftedMantisa >> 1;
                    requiredShifts--;
                }
            }
            if (requiredShifts < 127) {
                result = int128(shiftedMantisa);
                if (a[0] == 1) {
                    result = -result;
                }
                multiplier = multiplier << requiredShifts;
            } else {
                while (requiredShifts >= 127) {
                    if (shiftedMantisa % 2 == 1) {
                        return (0, -1, -1);
                    }
                    shiftedMantisa = shiftedMantisa >> 1;
                    requiredShifts--;
                } 
                result = int128(shiftedMantisa);
                if (a[0] == 1) { 
                    result = -result;
                }
                multiplier = multiplier << requiredShifts;
            }
        } else {
            requiredShifts = EXP_BIAS - requiredShifts;
            if (a[0] == 0) {
                while (shiftedMantisa > INT128_MAX) {
                    shiftedMantisa = shiftedMantisa >> 1;
                    requiredShifts--;
                }
            } else {
                while (shiftedMantisa > INT128_MIN) {
                    shiftedMantisa = shiftedMantisa >> 1;
                    requiredShifts--;
                }
            }
            if (requiredShifts < 127) {
                result = int128(shiftedMantisa);
                if (a[0] == 1) {
                    result = -result;
                }
                divisor = divisor << requiredShifts;
            } else {
                while (requiredShifts >= 127) {
                    if (shiftedMantisa % 2 == 1) {
                        return (0, -1, -1);
                    }
                    shiftedMantisa = shiftedMantisa >> 1;
                    requiredShifts--;
                } 
                result = int128(shiftedMantisa);
                if (a[0] == 1) {
                    result = -result;
                }
                divisor = divisor << requiredShifts;
            }
        }
        return (result, multiplier, divisor);
    }
    
}


