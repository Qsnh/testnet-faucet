import { EIP712Signer } from './signer';
import { Provider } from './provider';
import {
    MIN_TIMESTAMP,
    MAX_TIMESTAMP,
    ZKSYNC_MAIN_ABI,
    RECOMMENDED_GAS_LIMIT,
    IERC20,
    isETH,
    serialize,
    defaultCalldata
} from './utils';
import { ethers, utils, BigNumberish, BigNumber } from 'ethers';
import { Address, AccountType, ExecutionParams, BlockTag, Withdraw, Transfer } from './types';
import { ProgressCallback } from '@ethersproject/json-wallets';

export class Wallet extends ethers.Wallet {
    readonly signer: EIP712Signer;
    override readonly provider: Provider;
    protected params?: ExecutionParams;
    readonly providerL1?: ethers.providers.Provider;

    override async getBalance(token?: Address, blockTag: BlockTag = 'committed') {
        return this.provider.getBalance(this.address, blockTag, token);
    }

    async getBalanceL1(token?: Address, blockTag?: ethers.providers.BlockTag): Promise<BigNumber> {
        if (this.providerL1 == null) {
            throw new Error('L1 provider missing: use `connectToL1` to specify');
        }
        if (isETH(token)) {
            return this.providerL1.getBalance(this.address, blockTag);
        } else {
            const erc20contract = new ethers.Contract(token, IERC20, this.providerL1);
            return erc20contract.balanceOf(this.address);
        }
    }

    override connect(provider: Provider) {
        return new Wallet(this._signingKey(), provider, this.providerL1);
    }

    static override fromMnemonic(mnemonic: string, path?: string, wordlist?: ethers.Wordlist) {
        const wallet = super.fromMnemonic(mnemonic, path, wordlist);
        return new Wallet(wallet._signingKey());
    }

    static override async fromEncryptedJson(
        json: string,
        password?: string | ethers.Bytes,
        callback?: ProgressCallback
    ) {
        const wallet = await super.fromEncryptedJson(json, password, callback);
        return new Wallet(wallet._signingKey());
    }

    static override fromEncryptedJsonSync(json: string, password?: string | ethers.Bytes) {
        const wallet = super.fromEncryptedJsonSync(json, password);
        return new Wallet(wallet._signingKey());
    }

    static override createRandom(options?: any) {
        const wallet = super.createRandom(options);
        return new Wallet(wallet._signingKey());
    }

    constructor(
        privateKey: ethers.BytesLike | utils.SigningKey,
        providerL2?: Provider,
        providerL1?: ethers.providers.Provider
    ) {
        super(privateKey, providerL2);
        if (this.provider != null) {
            const chainId = this.getChainId();
            this.signer = new EIP712Signer(this, chainId);
        }
        this.providerL1 = providerL1;
    }

    // an alias with a better name
    async getNonce(blockTag?: BlockTag) {
        return this.getTransactionCount(blockTag);
    }

    async getMainContract() {
        const address = await this.provider.getMainContractAddress();
        return new ethers.Contract(address, ZKSYNC_MAIN_ABI, this.ethWallet());
    }

    protected async _txDefaults() {
        return {
            initiatorAddress: this.address,
            nonce: await this.getNonce(),
            validFrom: MIN_TIMESTAMP,
            validUntil: MAX_TIMESTAMP,
            fee: null,
            signature: null
        };
    }

    async transfer(transaction: {
        to: Address;
        token: Address;
        amount: BigNumberish;
        feeToken?: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }) {
        const tx = Object.assign(await this._txDefaults(), transaction) as Required<Transfer>;

        tx.feeToken ??= tx.token;
        tx.fee ??= await this.provider.estimateFee(serialize.transfer(tx));
        tx.signature = await this.signer.signTransfer(tx);

        const rawTx = await super.signTransaction({ data: serialize.transfer(tx) });
        return this.provider.sendTransaction(rawTx);
    }

    async withdraw(transaction: {
        token: Address;
        amount: BigNumberish;
        feeToken?: Address;
        to?: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }) {
        const tx = Object.assign(await this._txDefaults(), transaction) as Required<Withdraw>;

        tx.to ??= this.address;
        tx.feeToken ??= tx.token;
        tx.fee ??= await this.provider.estimateFee(serialize.withdraw(tx));
        tx.signature = await this.signer.signWithdraw(tx);

        const rawTx = await super.signTransaction({ data: serialize.withdraw(tx) });
        return this.provider.sendTransaction(rawTx);
    }

    async migrateToPorter(transaction: {
        feeToken: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }) {
        const tx = Object.assign(await this._txDefaults(), transaction);

        tx.fee ??= await this.provider.estimateFee(serialize.migrateToPorter(tx));
        tx.signature = await this.signer.signMigrateToPorter(tx);

        const rawTx = await super.signTransaction({ data: serialize.migrateToPorter(tx) });
        return this.provider.sendTransaction(rawTx);
    }

    async deployContract(transaction: {
        bytecode: Uint8Array;
        calldata?: Uint8Array;
        accountType: AccountType;
        feeToken: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }) {
        const tx = Object.assign(await this._txDefaults(), { calldata: defaultCalldata(), ...transaction });

        tx.fee ??= await this.provider.estimateFee(serialize.deployContract(tx));
        tx.signature = await this.signer.signDeployContract(tx);

        const rawTx = await super.signTransaction({ data: serialize.deployContract(tx) });
        return this.provider.sendTransaction(rawTx);
    }

