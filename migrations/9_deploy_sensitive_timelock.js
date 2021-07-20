require('dotenv').config()

const Timelock = artifacts.require("Timelock");

const DEPLOYER_ADDRESS = process.env.DEPLOYER_ADDRESS
// 2 weeks
const TIMELOCK_DELAY_SECS = (3600 * 24 * 14);

module.exports = async function(deployer, network, accounts) {
    deployer.deploy(Timelock, DEPLOYER_ADDRESS, TIMELOCK_DELAY_SECS)
}