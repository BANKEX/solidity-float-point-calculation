# Floating point math library

# Brought to you by Bankex Foundation

# WIP, not ready for production

## Fuctionality

Float point number is represented in a binary256 IEEE standard (so library operates on bytes32 and uint256[3] internally).

Included functions:

- add
- sub
- mul
- div (naive implementation, slow)
- log2

Planned functions:

- 2^x

Known issues:

- Non-normalized numbers are not properly represented
- Overflow is not processed

## What's inside

Crude core for library and set of tests, including helper functions to encode BigNumber into bytes32. Library is in a form of contract for ease of compilation in deployment (see Tester.sol for example).

## How to run

```bash
npm install
npm test
```

tests.js is a set of helper and test functions.


## Contributors

* [shamatar](https://github.com/shamatar)
* [skywinder](https://github.com/skywinder)

