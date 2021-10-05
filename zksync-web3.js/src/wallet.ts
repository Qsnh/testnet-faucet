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
    defaultCalldata,
    isDeployContractRequest
} from './utils';
import { ethers, utils, BigNumberish, BigNumber } from 'ethers';
import {
    Address,
    AccountType,
    PriorityQueueType,
    PriorityOpTree,
    ExecutionParams,
    BlockTag,
    Withdraw,
    Transfer
} from './types';
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

    protected async layer2TxDefaults() {
        return {
            initiatorAddress: this.address,
            nonce: await this.getNonce(),
            validFrom: MIN_TIMESTAMP,
            validUntil: MAX_TIMESTAMP,
            fee: null,
            signature: null
        };
    }

    private layer1TxDefaults() {
        return {
            queueType: PriorityQueueType.Deque,
            opTree: PriorityOpTree.Full
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
        const tx = Object.assign(await this.layer2TxDefaults(), transaction) as Required<Transfer>;

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
        const tx = Object.assign(await this.layer2TxDefaults(), transaction) as Required<Withdraw>;

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
        const tx = Object.assign(await this.layer2TxDefaults(), transaction);

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
        const tx = Object.assign(await this.layer2TxDefaults(), { calldata: defaultCalldata(), ...transaction });

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
        const tx = Object.assign(await this.layer2TxDefaults(), transaction);

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
            calldata: this.params.data ? utils.arrayify(this.params.data) : null,
            initiatorAddress: transaction.from || this.address,
            nonce: transaction.nonce ? BigNumber.from(transaction.nonce).toNumber() : await this.getNonce(),
            validFrom: this.params.validFrom ?? MIN_TIMESTAMP,
            validUntil: this.params.validUntil ?? MAX_TIMESTAMP,
            feeToken: this.params.feeToken,
            fee: this.params.fee,
            signature: null
        };

        let signedTransaction: string = null;
        if (isDeployContractRequest(transaction)) {
            const deployTx = {
                ...tx,
                bytecode: utils.arrayify(transaction.bytecode),
                accountType: transaction.accountType,
                calldata: utils.arrayify(transaction.data)
            };

            deployTx.fee ??= await this.provider.estimateFee(serialize.deployContract(deployTx));
            deployTx.signature = await this.signer.signDeployContract(deployTx);

            signedTransaction = await super.signTransaction({ data: serialize.deployContract(deployTx) });
        } else {
            tx.fee ??= await this.provider.estimateFee(serialize.execute(tx));
            tx.signature = await this.signer.signExecuteContract(tx);

            signedTransaction = await super.signTransaction({ data: serialize.execute(tx) });
        }

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
        queueType?: PriorityQueueType;
        opTree?: PriorityOpTree;
        operatorTip?: BigNumberish;
        approveERC20?: boolean;
        overrides?: ethers.CallOverrides;
    }): Promise<ethers.providers.TransactionResponse> {
        const zksyncContract = await this.getMainContract();

        const tx = Object.assign(this.layer1TxDefaults(), transaction);

        tx.to ??= this.address;
        tx.operatorTip ??= BigNumber.from(0);
        tx.overrides ??= {};

        const { to, token, amount, queueType, opTree, operatorTip, overrides } = tx;
        overrides.gasPrice ??= await this.provider.getGasPrice();

        const baseCost = BigNumber.from(await zksyncContract.depositBaseCost(overrides.gasPrice, queueType, opTree));

        if (isETH(token)) {
            overrides.value ??= baseCost.add(operatorTip).add(amount);

            return zksyncContract.depositETH(amount, to, queueType, opTree, {
                gasLimit: BigNumber.from(RECOMMENDED_GAS_LIMIT.ETH_DEPOSIT),
                ...overrides
            });
        } else {
            overrides.value ??= baseCost.add(operatorTip);

            let nonce: number = undefined;
            if (transaction.approveERC20) {
                const approveTx = await this.approveERC20(token, amount);
                nonce = approveTx.nonce + 1;
            }

            overrides.nonce ??= nonce;
            const args = [token, amount, to, queueType, opTree];

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

    async addToken(transaction: {
        token: Address;
        queueType?: PriorityQueueType;
        opTree?: PriorityOpTree;
        operatorTip?: BigNumberish;
        overrides?: ethers.CallOverrides;
    }): Promise<ethers.providers.TransactionResponse> {
        const zksyncContract = await this.getMainContract();

        const tx = Object.assign(this.layer1TxDefaults(), transaction);

        tx.operatorTip ??= BigNumber.from(0);
        tx.overrides ??= {};

        const { token, queueType, opTree, operatorTip, overrides } = tx;
        overrides.gasPrice ??= await this.provider.getGasPrice();

        const baseCost = BigNumber.from(await zksyncContract.addTokenBaseCost(overrides.gasPrice, queueType, opTree));

        overrides.value ??= baseCost.add(operatorTip);

        return zksyncContract.addToken(token, queueType, opTree, {
            gasLimit: BigNumber.from(RECOMMENDED_GAS_LIMIT.ADD_TOKEN),
            ...overrides
        });
    }

    async accountType(): Promise<AccountType> {
        return this.provider.getAccountType(this.address);
    }
}
