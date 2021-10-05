import { BytesLike, BigNumberish, providers } from 'ethers';

// 0x-prefixed, hex encoded, ethereum account address
export type Address = string;
// 0x-prefixed, hex encoded, ECDSA signature.
export type Signature = string;

// Ethereum network
export enum Network {
    Mainnet = 1,
    Ropsten = 3,
    Rinkeby = 4,
    Localhost = 9
}

export enum AccountType {
    ZkRollup = 0,
    ZkPorter = 1
}

export enum PriorityQueueType {
    Deque = 0,
    Heap = 1
}

export enum PriorityOpTree {
    Full = 0,
    Rollup = 1
}

export enum TransactionStatus {
    NotFound = 'not-found',
    Processing = 'processing',
    Committed = 'committed',
    Finalized = 'finalized'
}

// prettier-ignore
export type BlockTag =
    | number
    | string // hex number
    | 'committed'
    | 'finalized'
    | 'latest'
    | 'earliest'
    | 'pending';

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

export interface DeployContractRequest extends providers.TransactionRequest {
    accountType: AccountType;
    bytecode: BytesLike;
    data: BytesLike;
}

// special zkSync execution parameters
export interface ExecutionParams {
    feeToken?: Address;
    fee?: BigNumberish;
    validFrom?: number;
    validUntil?: number;
    data?: BytesLike;
}

export interface DeployExecutionParams extends ExecutionParams {
    contractType: AccountType;
    feeToken: Address; // feeToken is mandatory here
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
    // Nothing to add here: you can only migrate your own account,
    // and initiatorAddress is already present in `CommonData`.
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
    // Amount of gas used by transaction
    gasTxAmount: BigNumberish;
    // Gas price (in wei)
    gasPriceWei: BigNumberish;
    // Ethereum gas part of fee (in wei)
    gasFee: BigNumberish;
    // Zero-knowledge proof part of fee (in wei)
    zkpFee: BigNumberish;
    // Total fee amount (in wei)
    totalFee: BigNumberish;
}
