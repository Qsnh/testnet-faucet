import { EIP712Signer } from './signer';
import { Provider } from './provider';
import { ethers, utils, BigNumberish, BigNumber } from 'ethers';
import { Address, AccountType, PriorityQueueType, PriorityOpTree, ExecutionParams, BlockTag } from './types';
import { ProgressCallback } from '@ethersproject/json-wallets';
export declare class Wallet extends ethers.Wallet {
    readonly signer: EIP712Signer;
    readonly provider: Provider;
    protected params?: ExecutionParams;
    readonly providerL1?: ethers.providers.Provider;
    getBalance(token?: Address, blockTag?: BlockTag): Promise<ethers.BigNumber>;
    getBalanceL1(token?: Address, blockTag?: ethers.providers.BlockTag): Promise<BigNumber>;
    connect(provider: Provider): Wallet;
    static fromMnemonic(mnemonic: string, path?: string, wordlist?: ethers.Wordlist): Wallet;
    static fromEncryptedJson(json: string, password?: string | ethers.Bytes, callback?: ProgressCallback): Promise<Wallet>;
    static fromEncryptedJsonSync(json: string, password?: string | ethers.Bytes): Wallet;
    static createRandom(options?: any): Wallet;
    constructor(privateKey: ethers.BytesLike | utils.SigningKey, providerL2?: Provider, providerL1?: ethers.providers.Provider);
    getNonce(blockTag?: BlockTag): Promise<number>;
    getMainContract(): Promise<ethers.Contract>;
    protected layer2TxDefaults(): Promise<{
        initiatorAddress: string;
        nonce: number;
        validFrom: number;
        validUntil: number;
        fee: any;
        signature: any;
    }>;
    private layer1TxDefaults;
    transfer(transaction: {
        to: Address;
        token: Address;
        amount: BigNumberish;
        feeToken?: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<import("./types").TransactionResponse>;
    withdraw(transaction: {
        token: Address;
        amount: BigNumberish;
        feeToken?: Address;
        to?: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<import("./types").TransactionResponse>;
    migrateToPorter(transaction: {
        feeToken: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<import("./types").TransactionResponse>;
    deployContract(transaction: {
        bytecode: Uint8Array;
        calldata?: Uint8Array;
        accountType: AccountType;
        feeToken: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<import("./types").TransactionResponse>;
    rawExecute(transaction: {
        contractAddress: Address;
        calldata: Uint8Array;
        feeToken: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }): Promise<import("./types").TransactionResponse>;
    setParams(params: ExecutionParams): void;
    clearParams(): void;
    signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string>;
    call(tx: ethers.providers.TransactionRequest): Promise<string>;
    ethWallet(): ethers.Wallet;
    connectToL1(provider: ethers.providers.Provider): Wallet;
    approveERC20(token: Address, amount: BigNumberish, overrides?: ethers.CallOverrides): Promise<ethers.providers.TransactionResponse>;
    deposit(transaction: {
        token: Address;
        amount: BigNumberish;
        to?: Address;
        queueType?: PriorityQueueType;
        opTree?: PriorityOpTree;
        operatorTip?: BigNumberish;
        approveERC20?: boolean;
        overrides?: ethers.CallOverrides;
    }): Promise<ethers.providers.TransactionResponse>;
    addToken(transaction: {
        token: Address;
        queueType?: PriorityQueueType;
        opTree?: PriorityOpTree;
        operatorTip?: BigNumberish;
        overrides?: ethers.CallOverrides;
    }): Promise<ethers.providers.TransactionResponse>;
    accountType(): Promise<AccountType>;
}
