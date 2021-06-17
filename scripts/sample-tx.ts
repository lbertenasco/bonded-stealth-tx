import { TransactionResponse } from '@ethersproject/abstract-provider';
import { AlchemyWebSocketProvider } from '@ethersproject/providers';
import { BigNumber, Transaction, utils } from 'ethers';
import { run, ethers } from 'hardhat';
import { wallet } from '../test/utils';
import moment from 'moment';
import axios from 'axios';
import tenderlyStaticResponse from '../tenderly_response.json';

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
  const stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', '0xD6C31564ffe01722991Ced16fC4AFC00F70B6C44');
  const stealthERC20 = await ethers.getContractAt('contracts/mock/StealthERC20.sol:StealthERC20', '0xEBDe6d5e761792a817177A2ED4A6225693a06D70');
  const rawTx = await stealthERC20.populateTransaction.stealthMint(deployer.address, utils.parseEther('666'));
  const hash = utils.formatBytes32String(generateRandomNumber(1, 1000000));
  console.log('hash', hash);
  await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data!, hash, { gasPrice: utils.parseUnits('1', 'gwei') });
  console.log('sent at', moment().unix());
  console.log('Executing without block protection');
}
// async function simulate(tx: Transaction) {
//   const POST_DATA = {
//     network_id: '42',
//     from: tx.from!,
//     to: tx.to!,
//     input: tx.data,
//     gas: tx.gasLimit.toString(),
//     gas_price: tx.gasPrice.toString(),
//     value: tx.value.toNumber(),
//     save: true,
//     save_if_fails: true,
//     simulation_type: 'quick',
//   };
//   console.log(POST_DATA);
//   const simulatedTx = { data: tenderlyStaticResponse };
//   // const tenderlyResponse = await axios.post(`https://api.tenderly.co/api/v1/account/me/project/${process.env.TENDERLY_PROJECT}/simulate`, POST_DATA);
//   const logs = simulatedTx.data.transaction.transaction_info.logs;
//   for (let i = 0; i < logs.length; i++) {
//     // const parsedLogs = ethers
//   }
//   console.log(logs);
// }

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
