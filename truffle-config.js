const HDWalletProvider = require('@truffle/hdwallet-provider');
require('dotenv').config()

const MNENOMIC = process.env.MNEMONIC.toString().trim();

module.exports = {
  // Uncommenting the defaults below
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
  //
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*"
    },
    testnet: {
      provider: () => new HDWalletProvider(MNENOMIC, `https://data-seed-prebsc-2-s1.binance.org:8545`),
      network_id: 97,
      confirmations: 1,
      timeoutBlocks: 200,
      skipDryRun: true,
      from: process.env.DEPLOYER_ADDRESS.toString().trim(),
    },
    bsc: {
      provider: () => new HDWalletProvider(MNENOMIC, `https://bsc-dataseed1.defibit.io/`),
      network_id: 56,
      confirmations: 3,
      timeoutBlocks: 200,
      skipDryRun: false,
      from: process.env.DEPLOYER_ADDRESS.toString().trim(),
    },
  },
  //
  compilers: {
    solc: {
      version: "0.6.12"
    }
  },
  plugins: [
    'truffle-plugin-verify'
  ],
  api_keys: {
    bscscan: process.env.BSCSCAN_APIKEY.toString().trim()
  }
};
