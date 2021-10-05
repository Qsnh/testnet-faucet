"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionStatus = exports.PriorityOpTree = exports.PriorityQueueType = exports.AccountType = exports.Network = void 0;
// Ethereum network
var Network;
(function (Network) {
    Network[Network["Mainnet"] = 1] = "Mainnet";
    Network[Network["Ropsten"] = 3] = "Ropsten";
    Network[Network["Rinkeby"] = 4] = "Rinkeby";
    Network[Network["Localhost"] = 9] = "Localhost";
})(Network = exports.Network || (exports.Network = {}));
var AccountType;
(function (AccountType) {
    AccountType[AccountType["ZkRollup"] = 0] = "ZkRollup";
    AccountType[AccountType["ZkPorter"] = 1] = "ZkPorter";
})(AccountType = exports.AccountType || (exports.AccountType = {}));
var PriorityQueueType;
(function (PriorityQueueType) {
    PriorityQueueType[PriorityQueueType["Deque"] = 0] = "Deque";
    PriorityQueueType[PriorityQueueType["Heap"] = 1] = "Heap";
})(PriorityQueueType = exports.PriorityQueueType || (exports.PriorityQueueType = {}));
var PriorityOpTree;
(function (PriorityOpTree) {
    PriorityOpTree[PriorityOpTree["Full"] = 0] = "Full";
    PriorityOpTree[PriorityOpTree["Rollup"] = 1] = "Rollup";
})(PriorityOpTree = exports.PriorityOpTree || (exports.PriorityOpTree = {}));
var TransactionStatus;
(function (TransactionStatus) {
    TransactionStatus["NotFound"] = "not-found";
    TransactionStatus["Processing"] = "processing";
    TransactionStatus["Committed"] = "committed";
    TransactionStatus["Finalized"] = "finalized";
})(TransactionStatus = exports.TransactionStatus || (exports.TransactionStatus = {}));
