const { BigNumber } = require("@ethersproject/bignumber");
require('dotenv').config()

const GreatTenguToken = artifacts.require("GreatTenguToken");
const TenguToken = artifacts.require("TenguToken");

const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS;


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {
    console.log({network});

    let currentAccount = DEPLOYER_ADDRESS;
    console.log({currentAccount});

    /**
     * Deploy TenguToken
     */
    deployer.deploy(GreatTenguToken)
    .then((instance) => {
        instance.setTenguContractAddress(TenguToken.address);
    })
    .then(() => {
        TenguToken.deployed()
        .then((instance) => {
            instance.setGTenguContractAddress(GreatTenguToken.address);
        })
    })
    .then((tx) => {
        logTx(tx);
        return ;
    })
    .then((instance) => {

    })
};
