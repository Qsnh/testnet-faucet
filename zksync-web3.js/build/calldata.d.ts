import { BigNumberish, ethers } from 'ethers';
interface CallDataParams {
    outputSize?: number;
    constructorCall?: boolean;
}
interface CallData extends CallDataParams {
    hash: BigNumberish;
    input: BigNumberish[];
}
export declare function parseCalldata(calldata: ethers.BytesLike, params?: CallDataParams): CallData;
export declare function calldataBytes(calldata: CallData): Uint8Array;
export {};