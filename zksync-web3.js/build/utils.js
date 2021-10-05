"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDeployContractRequest = exports.serialize = exports.defaultCalldata = exports.sleep = exports.isETH = exports.RECOMMENDED_GAS_LIMIT = exports.EMPTY_SIGNATURE = exports.IERC20 = exports.ZKSYNC_MAIN_ABI = exports.ZKSYNC_WEB3_ABI = exports.ETH_ADDRESS = exports.MAX_TIMESTAMP = exports.MIN_TIMESTAMP = exports.parseCalldata = exports.calldataBytes = void 0;
const ethers_1 = require("ethers");
const utils_1 = require("ethers/lib/utils");
var calldata_1 = require("./calldata");
Object.defineProperty(exports, "calldataBytes", { enumerable: true, get: function () { return calldata_1.calldataBytes; } });
Object.defineProperty(exports, "parseCalldata", { enumerable: true, get: function () { return calldata_1.parseCalldata; } });
exports.MIN_TIMESTAMP = 0;
// JS's `number` cannot hold `2^64-1`, and using `Number.MAX_SAFE_INTEGER` caused an overflow
// in `ethers` conversion to `BigNumber`, thus we use 2^34-1.
// If you are in the year 2514 and looking at this line with frustration, please forgive us.
exports.MAX_TIMESTAMP = Math.pow(2, 34) - 1;
exports.ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
exports.ZKSYNC_WEB3_ABI = new ethers_1.utils.Interface(require('../abi/IZkSyncL2Proto.json').abi);
exports.ZKSYNC_MAIN_ABI = new ethers_1.utils.Interface(require('../abi/ZkSync.json').abi);
exports.IERC20 = new ethers_1.utils.Interface(require('../abi/IERC20.json').abi);
exports.EMPTY_SIGNATURE = new Uint8Array(65);
exports.RECOMMENDED_GAS_LIMIT = {
    ETH_DEPOSIT: 120000,
    ERC20_DEPOSIT: require('../misc/DepositERC20GasLimits.json'),
    ERC20_DEFAULT_DEPOSIT: 300000,
    ADD_TOKEN: 120000
};
function isETH(token) {
    if (token == ethers_1.constants.AddressZero) {
        console.warn(`You are using the Zero Address as a token. If you meant ETH, please use ${exports.ETH_ADDRESS} instead.`);
    }
    return token.toLowerCase() == exports.ETH_ADDRESS.toLowerCase();
}
exports.isETH = isETH;
function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
}
exports.sleep = sleep;
function defaultCalldata() {
    const calldata = new Uint8Array(256);
    calldata[224] = 1; // The constructor call byte.
    return calldata;
}
exports.defaultCalldata = defaultCalldata;
var serialize;
(function (serialize) {
    function withCommonDefaults(func) {
        return (tx) => {
            // remove empty fields
            Object.keys(tx).forEach((k) => tx[k] == null && delete tx[k]);
            return func({
                validFrom: exports.MIN_TIMESTAMP,
                validUntil: exports.MAX_TIMESTAMP,
                signature: exports.EMPTY_SIGNATURE,
                nonce: 0,
                fee: 0,
                ...tx
            });
        };
    }
    function serializer(txType, specialData) {
        return withCommonDefaults((tx) => exports.ZKSYNC_WEB3_ABI.encodeFunctionData(txType, [specialData(tx), commonData(tx)]));
    }
    function commonData(data) {
        return [
            data.nonce,
            data.validFrom,
            data.validUntil,
            data.feeToken,
            data.fee,
            data.initiatorAddress,
            Array.from(ethers_1.utils.arrayify(data.signature))
        ];
    }
    serialize.transfer = serializer('transfer', (tx) => [tx.token, tx.amount, tx.to]);
    serialize.withdraw = serializer('withdraw', (tx) => [tx.token, tx.amount, tx.to]);
    serialize.migrateToPorter = serializer('migrateToPorter', (tx) => [tx.initiatorAddress]);
    serialize.execute = serializer('execute', (tx) => [tx.contractAddress, tx.calldata]);
    serialize.deployContract = serializer('deployContract', (tx) => {
        var _a;
        return [
            tx.accountType,
            tx.bytecode,
            (_a = tx.calldata) !== null && _a !== void 0 ? _a : defaultCalldata()
        ];
    });
})(serialize = exports.serialize || (exports.serialize = {}));
function isDeployContractRequest(request) {
    return utils_1.isBytesLike(request['bytecode']) && (request['accountType'] === 0 || request['accountType'] === 1);
}
exports.isDeployContractRequest = isDeployContractRequest;
