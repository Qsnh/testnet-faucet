import express from 'express';
import bodyParser from 'body-parser';
import * as zksync from 'zksync-web3';
import { backOff } from 'exponential-backoff';
import cors from 'cors';
import { sleep } from 'zksync-web3/build/utils';
import tokens from '../tokens-config';

const port = process.env.PORT || 2880;
const pollingInterval = 60_000
const zkSyncId = "1191702416971968512"
const bearerToken = ''
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

const network = process.env.NETWORK || "goerli";
const sendMoneyQueue: [string, any, any][][] = Array.from(Array(QUEUES_NUMBER), () => []);

let currentQueueNumber = 0;
// We assume that queues are ok at the beginning.
let availableQueueNumbers = [...Array(QUEUES_NUMBER).keys()];
let sinceId  = "1508732465858461699";


const availableTokens: any[] = tokens[network].map((token: any) => {
  return {
    address: token.address,
    symbol: token.symbol
  };
});

app.get('/available_tokens', async (req, res) => {
  if (availableQueueNumbers.length > 0) {
    res.send(availableTokens);
  } else {
    res.send([]);
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

async function startUpdatingAvailableQueues() {
  let interval = 30000;
  while (true) {
    try {
      const provider = new zksync.Provider(process.env.ZKS_PROVIDER_URL || "https://stage2-api.zksync.dev/web3");
      let newAvailableQueues = [];
      for (let queueNumber = 0; queueNumber < QUEUES_NUMBER; ++queueNumber) {
        const walletAddress = (new zksync.Wallet(SECRET_KEYS[queueNumber], provider)).address;
        let promiseArray = [];
        for (const token of tokens[network]) {
          promiseArray.push(provider.getBalance(walletAddress, "latest", token.address));
        }
        const balances = await Promise.all(promiseArray);
        let isEnoughBalances = true;
        for (let i = 0; i < balances.length; ++i) {
          if (balances[i].lt(tokens[network][i].amount)) {
            isEnoughBalances = false;
            break;
          }
        }
        if (isEnoughBalances) {
          newAvailableQueues.push(queueNumber);
        }
      }
      availableQueueNumbers = newAvailableQueues;
    }
    catch(e) {
      console.error(`Error in startUpdatingAvailableQueues:`, e);
    }
    await sleep(interval);
  }
}

async function getTweets() {
  const url = `https://api.twitter.com/2/users/${zkSyncId}/mentions?since_id=${sinceId}`;
  const options = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${bearerToken}`
    }
  };
  const response = await fetch(url, options);
  const parsed  =  JSON.parse(await response.text())

  const meta = parsed['meta']
  if(meta['result_count'] !== 0){
    sinceId = meta['newest_id']
    const posts = parsed['data']
    for(let post of posts){
      const text = post['text']
      let kek = "I am claiming free tokens from @zksync's faucet! 🟣\nMy Address: 0x29b55175f116141e5574934d62b652f13aa721af  https://t.co/doeYbyditA"
      const isValid = await validateTweet(kek);
      console.log(isValid)
      if(isValid){
        console.log(text);
      }
    }
  }
  setTimeout(getTweets, pollingInterval);
}

async function validateTweet(content){
  const pattern =  new RegExp("I am claiming free tokens from @zksync's faucet! 🟣\nMy Address: 0x([0-9a-fA-F]){40}  https://t.co/doeYbyditA")
  console.log(pattern)
  if (!pattern.test(content)){
    return false;
  }
  return true;
}
// Start API
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));

for (let i=0;i<QUEUES_NUMBER;i++) {
  startSendingMoney(i);
}
startUpdatingAvailableQueues();

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
process.on("uncaughtException", exitHandler.bind(null, { exit: true }));
