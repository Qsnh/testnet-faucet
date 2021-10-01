#!/bin/bash

cd `dirname $0`

cat $ZKSYNC_HOME/contracts/artifacts/cache/solpp-generated-contracts/ZkSync.sol/ZkSync.json | jq '{ abi: .abi}' > ZkSync.json
