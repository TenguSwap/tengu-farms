const { BigNumber } = require("@ethersproject/bignumber");
require('dotenv').config()

const TenguToken = artifacts.require("TenguToken");

const INITIAL_TOKEN_LIQUIDITY = process.env.INITIAL_TOKEN_LIQUIDITY;
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS;


module.exports = async function(deployer, network, accounts) {
    let currentAccount = DEPLOYER_ADDRESS;
    let tenguTokenInstance;

    /**
     * Deploy TenguToken
     */
    deployer.deploy(TenguToken)
    .then((instance) => {
        tenguTokenInstance = instance;

        // Mint intial tokens for liquidity pool
        tenguTokenInstance.mint(currentAccount, BigNumber.from(INITIAL_TOKEN_LIQUIDITY).mul(BigNumber.from(String(10**18))));
    })
};
