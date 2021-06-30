require('dotenv').config()

const TenguReferral = artifacts.require("TenguReferral");


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {
    deployer.deploy(TenguReferral)
        .then((instance) => {
            console.log(instance)
        })
}