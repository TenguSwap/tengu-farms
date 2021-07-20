require('dotenv').config()

const MultiCall = artifacts.require("Multicall");


module.exports = async function(deployer, network, accounts) {
    deployer.deploy(MultiCall)
}