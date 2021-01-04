const hre = require('hardhat');
const ethers = hre.ethers;

const e18 = ethers.BigNumber.from(10).pow(18);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';


module.exports = {
    e18,
    ZERO_ADDRESS,
}
