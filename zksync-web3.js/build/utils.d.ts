import { utils } from 'ethers';
import { Transfer, Withdraw, MigrateToPorter, Execute, DeployContract, Address } from './types';
export { calldataBytes, parseCalldata } from './calldata';
export declare const MIN_TIMESTAMP = 0;
export declare const MAX_TIMESTAMP: number;
export declare const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export declare const ZKSYNC_WEB3_ABI: utils.Interface;
export declare const ZKSYNC_MAIN_ABI: utils.Interface;
export declare const IERC20: utils.Interface;
export declare const EMPTY_SIGNATURE: Uint8Array;
export declare const RECOMMENDED_GAS_LIMIT: {
    ETH_DEPOSIT: number;
    ERC20_DEPOSIT: any;
    ERC20_DEFAULT_DEPOSIT: number;
    ADD_TOKEN: number;
};
export declare function isETH(token: Address): boolean;
export declare function sleep(millis: number): Promise<unknown>;
export declare function defaultCalldata(): Uint8Array;
export declare namespace serialize {
    const transfer: (tx: Transfer) => string;
    const withdraw: (tx: Withdraw) => string;
    const migrateToPorter: (tx: MigrateToPorter) => string;
    const execute: (tx: Execute) => string;
    const deployContract: (tx: DeployContract) => string;
}
