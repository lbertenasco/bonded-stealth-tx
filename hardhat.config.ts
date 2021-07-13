import 'dotenv/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
// import '@tenderly/hardhat-tenderly';
import { removeConsoleLog } from 'hardhat-preprocessor';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import { utils } from 'ethers';

module.exports = {
  defaultNetwork: 'hardhat',
  networks: process.env.TEST
    ? {}
    : {
        hardhat: {
          forking: {
            enabled: process.env.FORK ? true : false,
            url: process.env.MAINNET_HTTPS_URL,
          },
          mining: {
            auto: false,
            interval: 30 * 1000,
          },
        },
        localMainnet: {
          url: process.env.LOCAL_MAINNET_HTTPS_URL,
        },
        rinkeby: {
          url: process.env.RINKEBY_HTTPS_URL,
          accounts: [process.env.RINKEBY_PRIVATE_KEY, process.env.RINKEBY_2_PRIVATE_KEY],
          gasPrice: 'auto',
        },
        goerli: {
          url: process.env.GOERLI_HTTPS_URL,
          accounts: [process.env.GOERLI_PRIVATE_KEY, process.env.GOERLI_2_PRIVATE_KEY],
          gasPrice: 'auto',
        },
        ropsten: {
          url: process.env.ROPSTEN_HTTPS_URL,
          accounts: [process.env.ROPSTEN_PRIVATE_KEY, process.env.ROPSTEN_2_PRIVATE_KEY],
        },
        mainnet: {
          url: process.env.MAINNET_HTTPS_URL,
          accounts: [process.env.MAINNET_PRIVATE_KEY],
        },
      },
  solidity: {
    compilers: [
      {
        version: '0.8.4',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  tenderly: {
    project: process.env.TENDERLY_PROJECT,
    username: process.env.TENDERLY_USERNAME,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: process.env.COINMARKETCAP_DEFAULT_CURRENCY,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  preprocess: {
    eachLine: removeConsoleLog((hre) => hre.network.name !== 'hardhat'),
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
