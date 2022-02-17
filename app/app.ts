import express from 'express';
import bodyParser from 'body-parser';
import * as zksync from 'zksync-web3';
import { backOff } from 'exponential-backoff';
import cors from 'cors';
import { sleep } from 'zksync-web3/build/utils';
import tokens from '../tokens-config';

const port = 2880;

const app: express.Application = express();
app.use(bodyParser.json());

const corsOptions = {
    origin: '*',
    credentials: true,            //access-control-allow-credentials:true
    optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

const SECRET_KEYS = process.env.SECRET_KEYS!.split(',');
const QUEUES_NUMBER = SECRET_KEYS.length;
const sendMoneyQueue: [string, any, any][][] = Array.from(Array(QUEUES_NUMBER), () => []);
const network = process.env.NETWORK || 'goerli';

let current_queue_number = 0;

app.post('/ask_money', async (req, res) => {
    try {
        const receiverAddress = req.body['receiverAddress']?.trim()?.toLowerCase();

        if (receiverAddress == undefined) {
            return res.send('Error: missing receiver address');
        }

        if (! /^0x([0-9a-fA-F]){40}$/.test(receiverAddress)) {
            return res.send('Error: invalid receiver address');
        }

        const queue_num = current_queue_number % QUEUES_NUMBER;
        
        current_queue_number += 1;

        try {
            await new Promise((resolve, reject) => {
                sendMoneyQueue[queue_num].push([receiverAddress, resolve, reject])
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

async function startSendingMoneyFragile(queueNumber: number): Promise<void> {
    const provider = new zksync.Provider(process.env.ZKS_PROVIDER_URL || "https://stage2-api.zksync.dev/web3");
    const wallet = new zksync.Wallet(SECRET_KEYS[queueNumber], provider);

    while (true) {
        if (sendMoneyQueue[queueNumber].length === 0) {
            await sleep(100);
            continue;
        }

        const [receiverAddress, resolve, reject] = sendMoneyQueue[queueNumber][0];

        try {
            const hashes = [];
            let nonce = await wallet.getTransactionCount();
            for (const { address, amount } of tokens[network]) {
                const transfer = await wallet.transfer({
                    to: receiverAddress,
                    token: address,
                    amount: amount,
                    feeToken: address,
                    nonce
                });
                hashes.push(transfer.hash);
                nonce += 1;
            }

            for (const txHash of hashes) {
                const receiptPromise = () => provider.perform('getTransactionReceipt', { transactionHash: txHash }).then((receipt) => {
                    if (receipt === null || receipt.status === null) {
                        console.debug('Retrying for hash', txHash)
                        throw new Error();
                    }
                    return receipt;
                });
                const receipt = await backOff(receiptPromise);
                if (parseInt(receipt.status) != 1) {
                    throw new Error(`Problems with address ${wallet.address}`);
                }
            }

            console.log(`Transferred funds to ${receiverAddress}`);
            resolve();
        } catch(err) {
            console.log(`Error in startSendingMoneyFragile ${err}`);
            reject();
        }

        sendMoneyQueue[queueNumber].shift();
    }
}

async function startSendingMoney(queueNumber: number) {
    let delay = 1000;
    let startTime;
    while (true) {
        try {
            startTime = Date.now();
            await startSendingMoneyFragile(queueNumber);
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

for (let i=0;i<QUEUES_NUMBER;i++) {
    startSendingMoney(i);
}

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
