import { ethers, BigNumberish } from 'ethers';
import { Address, Signature, AccountType } from './types';
import { TypedDataSigner } from '@ethersproject/abstract-signer';
export declare class EIP712Signer {
    private ethSigner;
    private eip712Domain;
    constructor(ethSigner: ethers.Signer & TypedDataSigner, chainId: number | Promise<number>);
    signTransfer(transfer: {
        to: Address;
        token: Address;
        amount: BigNumberish;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature>;
    signMigrateToPorter(migrateToPorter: {
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature>;
    signWithdraw(withdraw: {
        to: Address;
        token: Address;
        amount: BigNumberish;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature>;
    signDeployContract(deployContract: {
        accountType: AccountType;
        bytecode: Uint8Array;
        calldata: Uint8Array;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature>;
    signExecuteContract(executeContract: {
        contractAddress: Address;
        calldata: Uint8Array;
        feeToken: Address;
        fee: BigNumberish;
        nonce: number;
        validFrom: number;
        validUntil: number;
    }): Promise<Signature>;
}
