"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Provider = void 0;
const ethers_1 = require("ethers");
var Formatter = ethers_1.ethers.providers.Formatter;
const types_1 = require("./types");
const utils_1 = require("./utils");
class Provider extends ethers_1.ethers.providers.JsonRpcProvider {
    constructor(url, network) {
        super(url, network);
        this.pollingInterval = 100;
        const blockTag = this.formatter.blockTag.bind(this.formatter);
        this.formatter.blockTag = (tag) => {
            if (tag == 'committed' || tag == 'finalized') {
                return tag;
            }
            return blockTag(tag);
        };
    }
    async getBalance(address, blockTag = 'committed', tokenAddress) {
        const tag = this.formatter.blockTag(blockTag);
        return ethers_1.BigNumber.from(await this.send('eth_getBalance', [address, tag, tokenAddress]));
    }
    async estimateFee(serializedTx) {
        const fee = await this.send('zks_estimateFee', [{ data: serializedTx }]);
        return ethers_1.BigNumber.from(fee.totalFee);
    }
    async getMainContractAddress() {
        if (!this.contractAddress) {
            this.contractAddress = await this.send('zks_getMainContract', []);
        }
        return this.contractAddress;
    }
    async getAccountType(address) {
        const accountType = await this.send('zks_getAccountType', [address]);
        return types_1.AccountType[accountType];
    }
    async getAccountTransactions(address, before = 0, limit = 255) {
        const history = await this.send('zks_getAccountTransactions', [address, before, limit]);
        return Formatter.arrayOf(this.formatter.transactionResponse.bind(this.formatter))(history);
    }
    async getConfirmedTokens(start = 0, limit = 255) {
        return this.send('zks_getConfirmedTokens', [start, limit]);
    }
    async isTokenLiquid(token) {
        return this.send('zks_isTokenLiquid', [token]);
    }
    async getTokenPrice(token) {
        return this.send('zks_getTokenPrice', [token]);
    }
    static async getDefaultProvider() {
        // TODO: different urls for different networks
        return new Provider(process.env.ZKSYNC_WEB3_API_URL || 'http://localhost:3050');
    }
    async newFilter(filter) {
        filter = await filter;
        const id = await this.send('eth_newFilter', [this._prepareFilter(filter)]);
        return ethers_1.BigNumber.from(id);
    }
    async newBlockFilter() {
        const id = await this.send('eth_newBlockFilter', []);
        return ethers_1.BigNumber.from(id);
    }
    async newPendingTransactionsFilter() {
        const id = await this.send('eth_newPendingTransactionFilter', []);
        return ethers_1.BigNumber.from(id);
    }
    async getFilterChanges(idx) {
        const logs = await this.send('eth_getFilterChanges', [idx.toHexString()]);
        return typeof logs[0] === 'string' ? logs : this._parseLogs(logs);
    }
    async getLogs(filter = {}) {
        filter = await filter;
        const logs = await this.send('eth_getLogs', [this._prepareFilter(filter)]);
        return this._parseLogs(logs);
    }
    _parseLogs(logs) {
        return Formatter.arrayOf(this.formatter.filterLog.bind(this.formatter))(logs);
    }
    _prepareFilter(filter) {
        return {
            ...filter,
            fromBlock: filter.fromBlock == null ? null : this.formatter.blockTag(filter.fromBlock),
            toBlock: filter.fromBlock == null ? null : this.formatter.blockTag(filter.toBlock)
        };
    }
    async call(tx) {
        if (tx.to == null) {
            throw new Error('no contract address specified');
        }
        const calldata = ethers_1.utils.arrayify(tx.data);
        return super.call({
            data: utils_1.serialize.execute({
                contractAddress: tx.to,
                calldata,
                feeToken: utils_1.ETH_ADDRESS,
                initiatorAddress: tx.from || ethers_1.ethers.constants.AddressZero,
                nonce: ethers_1.BigNumber.from(tx.nonce).toNumber() || 0
            })
        });
    }
    _wrapTransaction(tx, hash) {
        const response = super._wrapTransaction(tx, hash);
        response.waitFinalize = async () => {
            const receipt = await response.wait();
            while (true) {
                const block = await this.getBlock('finalized');
                if (receipt.blockNumber <= block.number) {
                    return receipt;
                }
                else {
                    await utils_1.sleep(this.pollingInterval);
                }
            }
        };
        return response;
    }
    // This is inefficient. Status should probably be indicated in the transaction receipt.
    async getTransactionStatus(txHash) {
        const tx = await this.getTransaction(txHash);
        if (tx == null) {
            return types_1.TransactionStatus.NotFound;
        }
        if (tx.blockNumber == null) {
            return types_1.TransactionStatus.Processing;
        }
        const verifiedBlock = await this.getBlock('finalized');
        if (tx.blockNumber <= verifiedBlock.number) {
            return types_1.TransactionStatus.Finalized;
        }
        return types_1.TransactionStatus.Committed;
    }
    async getL1Withdrawal(withdrawalHash) {
        return this.send('zks_getL1WithdrawalTx', [withdrawalHash]);
    }
    async sendTransaction(transaction) {
        return super.sendTransaction(transaction);
    }
}
exports.Provider = Provider;
