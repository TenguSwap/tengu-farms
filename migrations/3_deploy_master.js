const { BigNumber } = require("@ethersproject/bignumber");
require('dotenv').config()

const MasterChef = artifacts.require("MasterChef");
const TenguToken = artifacts.require("TenguToken");

const TOKENS_PER_BLOCK = process.env.TOKENS_PER_BLOCK;
const START_BLOCK = process.env.START_BLOCK;


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {

    let tenguTokenInstance;

    deployer.deploy(MasterChef,
        TenguToken.address,
        BigNumber.from(START_BLOCK),
        BigNumber.from(TOKENS_PER_BLOCK).mul(BigNumber.from(String(10**18)))
    )
    .then((masterInstance) => {
        TenguToken.deployed()
            .then((instance) => {
                tenguTokenInstance = instance;
                tenguTokenInstance.setExcludedFromAntiWhale(MasterChef.address, true);
                tenguTokenInstance.setExcludedFromGTenguTax(MasterChef.address, true);
            })
    })
    .then(() => {

    })
}