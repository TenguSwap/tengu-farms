require('dotenv').config()

const MasterChef = artifacts.require("MasterChef");
const TenguReferral = artifacts.require("TenguReferral");


module.exports = async function(deployer, network, accounts) {
    let masterChefInstance
    let tenguReferralInstance

    deployer.deploy(TenguReferral)
        .then((tenguReferralInstance_) => {
            tenguReferralInstance = tenguReferralInstance_
            tenguReferralInstance.transferOwnership(MasterChef.address)
        })
        .then(() => {
            MasterChef.deployed()
                .then((masterChefInstance_) => {
                    masterChefInstance = masterChefInstance_;
                    // Set referral into MasterChef contract
                    masterChefInstance.setTenguReferral(tenguReferralInstance.address);
                })
        })
}