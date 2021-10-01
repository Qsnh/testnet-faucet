import { ethers, BigNumber, utils } from 'ethers';
import Formatter = ethers.providers.Formatter;
import { Log } from '@ethersproject/abstract-provider';
import { ConnectionInfo } from '@ethersproject/web';
import {
    Address,
    Fee,
    EventFilter,
    BlockTag,
    TransactionResponse,
    TransactionStatus,
    AccountType,
    Token
} from './types';
import { sleep, serialize, ETH_ADDRESS } from './utils';

export class Provider extends ethers.providers.JsonRpcProvider {
    protected contractAddress: Address;

    override async getBalance(address: Address, blockTag: BlockTag = 'committed', tokenAddress?: Address) {
        const tag = this.formatter.blockTag(blockTag);
        return BigNumber.from(await this.send('eth_getBalance', [address, tag, tokenAddress]));
    }

    constructor(url?: ConnectionInfo | string, network?: ethers.providers.Networkish) {
        super(url, network);
        this.pollingInterval = 100;

        const blockTag = this.formatter.blockTag.bind(this.formatter);
        this.formatter.blockTag = (tag: any) => {
            if (tag == 'committed' || tag == 'finalized') {
                return tag;
            }
            return blockTag(tag);
        };
    }

    async estimateFee(serializedTx: string): Promise<BigNumber> {
        const fee: Fee = await this.send('zks_estimateFee', [{ data: serializedTx }]);
        return BigNumber.from(fee.totalFee);
    }

    async getMainContractAddress(): Promise<Address> {
        if (!this.contractAddress) {
            this.contractAddress = await this.send('zks_getMainContract', []);
        }
        return this.contractAddress;
    }

    async getAccountType(address: Address): Promise<AccountType> {
        const accountType: string = await this.send('zks_getAccountType', [address]);
        return AccountType[accountType];
    }

    async getAccountTransactions(
        address: Address,
        before: number = 0,
        limit: number = 255
    ): Promise<TransactionResponse[]> {
        const history: any[] = await this.send('zks_getAccountTransactions', [address, before, limit]);
        return Formatter.arrayOf(this.formatter.transactionResponse.bind(this.formatter))(history);
    }

    async getConfirmedTokens(start: number = 0, limit: number = 255): Promise<Token[]> {
        return this.send('zks_getConfirmedTokens', [start, limit]);
    }

    async isTokenLiquid(token: Address): Promise<boolean> {
        return this.send('zks_isTokenLiquid', [token]);
    }

    async getTokenPrice(token: Address): Promise<string> {
        return this.send('zks_getTokenPrice', [token]);
    }

    static async getDefaultProvider() {
        // TODO: different urls for different networks
        return new Provider(process.env.ZKSYNC_WEB3_API_URL || 'http://localhost:3050');
    }

    async newFilter(filter: EventFilter | Promise<EventFilter>): Promise<BigNumber> {
        filter = await filter;
        const id = await this.send('eth_newFilter', [this._prepareFilter(filter)]);
        return BigNumber.from(id);
    }

    async newBlockFilter(): Promise<BigNumber> {
        const id = await this.send('eth_newBlockFilter', []);
        return BigNumber.from(id);
    }

    async newPendingTransactionsFilter(): Promise<BigNumber> {
        const id = await this.send('eth_newPendingTransactionFilter', []);
        return BigNumber.from(id);
    }

    async getFilterChanges(idx: BigNumber): Promise<Array<Log | string>> {
        const logs = await this.send('eth_getFilterChanges', [idx.toHexString()]);
        return typeof logs[0] === 'string' ? logs : this._parseLogs(logs);
    }

    override async getLogs(filter: EventFilter | Promise<EventFilter> = {}): Promise<Array<Log>> {
        filter = await filter;
        const logs = await this.send('eth_getLogs', [this._prepareFilter(filter)]);
        return this._parseLogs(logs);
    }

    protected _parseLogs(logs: any[]): Array<Log> {
        return Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs);
    }

    protected _prepareFilter(filter: EventFilter) {
        return {
            ...filter,
            fromBlock: filter.fromBlock == null ? null : this.formatter.blockTag(filter.fromBlock),
            toBlock: filter.fromBlock == null ? null : this.formatter.blockTag(filter.toBlock)
        };
    }

    override async call(tx: ethers.providers.TransactionRequest): Promise<string> {
        if (tx.to == null) {
            throw new Error('no contract address specified');
        }

        const calldata = utils.arrayify(tx.data);

        return super.call({
            data: serialize.execute({
                contractAddress: tx.to,
                calldata,
                feeToken: ETH_ADDRESS,
                initiatorAddress: tx.from || ethers.constants.AddressZero,
                nonce: BigNumber.from(tx.nonce).toNumber() || 0
            })
        });
    }

    override _wrapTransaction(tx: ethers.Transaction, hash?: string): TransactionResponse {
        const response = super._wrapTransaction(tx, hash) as TransactionResponse;

        response.waitFinalize = async () => {
            const receipt = await response.wait();
            while (true) {
                const block = await this.getBlock('finalized');
                if (receipt.blockNumber <= block.number) {
                    return receipt;
                } else {
                    await sleep(this.pollingInterval);
                }
            }
        };

        return response;
    }

    // This is inefficient. Status should probably be indicated in the transaction receipt.
    async getTransactionStatus(txHash: string) {
        const tx = await this.getTransaction(txHash);
        if (tx == null) {
            return TransactionStatus.NotFound;
        }
        if (tx.blockNumber == null) {
            return TransactionStatus.Processing;
        }
        const verifiedBlock = await this.getBlock('finalized');
        if (tx.blockNumber <= verifiedBlock.number) {
            return TransactionStatus.Finalized;
        }
        return TransactionStatus.Committed;
    }

    async getL1Withdrawal(withdrawalHash: string): Promise<string> {
        return this.send('zks_getL1WithdrawalTx', [withdrawalHash]);
    }

    override async sendTransaction(transaction: string | Promise<string>): Promise<TransactionResponse> {
        return super.sendTransaction(transaction) as Promise<TransactionResponse>;
    }
}
