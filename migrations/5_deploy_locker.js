require('dotenv').config()

const TenguLocker = artifacts.require("TenguLocker");


module.exports = async function(deployer, network, accounts) {
    deployer.deploy(TenguLocker)
}