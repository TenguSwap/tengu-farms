require('dotenv').config()

const MultiCall = artifacts.require("Multicall");


const logTx = (tx) => {
    console.dir(tx, {depth: 3});
}

module.exports = async function(deployer, network, accounts) {
    deployer.deploy(MultiCall)
    .then((instance) => {
        console.log(instance)
    })
}