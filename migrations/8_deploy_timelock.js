require('dotenv').config()

const Timelock = artifacts.require("Timelock");

const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS
// 8 hours
const TIMELOCK_DELAY_SECS = (3600 * 8);

module.exports = async function(deployer, network, accounts) {
    deployer.deploy(Timelock, DEPLOYER_ADDRESS, TIMELOCK_DELAY_SECS);
}