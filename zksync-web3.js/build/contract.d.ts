import { Wallet } from './wallet';
import { Provider } from './provider';
import { ContractInterface, ethers } from 'ethers';
import { Address } from './types';
export declare class ContractFactory extends ethers.ContractFactory {
    readonly signer: Wallet;
    constructor(abi: ContractInterface, bytecode: ethers.BytesLike, signer: Wallet);
    deploy(...args: Array<any>): Promise<Contract>;
    getDeployCallData(...args: Array<any>): Uint8Array;
}
export declare class Contract extends ethers.Contract {
    readonly signer: Wallet;
    readonly provider: Provider;
    constructor(address: Address, abi: ContractInterface, signerOrProvider?: Wallet | Provider);
    connect(signerOrProvider: Wallet | Provider): Contract;
    attach(address: Address): Contract;
}