    // This is almost equivalent to Wallet.sendTransaction but more explicit
    async rawExecute(transaction: {
        contractAddress: Address;
        calldata: Uint8Array;
        feeToken: Address;
        fee?: BigNumberish;
        nonce?: number;
        validFrom?: number;
        validUntil?: number;
    }) {
        const tx = Object.assign(await this._txDefaults(), transaction);

        tx.fee ??= await this.provider.estimateFee(serialize.execute(tx));
        tx.signature = await this.signer.signExecuteContract(tx);

        const rawTx = await super.signTransaction({ data: serialize.execute(tx) });
        return this.provider.sendTransaction(rawTx);
    }

    setParams(params: ExecutionParams) {
        this.params = {
            ...this.params,
            ...params
        };
    }

    clearParams() {
        this.params = null;
    }

    override async signTransaction(transaction: ethers.providers.TransactionRequest): Promise<string> {
        if (this.params == null) {
            throw new Error('Execution parameters are not set');
        }

        const tx = {
            contractAddress: transaction.to,
            calldata: utils.arrayify(this.params.data ?? transaction.data),
            initiatorAddress: transaction.from,
            nonce: BigNumber.from(transaction.nonce).toNumber(),
            validFrom: this.params.validFrom ?? MIN_TIMESTAMP,
            validUntil: this.params.validUntil ?? MAX_TIMESTAMP,
            feeToken: this.params.feeToken,
            fee: this.params.fee,
            signature: null
        };

        tx.fee ??= await this.provider.estimateFee(serialize.execute(tx));
        tx.signature = await this.signer.signExecuteContract(tx);

        const signedTransaction = super.signTransaction({ data: serialize.execute(tx) });
        this.clearParams();
        return signedTransaction;
    }

    override async call(tx: ethers.providers.TransactionRequest): Promise<string> {
        tx.nonce ??= await this.getTransactionCount();
        tx.from ??= this.address;
        tx.data = this.params.data ?? tx.data;

        if (tx.from.toLowerCase() != this.address.toLowerCase()) {
            throw new Error();
        }

        return this.provider.call(tx);
    }

    ethWallet() {
        if (this.providerL1 == null) {
            throw new Error('L1 provider missing: use `connectToL1` to specify');
        }
        return new ethers.Wallet(this._signingKey(), this.providerL1);
    }

    connectToL1(provider: ethers.providers.Provider) {
        return new Wallet(this._signingKey(), this.provider, provider);
    }

    async approveERC20(
        token: Address,
        amount: BigNumberish,
        overrides?: ethers.CallOverrides
    ): Promise<ethers.providers.TransactionResponse> {
        const erc20contract = new ethers.Contract(token, IERC20, this.ethWallet());
        const mainContract = await this.provider.getMainContractAddress();

        let gasLimit = undefined;
        if (overrides?.gasLimit) {
            gasLimit = overrides.gasLimit;
        } else {
            // For some reason, gas estimation for approves may be imprecise.
            // At least in the localhost scenario.
            gasLimit = await erc20contract.estimateGas.approve(mainContract, amount);
            gasLimit = gasLimit.mul(2);
        }

        return erc20contract.approve(mainContract, amount, { gasLimit, ...overrides });
    }

    async deposit(transaction: {
        token: Address;
        amount: BigNumberish;
        to?: Address;
        approveERC20?: boolean;
        overrides?: ethers.CallOverrides;
    }): Promise<ethers.providers.TransactionResponse> {
        const zksyncContract = await this.getMainContract();
        const { token, amount } = transaction;
        const depositTo = transaction.to ?? this.address;

        if (isETH(token)) {
            return zksyncContract.depositETH(depositTo, {
                value: BigNumber.from(amount),
                gasLimit: BigNumber.from(RECOMMENDED_GAS_LIMIT.ETH_DEPOSIT),
                ...transaction.overrides
            });
        } else {
            let nonce: number = undefined;
            if (transaction.approveERC20) {
                const approveTx = await this.approveERC20(token, amount);
                nonce = approveTx.nonce + 1;
            }

            const overrides = { nonce, ...transaction.overrides };
            const args = [token, amount, depositTo];

            if (overrides.gasLimit == null) {
                const gasEstimate = await zksyncContract.estimateGas
                    .depositERC20(...args, overrides)
                    .catch(() => BigNumber.from(0));
                const recommendedGasLimit =
                    RECOMMENDED_GAS_LIMIT.ERC20_DEPOSIT[token] ?? RECOMMENDED_GAS_LIMIT.ERC20_DEFAULT_DEPOSIT;
                overrides.gasLimit = gasEstimate.gte(recommendedGasLimit) ? gasEstimate : recommendedGasLimit;
            }

            return zksyncContract.depositERC20(...args, overrides);
        }
    }

    async addToken(token: Address, overrides?: ethers.CallOverrides): Promise<ethers.providers.TransactionResponse> {
        const zksyncContract = await this.getMainContract();
        return zksyncContract.addToken(token, {
            gasLimit: BigNumber.from(RECOMMENDED_GAS_LIMIT.ADD_TOKEN),
            ...overrides
        });
    }

    async accountType(): Promise<AccountType> {
        return this.provider.getAccountType(this.address);
    }
}
