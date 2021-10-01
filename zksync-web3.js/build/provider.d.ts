import { ethers, BigNumber } from 'ethers';
import { Log } from '@ethersproject/abstract-provider';
import { ConnectionInfo } from '@ethersproject/web';
import { Address, EventFilter, BlockTag, TransactionResponse, TransactionStatus, AccountType, Token } from './types';
export declare class Provider extends ethers.providers.JsonRpcProvider {
    protected contractAddress: Address;
    getBalance(address: Address, blockTag?: BlockTag, tokenAddress?: Address): Promise<ethers.BigNumber>;
    constructor(url?: ConnectionInfo | string, network?: ethers.providers.Networkish);
    estimateFee(serializedTx: string): Promise<BigNumber>;
    getMainContractAddress(): Promise<Address>;
    getAccountType(address: Address): Promise<AccountType>;
    getAccountTransactions(address: Address, before?: number, limit?: number): Promise<TransactionResponse[]>;
    getConfirmedTokens(start?: number, limit?: number): Promise<Token[]>;
    isTokenLiquid(token: Address): Promise<boolean>;
    getTokenPrice(token: Address): Promise<string>;
    static getDefaultProvider(): Promise<Provider>;
    newFilter(filter: EventFilter | Promise<EventFilter>): Promise<BigNumber>;
    newBlockFilter(): Promise<BigNumber>;
    newPendingTransactionsFilter(): Promise<BigNumber>;
    getFilterChanges(idx: BigNumber): Promise<Array<Log | string>>;
    getLogs(filter?: EventFilter | Promise<EventFilter>): Promise<Array<Log>>;
    protected _parseLogs(logs: any[]): Array<Log>;
    protected _prepareFilter(filter: EventFilter): {
        fromBlock: string;
        toBlock: string;
        topics?: (string | string[])[];
        address?: string | string[];
        limit?: number;
        blockHash?: string;
    };
    call(tx: ethers.providers.TransactionRequest): Promise<string>;
    _wrapTransaction(tx: ethers.Transaction, hash?: string): TransactionResponse;
    getTransactionStatus(txHash: string): Promise<TransactionStatus>;
    getL1Withdrawal(withdrawalHash: string): Promise<string>;
    sendTransaction(transaction: string | Promise<string>): Promise<TransactionResponse>;
}
