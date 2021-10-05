import express from 'express';
import bodyParser from 'body-parser';
import * as zksync from 'zksync-web3';
import { BigNumber } from 'ethers';
import * as fs from 'fs';
import cors from 'cors';

const port = 2880;

const app: express.Application = express();
app.use(bodyParser.json());

const corsOptions = {
   origin:'*', 
   credentials:true,            //access-control-allow-credentials:true
   optionSuccessStatus:200,
};
app.use(cors(corsOptions));

// Load state from state.json
// store is a map from tickets to addresses
// queue is a queue of tickets
const { store, sendMoneyQueue, allowWithdrawalSet }: { 
    store: { [s: string]: { address?: string, name?: string, id_str?: string } },
    sendMoneyQueue: { receiverAddress?: string, tokenAddress?: string}[],
    allowWithdrawalSet: { [s: string]: true },
} = require('../state.json');

let nonce = undefined;

const PROVIDER = new zksync.Provider(process.env.ZKS_PROVIDER_URL || "https://stage2-api.zksync.dev/web3");
const WALLET = new zksync.Wallet(process.env.SECRET_KEY).connect(PROVIDER);

function getTokenAmount(tokenAddress: string) {
    if (tokenAddress.toLowerCase() == "0x7457fc3f89ac99837d44f60B7860691fb2f09Bf5") { // wBTC
        return BigNumber.from(10).pow(6); // 0.01
    } else if(tokenAddress.toLowerCase() == "0xd2084ea2ae4bbe1424e4fe3cde25b713632fb988") { // BAT
        return (BigNumber.from(10).pow(18)).mul(3000); // 3000
    } else if(tokenAddress.toLowerCase() == "0xeb8f08a975ab53e34d8a0330e0d34de942c95926") { // USDC
        return (BigNumber.from(10).pow(6)).mul(300); // 300
    } else { // DAI
        return (BigNumber.from(10).pow(18)).mul(300); // 300
    }
}

app.post('/ask_money', async (req, res) => {
    try {
        const receiverAddress = req.body['receiverAddress']?.trim()?.toLowerCase();
        const tokenAddress = req.body['tokenAddress']?.trim()?.toLowerCase();
    
        if (receiverAddress == undefined) {
            return res.send('Error: missing receiver address');
        }

        if (tokenAddress == undefined) {
            return res.send('Error: missing token address');
        }

        if (! /^0x([0-9a-fA-F]){40}$/.test(receiverAddress)) {
            return res.send('Error: invalid receiver address');
        }

        if (! /^0x([0-9a-fA-F]){40}$/.test(tokenAddress)) {
            return res.send('Error: invalid token address');
        }
        if (nonce == undefined) {
            nonce = await WALLET.getNonce();
        }
        
        const transfer = await WALLET.transfer({
            to: receiverAddress,
            token: tokenAddress,
            amount: getTokenAmount(tokenAddress),
            feeToken: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            nonce: nonce
        });
        
        nonce += 1;
        
        console.log(`Transferred funds to ${receiverAddress}`);

        return res.send(transfer.hash);
    } catch (e) {
        console.error("Error in ask_money:", e);
        return res.send("Error: internal error");
    }
});

// Start API
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));

process.stdin.resume(); // Program will not close instantly

function exitHandler(options, exitCode) {
    if (options.cleanup) {
        const state = {
            store,
            sendMoneyQueue,
            allowWithdrawalSet,
            // usedAddresses,
        };
        fs.writeFileSync("state.json", JSON.stringify(state, null, 2));
    }

    if (exitCode || exitCode === 0) process.exit(exitCode);
    if (options.exit) process.exit();
}

// do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

// catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

// catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
