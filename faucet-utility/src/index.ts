import { Command } from 'commander';
import { ethers } from 'ethers';
import * as zksync from 'zksync-web3';
import {
    DEFAULT_ACCOUNTS,
    ALL_NETWORKS,
    isZkSyncNetwork,
    toEthNetwork,
    ERC20_INTERFACE,
    DEFAULT_DEPOSIT_AMOUNT,
    DEFAULT_MINT_AMOUNT
} from './utils';
import providerConfig from './provider-config';
import tokensConfig from '../../tokens-config';

async function mintTokensL1(wallet: zksync.Wallet, tokens: string[]) {
    console.info('Mint tokens on L1');

    const mainContract = await wallet.getMainContract();
    for (const token of tokens) {
        const erc20 = new ethers.Contract(token, ERC20_INTERFACE, wallet._signerL1());
        if (erc20.balanceOf(wallet.address) < DEFAULT_DEPOSIT_AMOUNT.mul(100)) {
            console.info(`\tMint ${token} token`);
            const mintTx = await erc20.mint(DEFAULT_MINT_AMOUNT);
            await mintTx.wait();
        }

        if ((await erc20.allowance(wallet.address, mainContract.address)) < ethers.constants.MaxUint256.div(2)) {
            console.info(`\tapprove for ${token} token`);
            const approveTx = await wallet.approveERC20(token, ethers.constants.MaxUint256);
            await approveTx.wait();
        }
    }
}

async function depositTokens(wallet: zksync.Wallet, tokens: string[], accounts: string[]) {
    console.info('Deposit tokens to faucet accounts');

    const promises = [];
    for (const token of tokens) {
        for (const to of accounts) {
            const balance = await wallet.provider.getBalance(to, undefined, token);
            if (balance.lt(DEFAULT_DEPOSIT_AMOUNT.div(1000))) {
                console.info(`\tdeposit ${token} token for ${to} account`);
                const tx = await wallet.deposit({ token, to, amount: DEFAULT_DEPOSIT_AMOUNT });
                promises.push(tx.wait());
            }
        }
    }

    await Promise.all(promises);
}

async function main() {
    const program = new Command('faucet-utility');

    program
        .command('fund')
        .requiredOption('--private-key <pk>')
        .requiredOption('--network <network>')
        .option('--accounts <addresses>')
        .option('--custom-tokens <tokens>')
        .option('--ethereum-node-url <url>')
        .action(async (cmd) => {
            const network = cmd.network;

            if (!network) {
                throw new Error('Network not provided');
            } else if (!isZkSyncNetwork(network)) {
                throw new Error(`Unsupported network. Look at the list of available networks: ${ALL_NETWORKS}`);
            }
            const defaultTokens = tokensConfig[toEthNetwork(network)].map((token: any) => token.address);
            const tokens = cmd.customTokens ? cmd.customTokens : defaultTokens;

            const privateKey = cmd.privateKey;
            const accounts = cmd.accounts ? cmd.accounts : DEFAULT_ACCOUNTS;

            if (!privateKey) {
                throw new Error('Private key not provided');
            } else if (!ethers.utils.isHexString(privateKey, 32)) {
                throw new Error('Private key must be a valid hexadecimal string of length 32');
            }

            const providerL1 = cmd.ethereumNodeUrl
                ? new ethers.providers.JsonRpcProvider(cmd.ethereumNodeUrl)
                : ethers.providers.getDefaultProvider(toEthNetwork(network));
            const providerL2 = new zksync.Provider(providerConfig[network]);
            const fundedWallet = new zksync.Wallet(privateKey, providerL2, providerL1);

            await mintTokensL1(fundedWallet, tokens);
            await depositTokens(fundedWallet, tokens, accounts);
        });

    await program.parseAsync(process.argv);
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Error:', err.message || err);
        process.exit(1);
    });
