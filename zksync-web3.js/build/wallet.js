"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = void 0;
const signer_1 = require("./signer");
const utils_1 = require("./utils");
const ethers_1 = require("ethers");
class Wallet extends ethers_1.ethers.Wallet {
    constructor(privateKey, providerL2, providerL1) {
        super(privateKey, providerL2);
        if (this.provider != null) {
            const chainId = this.getChainId();
            this.signer = new signer_1.EIP712Signer(this, chainId);
        }
        this.providerL1 = providerL1;
    }
    async getBalance(token, blockTag = 'committed') {
        return this.provider.getBalance(this.address, blockTag, token);
    }
    async getBalanceL1(token, blockTag) {
        if (this.providerL1 == null) {
            throw new Error('L1 provider missing: use `connectToL1` to specify');
        }
        if (utils_1.isETH(token)) {
            return this.providerL1.getBalance(this.address, blockTag);
        }
        else {
            const erc20contract = new ethers_1.ethers.Contract(token, utils_1.IERC20, this.providerL1);
            return erc20contract.balanceOf(this.address);
        }
    }
    connect(provider) {
        return new Wallet(this._signingKey(), provider, this.providerL1);
    }
    static fromMnemonic(mnemonic, path, wordlist) {
        const wallet = super.fromMnemonic(mnemonic, path, wordlist);
        return new Wallet(wallet._signingKey());
    }
    static async fromEncryptedJson(json, password, callback) {
        const wallet = await super.fromEncryptedJson(json, password, callback);
        return new Wallet(wallet._signingKey());
    }
    static fromEncryptedJsonSync(json, password) {
        const wallet = super.fromEncryptedJsonSync(json, password);
        return new Wallet(wallet._signingKey());
    }
    static createRandom(options) {
        const wallet = super.createRandom(options);
        return new Wallet(wallet._signingKey());
    }
    // an alias with a better name
    async getNonce(blockTag) {
        return this.getTransactionCount(blockTag);
    }
    async getMainContract() {
        const address = await this.provider.getMainContractAddress();
        return new ethers_1.ethers.Contract(address, utils_1.ZKSYNC_MAIN_ABI, this.ethWallet());
    }
    async _txDefaults() {
        return {
            initiatorAddress: this.address,
            nonce: await this.getNonce(),
            validFrom: utils_1.MIN_TIMESTAMP,
            validUntil: utils_1.MAX_TIMESTAMP,
            fee: null,
            signature: null
        };
    }
    async transfer(transaction) {
        var _a, _b;
        const tx = Object.assign(await this._txDefaults(), transaction);
        (_a = tx.feeToken) !== null && _a !== void 0 ? _a : (tx.feeToken = tx.token);
        (_b = tx.fee) !== null && _b !== void 0 ? _b : (tx.fee = await this.provider.estimateFee(utils_1.serialize.transfer(tx)));
        tx.signature = await this.signer.signTransfer(tx);
        const rawTx = await super.signTransaction({ data: utils_1.serialize.transfer(tx) });
        return this.provider.sendTransaction(rawTx);
    }
    async withdraw(transaction) {
        var _a, _b, _c;
        const tx = Object.assign(await this._txDefaults(), transaction);
        (_a = tx.to) !== null && _a !== void 0 ? _a : (tx.to = this.address);
        (_b = tx.feeToken) !== null && _b !== void 0 ? _b : (tx.feeToken = tx.token);
        (_c = tx.fee) !== null && _c !== void 0 ? _c : (tx.fee = await this.provider.estimateFee(utils_1.serialize.withdraw(tx)));
        tx.signature = await this.signer.signWithdraw(tx);
        const rawTx = await super.signTransaction({ data: utils_1.serialize.withdraw(tx) });
        return this.provider.sendTransaction(rawTx);
    }
    async migrateToPorter(transaction) {
        var _a;
        const tx = Object.assign(await this._txDefaults(), transaction);
        (_a = tx.fee) !== null && _a !== void 0 ? _a : (tx.fee = await this.provider.estimateFee(utils_1.serialize.migrateToPorter(tx)));
        tx.signature = await this.signer.signMigrateToPorter(tx);
        const rawTx = await super.signTransaction({ data: utils_1.serialize.migrateToPorter(tx) });
        return this.provider.sendTransaction(rawTx);
    }
    async deployContract(transaction) {
        var _a;
        const tx = Object.assign(await this._txDefaults(), { calldata: utils_1.defaultCalldata(), ...transaction });
        (_a = tx.fee) !== null && _a !== void 0 ? _a : (tx.fee = await this.provider.estimateFee(utils_1.serialize.deployContract(tx)));
        tx.signature = await this.signer.signDeployContract(tx);
        const rawTx = await super.signTransaction({ data: utils_1.serialize.deployContract(tx) });
        return this.provider.sendTransaction(rawTx);
    }
    // This is almost equivalent to Wallet.sendTransaction but more explicit
    async rawExecute(transaction) {
        var _a;
        const tx = Object.assign(await this._txDefaults(), transaction);
        (_a = tx.fee) !== null && _a !== void 0 ? _a : (tx.fee = await this.provider.estimateFee(utils_1.serialize.execute(tx)));
        tx.signature = await this.signer.signExecuteContract(tx);
        const rawTx = await super.signTransaction({ data: utils_1.serialize.execute(tx) });
        return this.provider.sendTransaction(rawTx);
    }
    setParams(params) {
        this.params = {
            ...this.params,
            ...params
        };
    }
    clearParams() {
        this.params = null;
    }
    async signTransaction(transaction) {
        var _a, _b, _c, _d;
        if (this.params == null) {
            throw new Error('Execution parameters are not set');
        }
        const tx = {
            contractAddress: transaction.to,
            calldata: ethers_1.utils.arrayify((_a = this.params.data) !== null && _a !== void 0 ? _a : transaction.data),
            initiatorAddress: transaction.from,
            nonce: ethers_1.BigNumber.from(transaction.nonce).toNumber(),
            validFrom: (_b = this.params.validFrom) !== null && _b !== void 0 ? _b : utils_1.MIN_TIMESTAMP,
            validUntil: (_c = this.params.validUntil) !== null && _c !== void 0 ? _c : utils_1.MAX_TIMESTAMP,
            feeToken: this.params.feeToken,
            fee: this.params.fee,
            signature: null
        };
        (_d = tx.fee) !== null && _d !== void 0 ? _d : (tx.fee = await this.provider.estimateFee(utils_1.serialize.execute(tx)));
        tx.signature = await this.signer.signExecuteContract(tx);
        const signedTransaction = super.signTransaction({ data: utils_1.serialize.execute(tx) });
        this.clearParams();
        return signedTransaction;
    }
    async call(tx) {
        var _a, _b, _c;
        (_a = tx.nonce) !== null && _a !== void 0 ? _a : (tx.nonce = await this.getTransactionCount());
        (_b = tx.from) !== null && _b !== void 0 ? _b : (tx.from = this.address);
        tx.data = (_c = this.params.data) !== null && _c !== void 0 ? _c : tx.data;
        if (tx.from.toLowerCase() != this.address.toLowerCase()) {
            throw new Error();
        }
        return this.provider.call(tx);
    }
    ethWallet() {
        if (this.providerL1 == null) {
            throw new Error('L1 provider missing: use `connectToL1` to specify');
        }
        return new ethers_1.ethers.Wallet(this._signingKey(), this.providerL1);
    }
    connectToL1(provider) {
        return new Wallet(this._signingKey(), this.provider, provider);
    }
    async approveERC20(token, amount, overrides) {
        const erc20contract = new ethers_1.ethers.Contract(token, utils_1.IERC20, this.ethWallet());
        const mainContract = await this.provider.getMainContractAddress();
        let gasLimit = undefined;
        if (overrides === null || overrides === void 0 ? void 0 : overrides.gasLimit) {
            gasLimit = overrides.gasLimit;
        }
        else {
            // For some reason, gas estimation for approves may be imprecise.
            // At least in the localhost scenario.
            gasLimit = await erc20contract.estimateGas.approve(mainContract, amount);
            gasLimit = gasLimit.mul(2);
        }
        return erc20contract.approve(mainContract, amount, { gasLimit, ...overrides });
    }
    async deposit(transaction) {
        var _a, _b;
        const zksyncContract = await this.getMainContract();
        const { token, amount } = transaction;
        const depositTo = (_a = transaction.to) !== null && _a !== void 0 ? _a : this.address;
        if (utils_1.isETH(token)) {
            return zksyncContract.depositETH(depositTo, {
                value: ethers_1.BigNumber.from(amount),
                gasLimit: ethers_1.BigNumber.from(utils_1.RECOMMENDED_GAS_LIMIT.ETH_DEPOSIT),
                ...transaction.overrides
            });
        }
        else {
            let nonce = undefined;
            if (transaction.approveERC20) {
                const approveTx = await this.approveERC20(token, amount);
                nonce = approveTx.nonce + 1;
            }
            const overrides = { nonce, ...transaction.overrides };
            const args = [token, amount, depositTo];
            if (overrides.gasLimit == null) {
                const gasEstimate = await zksyncContract.estimateGas
                    .depositERC20(...args, overrides)
                    .catch(() => ethers_1.BigNumber.from(0));
                const recommendedGasLimit = (_b = utils_1.RECOMMENDED_GAS_LIMIT.ERC20_DEPOSIT[token]) !== null && _b !== void 0 ? _b : utils_1.RECOMMENDED_GAS_LIMIT.ERC20_DEFAULT_DEPOSIT;
                overrides.gasLimit = gasEstimate.gte(recommendedGasLimit) ? gasEstimate : recommendedGasLimit;
            }
            return zksyncContract.depositERC20(...args, overrides);
        }
    }
    async addToken(token, overrides) {
        const zksyncContract = await this.getMainContract();
        return zksyncContract.addToken(token, {
            gasLimit: ethers_1.BigNumber.from(utils_1.RECOMMENDED_GAS_LIMIT.ADD_TOKEN),
            ...overrides
        });
    }
    async accountType() {
        return this.provider.getAccountType(this.address);
    }
}
exports.Wallet = Wallet;
