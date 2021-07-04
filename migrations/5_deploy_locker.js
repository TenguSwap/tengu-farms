require('dotenv').config()

const TenguLocker = artifacts.require("TenguLocker");
const TenguToken = artifacts.require("TenguToken");


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {

    let tenguTokenInstance;

    deployer.deploy(TenguLocker)
        .then((lockerInstance) => {
            TenguToken.deployed()
                .then((instance) => {
                    tenguTokenInstance = instance;
                    tenguTokenInstance.setExcludedFromAntiWhale(TenguLocker.address, true);
                })
        })
}