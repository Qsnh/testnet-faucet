import { BytesLike, BigNumberish, providers } from 'ethers';
export declare type Address = string;
export declare type Signature = string;
export declare enum Network {
    Mainnet = 1,
    Ropsten = 3,
    Rinkeby = 4,
    Localhost = 9
}
export declare enum AccountType {
    ZkRollup = 0,
    ZkPorter = 1
}
export declare enum TransactionStatus {
    NotFound = "not-found",
    Processing = "processing",
    Committed = "committed",
    Finalized = "finalized"
}
export declare type BlockTag = number | string | 'committed' | 'finalized' | 'latest' | 'earliest' | 'pending';
export interface Token {
    address: Address;
    decimals: number;
    symbol?: string;
}
export interface EventFilter {
    topics?: Array<string | Array<string> | null>;
    address?: Address | Array<Address>;
    limit?: number;
    fromBlock?: BlockTag;
    toBlock?: BlockTag;
    blockHash?: string;
}
export interface TransactionResponse extends providers.TransactionResponse {
    waitFinalize(): Promise<providers.TransactionReceipt>;
}
export interface ExecutionParams {
    feeToken?: Address;
    fee?: BigNumberish;
    validFrom?: number;
    validUntil?: number;
    data?: BytesLike;
}
export interface DeployExecutionParams extends ExecutionParams {
    contractType: AccountType;
    feeToken: Address;
}
export interface CommonData {
    initiatorAddress: Address;
    feeToken: Address;
    nonce?: number;
    fee?: BigNumberish;
    validFrom?: number;
    validUntil?: number;
    signature?: BytesLike;
}
export interface Transfer extends CommonData {
    token: Address;
    to: Address;
    amount: BigNumberish;
}
export interface MigrateToPorter extends CommonData {
}
export interface Withdraw extends CommonData {
    to: Address;
    token: Address;
    amount: BigNumberish;
}
export interface DeployContract extends CommonData {
    accountType: AccountType;
    bytecode: Uint8Array;
    calldata?: Uint8Array;
}
export interface Execute extends CommonData {
    contractAddress: Address;
    calldata: Uint8Array;
}
export interface Fee {
    gasTxAmount: BigNumberish;
    gasPriceWei: BigNumberish;
    gasFee: BigNumberish;
    zkpFee: BigNumberish;
    totalFee: BigNumberish;
}
