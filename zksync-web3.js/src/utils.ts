import { utils, constants } from 'ethers';
import { CommonData, Transfer, Withdraw, MigrateToPorter, Execute, DeployContract, Address } from './types';
export { calldataBytes, parseCalldata } from './calldata';

export const MIN_TIMESTAMP = 0;
// JS's `number` cannot hold `2^64-1`, and using `Number.MAX_SAFE_INTEGER` caused an overflow
// in `ethers` conversion to `BigNumber`, thus we use 2^34-1.
// If you are in the year 2514 and looking at this line with frustration, please forgive us.
export const MAX_TIMESTAMP = Math.pow(2, 34) - 1;

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const ZKSYNC_WEB3_ABI = new utils.Interface(require('../abi/IZkSyncL2Proto.json').abi);
export const ZKSYNC_MAIN_ABI = new utils.Interface(require('../abi/ZkSync.json').abi);
export const IERC20 = new utils.Interface(require('../abi/IERC20.json').abi);
export const EMPTY_SIGNATURE = new Uint8Array(65);

export const RECOMMENDED_GAS_LIMIT = {
    ETH_DEPOSIT: 90_000,
    ERC20_DEPOSIT: require('../misc/DepositERC20GasLimits.json'),
    ERC20_DEFAULT_DEPOSIT: 300_000,
    ADD_TOKEN: 120_000
};

export function isETH(token: Address) {
    if (token == constants.AddressZero) {
        console.warn(`You are using the Zero Address as a token. If you meant ETH, please use ${ETH_ADDRESS} instead.`);
    }
    return token.toLowerCase() == ETH_ADDRESS.toLowerCase();
}

export function sleep(millis: number) {
    return new Promise((resolve) => setTimeout(resolve, millis));
}

export function defaultCalldata(): Uint8Array {
    const calldata = new Uint8Array(256);
    calldata[224] = 1; // The constructor call byte.
    return calldata;
}

export namespace serialize {
    function withCommonDefaults<T extends CommonData, K>(func: (tx: T) => K): (tx: T) => K {
        return (tx: T) => {
            // remove empty fields
            Object.keys(tx).forEach((k) => tx[k] == null && delete tx[k]);
            return func({
                validFrom: MIN_TIMESTAMP,
                validUntil: MAX_TIMESTAMP,
                signature: EMPTY_SIGNATURE,
                nonce: 0,
                fee: 0,
                ...tx
            });
        };
    }

    function serializer<T extends CommonData>(txType: string, specialData: (tx: T) => any[]): (tx: T) => string {
        return withCommonDefaults((tx) =>
            ZKSYNC_WEB3_ABI.encodeFunctionData(txType, [specialData(tx), commonData(tx)])
        );
    }

    function commonData(data: CommonData) {
        return [
            data.nonce,
            data.validFrom,
            data.validUntil,
            data.feeToken,
            data.fee,
            data.initiatorAddress,
            Array.from(utils.arrayify(data.signature))
        ];
    }

    export const transfer = serializer('transfer', (tx: Transfer) => [tx.token, tx.amount, tx.to]);
    export const withdraw = serializer('withdraw', (tx: Withdraw) => [tx.token, tx.amount, tx.to]);
    export const migrateToPorter = serializer('migrateToPorter', (tx: MigrateToPorter) => [tx.initiatorAddress]);
    export const execute = serializer('execute', (tx: Execute) => [tx.contractAddress, tx.calldata]);
    export const deployContract = serializer('deployContract', (tx: DeployContract) => [
        tx.accountType,
        tx.bytecode,
        tx.calldata ?? defaultCalldata()
    ]);
}
