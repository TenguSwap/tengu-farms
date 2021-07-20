const { BigNumber } = require("@ethersproject/bignumber");
require('dotenv').config()

const MasterChef = artifacts.require("MasterChef");
const TenguToken = artifacts.require("TenguToken");

const DEV_ADDRESS = process.env.DEV_ADDRESS;
const FEE_ADDRESS = process.env.FEE_ADDRESS;
const TOKENS_PER_BLOCK = process.env.TOKENS_PER_BLOCK;
const START_BLOCK = process.env.START_BLOCK;


module.exports = async function(deployer, network, accounts) {
    let tenguTokenInstance;
    let masterInstance;

    deployer.deploy(MasterChef,
        TenguToken.address,
        BigNumber.from(START_BLOCK),
        BigNumber.from(TOKENS_PER_BLOCK).mul(BigNumber.from(String(10**18)))
    )
    .then((masterInstance_) => {
        masterInstance = masterInstance_;

        // Set dev address (for 10% fee on mint TENGU)
        masterInstance.setDevAddress(DEV_ADDRESS);
    })
    .then(() => {
        // Set deposit fee dst address
        masterInstance.setFeeAddress(FEE_ADDRESS);
    })
    .then(() => {
        TenguToken.deployed()
            .then((tenguTokenInstance_) => {
                tenguTokenInstance = tenguTokenInstance_;
                // Exclude from antiwhale
                tenguTokenInstance.setExcludedFromAntiWhale(MasterChef.address, true);
            })
            .then(() => {
                // Exclude from GTENGU tax
                tenguTokenInstance.setExcludedFromGTenguTax(MasterChef.address, true);
            })
    })
}