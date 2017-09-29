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

Planned functions:

- log2
- 2^x

Known issues:

- Non-normalized numbers are not properly represented
- Zero is not properly prepresented
- Overflow is not processed

## What's inside

Crude core for library and set of tests, including helper functions to encode BigNumber into bytes32.

## How to run

```bash
npm install
npm test
```

tests.js is a set of helper and test functions.


## Contributors

* [shamatar](https://github.com/shamatar)
* [skywinder](https://github.com/skywinder)

