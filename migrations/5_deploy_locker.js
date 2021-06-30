require('dotenv').config()

const TenguLocker = artifacts.require("TenguLocker");


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {
    deployer.deploy(TenguLocker)
        .then((instance) => {
            console.log(instance)
        })
}