import { TransactionResponse } from '@ethersproject/abstract-provider';
import { AlchemyWebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Transaction, utils } from 'ethers';
import { run, ethers } from 'hardhat';
import { wallet } from '../test/utils';
import moment from 'moment';
import axios from 'axios';

axios.defaults.headers.post['X-Access-Key'] = process.env.TENDERLY_ACCESS_TOKEN;
const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function sendETH() {
  const [deployer] = await ethers.getSigners();
  const to = await wallet.generateRandomAddress();
  await deployer.sendTransaction({ to, value: utils.parseEther('1') });
  console.log('Sent ETH');
}

async function execute() {
  const [deployer] = await ethers.getSigners();
  const stealthVault = await ethers.getContractAt('contracts/StealthVault.sol:StealthVault', '0x12F86457C6aa1d0e63aef72b4E2ae391A7EeB14D');
  const stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', '0x4A7a3b790D0aD2b9e1e65f9a3cf31e99455D4E1c');
  const stealthERC20 = await ethers.getContractAt('contracts/mock/StealthERC20.sol:StealthERC20', '0xf244E372A492e415599452b4eA139338f3f24a0b');
  // await stealthRelayer.setPenalty(utils.parseEther('0.001'));
  // await stealthVault.addStealthJob(stealthRelayer.address);
  const rawTx = await stealthERC20.populateTransaction.stealthMint(deployer.address, utils.parseEther('666'));
  const hash = utils.formatBytes32String(generateRandomNumber(1, 1000000));
  console.log('hash', hash);
  await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data!, hash, {
    gasLimit: 200000,
    gasPrice: utils.parseUnits('1', 'gwei'),
  });
  console.log('sent at', moment().unix());
  console.log('Executing without block protection');
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
