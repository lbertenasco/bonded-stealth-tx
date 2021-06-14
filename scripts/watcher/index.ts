import axios from 'axios';
import { run, ethers } from 'hardhat';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import StealthRelayer from '../../artifacts/contracts/StealthRelayer.sol/StealthRelayer.json';

const stealthVaultADdress = '0x4F15455166895e7B0D98715C1e540BbA2718A526';
const stealthRelayerAddress = '0xD6C31564ffe01722991Ced16fC4AFC00F70B6C44';
const stealthERC20Address = '0xEBDe6d5e761792a817177A2ED4A6225693a06D70';
const stealthRelayer = new ethers.utils.Interface(StealthRelayer.abi);

async function main() {
  return new Promise(async () => {
    ethers.provider.on('pending', checkTx);
  });
}

async function checkTx(tx: TransactionResponse) {
  if (tx.to !== stealthRelayerAddress) {
    console.log('Tx with hash', tx.hash, 'not going to stealth relayer');
    return;
  }
  const relayerTransaction = stealthRelayer.parseTransaction(tx);
  // console.log('parsed transaction', relayerTransaction);
}

async function validJob(job: string): Promise<boolean> {
  return true;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
