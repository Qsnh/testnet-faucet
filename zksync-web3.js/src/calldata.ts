import { BigNumber, BigNumberish, ethers, utils } from 'ethers';

interface CallDataParams {
    outputSize?: number;
    constructorCall?: boolean;
}

interface CallData extends CallDataParams {
    hash: BigNumberish;
    input: BigNumberish[];
}

const ABI_OFFSET_CALL_RETURN_DATA = 8;
const ABI_OFFSET_CALLDATA_SIZE = 0;
const ABI_OFFSET_ENTRY_HASH = 7;
const FIELD_SIZE = 32;

function toLeBytes(x: BigNumberish): Uint8Array {
    const hexString = BigNumber.from(x).toHexString();
    return utils.arrayify(hexString).reverse();
}

// This function parses calldata generated for a solidity contract call.
// Format is described in details here: https://docs.soliditylang.org/en/latest/abi-spec.html
// This function might incorrectly handle complex types.
export function parseCalldata(calldata: ethers.BytesLike, params?: CallDataParams): CallData {
    const bytes = utils.arrayify(calldata);

    // The first four bytes of the call data for a function call specifies the function to be called.
    // It is the first four bytes of the Keccak-256 hash of the signature of the function.
    if (bytes.length < 4) {
        throw new Error('No function selector found');
    }

    const selector = utils.hexlify(bytes.slice(0, 4));

    // All the arguments follow the selector and are encoded as defined in the ABI spec.
    // Arguments are aligned to 32 bytes each.
    if (bytes.length % 32 !== 4) {
        throw new Error('Unsupported arguments alignment');
    }

    const input = [];

    for (let i = 4; i < bytes.length; i += 32) {
        input.push(utils.hexlify(bytes.slice(i, i + 32)));
    }

    return {
        hash: selector,
        input,
        ...params
    };
}

// Adapted from https://github.com/matter-labs/compiler-tester/blob/main/calldata_generator/src/calldata.rs
// Spec: https://www.notion.so/matterlabs/Contract-ABI-21cfe71b2e3346029f4b591ae33332b4
export function calldataBytes(calldata: CallData): Uint8Array {
    const calldataSize = calldata.input.length;
    const size = (ABI_OFFSET_CALL_RETURN_DATA + calldataSize) * FIELD_SIZE;
    const buffer = new Uint8Array(size);

    const calldataSizeOffset = ABI_OFFSET_CALLDATA_SIZE * FIELD_SIZE;
    toLeBytes(calldataSize).forEach((byte, index) => {
        buffer[index + calldataSizeOffset] = byte;
    });

    const constructorCalllOffset = ABI_OFFSET_ENTRY_HASH * FIELD_SIZE;
    const isConstructorCall = calldata.constructorCall ? 1 : 0;
    buffer[constructorCalllOffset] = toLeBytes(isConstructorCall)[0]; // isConstructorCall has only one byte

    const entryHashOffset = (ABI_OFFSET_ENTRY_HASH + 1) * FIELD_SIZE - 4;
    toLeBytes(calldata.hash).forEach((byte, index) => {
        buffer[index + entryHashOffset] = byte;
    });

    let calldataOffset = ABI_OFFSET_CALL_RETURN_DATA * FIELD_SIZE;
    calldata.input.forEach((value) => {
        toLeBytes(value).forEach((byte, index) => {
            buffer[index + calldataOffset] = byte;
        });
        calldataOffset += FIELD_SIZE;
    });

    return buffer;
}
