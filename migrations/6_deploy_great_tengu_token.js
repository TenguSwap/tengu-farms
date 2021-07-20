require('dotenv').config()

const GreatTenguToken = artifacts.require("GreatTenguToken");
const TenguToken = artifacts.require("TenguToken");


module.exports = async function(deployer, network, accounts) {
    let tenguTokenInstance;

    /**
     * Deploy TenguToken
     */
    deployer.deploy(GreatTenguToken)
    .then((instance) => {
        // Set TENGU address into GTENGU token contract
        instance.setTenguContractAddress(TenguToken.address);
    })
    .then(() => {
        TenguToken.deployed()
        .then((instance) => {
            tenguTokenInstance = instance;

            // Set GTENGU address into TENGU token contract
            tenguTokenInstance.setGTenguContractAddress(GreatTenguToken.address);
            // Exclude from antiwhale
            tenguTokenInstance.setExcludedFromAntiWhale(GreatTenguToken.address, true);
        });
    })
};
