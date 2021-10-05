import { Wallet } from './wallet';
import { Provider } from './provider';
import { ContractInterface, ethers, utils } from 'ethers';
import { Address, DeployContractRequest, DeployExecutionParams } from './types';
import { calldataBytes, parseCalldata } from './calldata';

// Returns the contract deploy execution params and
// removes them from the args
function extractPartialDeployExecutionParams(args: Array<any>): Partial<DeployExecutionParams> {
    if (args.length == 0 || typeof [args.length - 1] != 'object') {
        throw new Error('Execution params must be specified');
    }
    return args.pop();
}

function extractDeployExecutionParams(args: Array<any>): DeployExecutionParams {
    const params = extractPartialDeployExecutionParams(args);

    if (params.feeToken == null) {
        throw new Error('feeToken must be specified');
    }

    if (params.contractType == null) {
        throw new Error('contractType must be specified');
    }

    return params as DeployExecutionParams;
}

export class ContractFactory extends ethers.ContractFactory {
    override readonly signer: Wallet;

    constructor(abi: ContractInterface, bytecode: ethers.BytesLike, signer: Wallet) {
        super(abi, bytecode, signer);
    }

    override getDeployTransaction(...args: Array<any>): DeployContractRequest {
        const params = extractPartialDeployExecutionParams(args);

        if (params.contractType == null) {
            throw new Error('contractType must be specified');
        }

        const populated: DeployContractRequest = {
            ...super.getDeployTransaction(...args),
            bytecode: this.bytecode.toString(), // We do copy in case bytecode is array.
            accountType: params.contractType!,
            data: this.getDeployCallData(...args)
        };

        return populated;
    }

    override async deploy(...args: Array<any>): Promise<Contract> {
        const params = extractDeployExecutionParams(args);

        const tx = await this.signer.deployContract({
            bytecode: utils.arrayify(this.bytecode),
            calldata: this.getDeployCallData(...args),
            accountType: params.contractType,
            feeToken: params.feeToken,
            ...params
        });
        const receipt = await tx.wait();
        const address = receipt.contractAddress;
        return new Contract(address, this.interface, this.signer);
    }

    // TODO: replace this function with something similar to populateTransaction
    getDeployCallData(...args: Array<any>): Uint8Array {
        const calldata = ethers.utils.concat([
            new Uint8Array([0, 0, 0, 0]), // constructor call has zero hash
            this.interface.encodeDeploy(args)
        ]);

        return calldataBytes(parseCalldata(calldata, { constructorCall: true }));
    }
}

export class Contract extends ethers.Contract {
    override readonly signer: Wallet;
    override readonly provider: Provider;

    constructor(address: Address, abi: ContractInterface, signerOrProvider?: Wallet | Provider) {
        super(address, abi, signerOrProvider);

        // This line took an unreasonably long time to figure out.
        // Why is it needed? Because we are trying to override fields that represent functions
        // in the contract (since we have to pass custom properties into the signer, see below).
        // These fields are defined as non-writable and non-configurable by the parent class.
        // But we still *really* have to redefine them and we can't get rid of those restrictions by not
        // calling the parent constructor because it is required by the language that `super` is called here.
        // Disabling strict mode also won't help because it is declared outside of our module.
        // What I'm doing here is making a shallow copy of the initial this-object using the `...` spread
        // operator and adding all the methods that it had using `Object.setPrototypeOf`.
        // `functions` and other fields are declared separately since the spread operator only makes a shallow copy
        // so otherwise these properties would be non-writable still.
        // There is still no standard way to make a deep copy of an object in JS, oh well.
        // prettier-ignore
        const newThis: Contract = Object.setPrototypeOf({
            ...this,
            functions: {},
            callStatic: {},
            estimateGas: {},
            populateTransaction: {}
        }, this);

        const uniqueNames: { [name: string]: boolean } = {};

        Object.keys(newThis.interface.functions).forEach((signature) => {
            const fragment = newThis.interface.functions[signature];
            const name = fragment.name;
            if (uniqueNames[name]) {
                throw new Error(`Duplicate ABI entry for ${name}`);
            }
            uniqueNames[name] = true;

            // Since zkSync has a different calldata format, we have to override this function
            const oldEstimate: ethers.ContractFunction<ethers.PopulatedTransaction> =
                this.populateTransaction[signature].bind(newThis);
            newThis.populateTransaction[name] = newThis.populateTransaction[signature] = async (
                ...args: Array<any>
            ) => {
                const populated = await oldEstimate(...args);
                const outputSize = fragment.outputs.length;
                populated.data = utils.hexlify(calldataBytes(parseCalldata(populated.data, { outputSize })));
                return populated;
            };

            const wrapFunction = (oldFunction: ethers.ContractFunction<any>) => {
                return async (...args: Array<any>) => {
                    // To execute a zkSync contract we have to specify some additional options
                    // that are not present in EVM-specific code (feeToken, validFrom etc).
                    // ethers.js has a notion of overrides, which is an object passed as (n+1)-st argument
                    // to a contract call and may contain stuff like gasLimit, nonce etc.
                    // We can use this object to also pass our options.
                    // But since ethers.js does not permit such custom properties, we have to sneak them
                    // into the signer first, and remove them from overrides before calling the parent function.
                    // This may seem kludgy but unfortunately, given the way ethers.js is built, this is so far
                    // the most "elegant" way, even suggested (kinda) by @ricmoo - ethers.js maintainer.
                    if (args.length == fragment.inputs.length + 1 && typeof args[args.length - 1] === 'object') {
                        const { validFrom, validUntil, fee, feeToken, ...overrides } = args.pop();
                        overrides.gasLimit = 1;
                        args.push(overrides);
                        newThis.signer.setParams({ validFrom, validUntil, fee, feeToken });
                    } else {
                        newThis.signer.clearParams();
                    }

                    const { data } = await newThis.populateTransaction[signature](...args);
                    newThis.signer.setParams({ data });
                    return oldFunction(...args);
                };
            };

            // FIXME: fallback function will not work with this setup
            // @ts-ignore
            // The diffrence between contract.method and contract.functions.method is subtle:
            // in case the return data of the call is an array of a signle value, the former one collapses into that value
            newThis[name] = newThis[signature] = wrapFunction(this[signature].bind(newThis));
            newThis.functions[name] = newThis.functions[signature] = wrapFunction(
                this.functions[signature].bind(newThis)
            );
            // FIXME: this won't work if the contract is only bound to the provider and not signer
            newThis.callStatic[name] = newThis.callStatic[signature] = wrapFunction(
                this.callStatic[signature].bind(newThis)
            );
            // We don't have gas in zkSync, so this feels like a safe stub.
            newThis.estimateGas[name] = newThis.estimateGas[signature] = async () => ethers.BigNumber.from(1);
        });

        return newThis;
    }

    override connect(signerOrProvider: Wallet | Provider): Contract {
        // this is ok because super.connect uses this.constructor
        return super.connect(signerOrProvider) as Contract;
    }

    override attach(address: Address): Contract {
        // this is ok because super.connect uses this.constructor
        return super.attach(address) as Contract;
    }
}
