import { ethers, BigNumberish, utils } from 'ethers';
import { Address, Signature, AccountType } from './types';
import { TypedDataDomain, TypedDataSigner } from '@ethersproject/abstract-signer';

export class EIP712Signer {
    private eip712Domain: Promise<TypedDataDomain>;
    constructor(private ethSigner: ethers.Signer & TypedDataSigner, chainId: number | Promise<number>) {
        // zkSync contract doesn't verify EIP712 signatures.
        const verifyingContract = '0x0000000000000000000000000000000000000000';

        this.eip712Domain = Promise.resolve(chainId).then((chainId) => ({
            name: 'zkSync',
            version: '2',
            chainId,
            verifyingContract
        }));
    }

    async signTransfer(transfer: {
        to: Address;
        token: Address;
        amount: BigNumberish;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature> {
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

        return (this.ethSigner as ethers.Signer & TypedDataSigner)._signTypedData(await this.eip712Domain, types, signInput);
    }

    async signMigrateToPorter(migrateToPorter: {
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature> {
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

    async signWithdraw(withdraw: {
        to: Address;
        token: Address;
        amount: BigNumberish;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature> {
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

    async signDeployContract(deployContract: {
        accountType: AccountType;
        bytecode: Uint8Array;
        calldata: Uint8Array;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature> {
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
            bytecodeHash: utils.keccak256(deployContract.bytecode),
            calldataHash: utils.keccak256(deployContract.calldata),
            // Circuit supports only constant-length signatures, so this field is needed to complete the signature length.
            padding: 0
        };

        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }

    async signExecuteContract(executeContract: {
        contractAddress: Address;
        calldata: Uint8Array;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature> {
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
            calldataHash: utils.keccak256(executeContract.calldata),
            // Circuit supports only constant-length signatures, so this field is needed to complete the signature length.
            padding: 0
        };

        return this.ethSigner._signTypedData(await this.eip712Domain, types, signInput);
    }
}
