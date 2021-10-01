"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EIP712Signer = void 0;
const ethers_1 = require("ethers");
class EIP712Signer {
    constructor(ethSigner, chainId) {
        this.ethSigner = ethSigner;
        // zkSync contract doesn't verify EIP712 signatures.
        const verifyingContract = '0x0000000000000000000000000000000000000000';
        this.eip712Domain = Promise.resolve(chainId).then((chainId) => ({
            name: 'zkSync',
            version: '2',
            chainId,
            verifyingContract
        }));
    }
    async signTransfer(transfer) {
        const types = {
            Transfer: [
                { name: 'to', type: 'address' },
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'initiatorAddress', type: 'address' },
                { name: 'feeToken', type: 'address' },
                { name: 'fee', type: 'uint256' },
                { name: 'nonce', type: 'uint32' },
                { name: 'validFrom', type: 'uint64' },
                { name: 'validUntil', type: 'uint64' }
            ]
        };
        const signInput = { ...transfer, initiatorAddress: await this.ethSigner.getAddress() };
        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }
    async signMigrateToPorter(migrateToPorter) {
        const types = {
            MigrateToPorter: [
                { name: 'initiatorAddress', type: 'address' },
                { name: 'feeToken', type: 'address' },
                { name: 'fee', type: 'uint256' },
                { name: 'nonce', type: 'uint32' },
                { name: 'validFrom', type: 'uint64' },
                { name: 'validUntil', type: 'uint64' }
            ]
        };
        const signInput = { ...migrateToPorter, initiatorAddress: await this.ethSigner.getAddress() };
        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }
    async signWithdraw(withdraw) {
        const types = {
            Withdraw: [
                { name: 'to', type: 'address' },
                { name: 'token', type: 'address' },
                { name: 'amount', type: 'uint256' },
                { name: 'initiatorAddress', type: 'address' },
                { name: 'feeToken', type: 'address' },
                { name: 'fee', type: 'uint256' },
                { name: 'nonce', type: 'uint32' },
                { name: 'validFrom', type: 'uint64' },
                { name: 'validUntil', type: 'uint64' }
            ]
        };
        const signInput = { ...withdraw, initiatorAddress: await this.ethSigner.getAddress() };
        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }
    async signDeployContract(deployContract) {
        const types = {
            DeployContract: [
                { name: 'accountType', type: 'uint8' },
                { name: 'bytecodeHash', type: 'uint256' },
                { name: 'calldataHash', type: 'uint256' },
                { name: 'initiatorAddress', type: 'address' },
                { name: 'feeToken', type: 'address' },
                { name: 'fee', type: 'uint256' },
                { name: 'nonce', type: 'uint32' },
                { name: 'validFrom', type: 'uint64' },
                { name: 'validUntil', type: 'uint64' },
                { name: 'padding', type: 'uint256' }
            ]
        };
        const signInput = {
            ...deployContract,
            initiatorAddress: await this.ethSigner.getAddress(),
            accountType: deployContract.accountType,
            bytecodeHash: ethers_1.utils.keccak256(deployContract.bytecode),
            calldataHash: ethers_1.utils.keccak256(deployContract.calldata),
            // Circuit supports only constant-length signatures, so this field is needed to complete the signature length.
            padding: 0
        };
        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }
    async signExecuteContract(executeContract) {
        const types = {
            Execute: [
                { name: 'contractAddress', type: 'address' },
                { name: 'calldataHash', type: 'uint256' },
                { name: 'initiatorAddress', type: 'address' },
                { name: 'feeToken', type: 'address' },
                { name: 'fee', type: 'uint256' },
                { name: 'nonce', type: 'uint32' },
                { name: 'validFrom', type: 'uint64' },
                { name: 'validUntil', type: 'uint64' },
                { name: 'padding', type: 'uint256' }
            ]
        };
        const signInput = {
            ...executeContract,
            initiatorAddress: await this.ethSigner.getAddress(),
            calldataHash: ethers_1.utils.keccak256(executeContract.calldata),
            // Circuit supports only constant-length signatures, so this field is needed to complete the signature length.
            padding: 0
        };
        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }
}
exports.EIP712Signer = EIP712Signer;
