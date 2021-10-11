import express from 'express';
import bodyParser from 'body-parser';
import * as zksync from 'zksync-web3';
import { BigNumber } from 'ethers';
import { backOff } from 'exponential-backoff';
import cors from 'cors';
import { sleep } from 'zksync-web3/build/utils';

const port = 2880;

const app: express.Application = express();
app.use(bodyParser.json());

const corsOptions = {
    origin: '*',
    credentials: true,            //access-control-allow-credentials:true
    optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

const sendMoneyQueue: [string, any, any][] = [];

const TOKENS =
[
    {
        address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee", // ETH
        amount: BigNumber.from(10).pow(15), // 0.001
    },
    {
        address: "0x7457fc3f89ac99837d44f60b7860691fb2f09bf5", // wBTC
        amount: BigNumber.from(10).pow(6), // 0.01
    },
    {
        address: "0x4da8d0795830f75be471f072a034d42c369b5d0a", // LINK
        amount: BigNumber.from(10).pow(18).mul(100), // 100
    },
    {
        address: "0xeb8f08a975ab53e34d8a0330e0d34de942c95926", // USDC
        amount: BigNumber.from(10).pow(6).mul(300), // 300
    },
    {
        address: "0x70a4fcf3e4c8591b5b4318cec5facbb96a604198", // DAI
        amount: BigNumber.from(10).pow(18).mul(300), // 300
    },
];


app.post('/ask_money', async (req, res) => {
    try {
        const receiverAddress = req.body['receiverAddress']?.trim()?.toLowerCase();

        if (receiverAddress == undefined) {
            return res.send('Error: missing receiver address');
        }

        if (! /^0x([0-9a-fA-F]){40}$/.test(receiverAddress)) {
            return res.send('Error: invalid receiver address');
        }

        try {
            await new Promise((resolve, reject) => {
                sendMoneyQueue.push([receiverAddress, resolve, reject])
            });
            res.send("success");
        } catch (err) {
            res.status(500).send("error");
        }
    } catch (e) {
        console.error("Error in ask_money:", e);
        res.status(500).send("error");
    }
});

async function startSendingMoneyFragile(): Promise<void> {
    const provider = new zksync.Provider(process.env.ZKS_PROVIDER_URL || "https://stage2-api.zksync.dev/web3");
    const wallet = new zksync.Wallet(process.env.SECRET_KEY, provider);

    while (true) {
        if (sendMoneyQueue.length === 0) {
            await sleep(100);
            continue;
        }

        const [receiverAddress, resolve, reject] = sendMoneyQueue[0];

        try {
            for (const { address, amount } of TOKENS) {
                const transfer = await wallet.transfer({
                    to: receiverAddress,
                    token: address,
                    amount: amount,
                    feeToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                });
                const receiptPromise = () => provider.perform('getTransactionReceipt', { transactionHash: transfer.hash }).then((receipt) => {
                    if (receipt === null) {
                        console.debug('Retrying for hash', transfer.hash)
                        throw new Error();
                    }
                    return receipt;
                });
                const receipt = await backOff(receiptPromise);

                if (parseInt(receipt.status) != 1) {
                    throw new Error();
                }
            }

            console.log(`Transferred funds to ${receiverAddress}`);
            resolve();
        } catch {
            reject();
        }

        sendMoneyQueue.shift();
    }
}

async function startSendingMoney() {
    let delay = 1000;
    let startTime;
    while (true) {
        try {
            startTime = Date.now();
            await startSendingMoneyFragile();
        } catch (e) {
            const runningTime = Date.now() - startTime;

            if (runningTime < 60000) {
                delay = Math.min(delay * 2, 600000);
            } else {
                delay = 1000;
            }

            console.error(`Error in startSending money:`, e);

            await sleep(delay);
        }
    }
}

// Start API
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));

startSendingMoney();

process.stdin.resume(); // Program will not close instantly

function exitHandler(options, exitCode) {
    if (exitCode || exitCode === 0) process.exit(exitCode);
    if (options.exit) process.exit();
}

// do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
