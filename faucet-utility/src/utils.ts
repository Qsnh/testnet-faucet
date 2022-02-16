import { BigNumber, ethers } from 'ethers';

export const ERC20_INTERFACE = new ethers.utils.Interface(require('../abi/IERC20.json'));

export const DEFAULT_MINT_AMOUNT = BigNumber.from(2).pow(160);

export const DEFAULT_DEPOSIT_AMOUNT = BigNumber.from(2).pow(160);

export const DEFAULT_ACCOUNTS = [
    '0x6c10d9c1744f149d4b17660e14faa247964749c7',
    '0xc6464bf44801f25d68f43e3d4a44ba9cd6259147',
    '0x5b5cc471aca3ab1b92e1eb50978f1662497c07d8',
    '0xb5e8b003badbaf5f85b0a4d56d8a9983b48cae99',
    '0xa430054e261d3f5b3415aab80dd91bf9867173a4',
    '0xe6e7b7616953b638d568dfc2fa90ce75978c9922',
    '0x0a7274519c86514f1f1bc5040d2bd6156c5c7404',
    '0x2b595cd75093440be9451bc363e5998b10481e42',
    '0x087a790f6cd2becbaea6caed035be35b3dcb4d92',
    '0x96d791a6b1a1045f83b7f238dcab7e49e6269ca0'
];

export type ZkSyncNetwork = 'rinkeby2' | 'stage2' | 'testnet2';

export const ALL_NETWORKS: ZkSyncNetwork[] = ['rinkeby2', 'stage2', 'testnet2'];

export function isZkSyncNetwork(network: ZkSyncNetwork) {
    return ALL_NETWORKS.includes(network);
}

export function toEthNetwork(network: ZkSyncNetwork) {
    if (network == 'rinkeby2') {
        return 'rinkeby';
    } else if (network == 'stage2') {
        return 'rinkeby';
    } else if (network == 'testnet2') {
        return 'goerli';
    } else {
        throw new Error(`Unexpected zkSync network: ${network}`);
    }
}
