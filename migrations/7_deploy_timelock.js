require('dotenv').config()

const Timelock = artifacts.require("Timelock");

const TIMELOCK_DELAY_SECS = (3600 * 6);
const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS;


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {
    let currentAccount = DEPLOYER_ADDRESS;
    deployer.deploy(Timelock, currentAccount, TIMELOCK_DELAY_SECS)
    .then((instance) => {
        console.log(instance)
    })
}