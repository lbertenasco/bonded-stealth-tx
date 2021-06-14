import { utils } from 'ethers';
import { run, ethers } from 'hardhat';
import { wallet } from '../test/utils';

async function sendETH() {
  const [deployer] = await ethers.getSigners();
  const to = await wallet.generateRandomAddress();
  await deployer.sendTransaction({ to, value: utils.parseEther('1') });
  console.log('Sent ETH');
}

async function execute() {
  const [deployer] = await ethers.getSigners();
  const stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', '0x851356ae760d987E095750cCeb3bC6014560891C');
  const stealthERC20 = await ethers.getContractAt('contracts/mock/StealthERC20.sol:StealthERC20', '0x95401dc811bb5740090279Ba06cfA8fcF6113778');
  const rawTx = await stealthERC20.populateTransaction.stealthMint(deployer.address, utils.parseEther('666'));
  await stealthRelayer.executeWithoutBlockProtection(stealthERC20.address, rawTx.data!, utils.formatBytes32String('hash'));
  console.log('Execute without block protection');
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
