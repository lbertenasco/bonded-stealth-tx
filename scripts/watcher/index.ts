import axios from 'axios';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { ethers } from 'hardhat';
import _ from 'lodash';
import StealthVault from '../../artifacts/contracts/StealthVault.sol/StealthVault.json';
import { Contract } from 'ethers';
// const stealthRelayerAddress = '0xD6C31564ffe01722991Ced16fC4AFC00F70B6C44';
// const stealthERC20Address = '0xEBDe6d5e761792a817177A2ED4A6225693a06D70';

const stealthVaultAddress = '0x4F15455166895e7B0D98715C1e540BbA2718A526';
const stealthVaultInterface = new ethers.utils.Interface(StealthVault.abi);
let stealthVault: Contract;
let callers: string[];
let jobs: string[];
let callersJobs: { [key: string]: string[] } = {};

axios.defaults.headers.post['X-Access-Key'] = process.env.TENDERLY_ACCESS_TOKEN;

async function main() {
  return new Promise(async () => {
    console.log('Starting ...');
    stealthVault = await ethers.getContractAt('contracts/StealthVault.sol:StealthVault', stealthVaultAddress);
    console.log('Getting callers ...');
    callers = await stealthVault.callers();
    console.log('Getting callers jobs ...');
    for (let i = 0; i < callers.length; i++) {
      const callerJobs = await stealthVault.callerJobs(callers[i]);
      console.log('Adding', callerJobs.length, 'jobs of', callers[i]);
      callersJobs[callers[i]] = callerJobs;
      jobs = _.merge(jobs, callerJobs);
    }
    console.log('Hooking up to mempool ...');
    ethers.provider.on('pending', (tx: TransactionResponse) => {
      console.log('new tx');
      checkTx(tx);
    });
  });
}

async function checkTx(tx: TransactionResponse) {
  const POST_DATA = {
    network_id: '42',
    from: tx.from,
    to: tx.to!,
    input: tx.data,
    gas: tx.gasLimit.toNumber(),
    gas_price: tx.gasPrice.toString(),
    value: tx.value.toString(),
    save: true,
    save_if_fails: true,
    simulation_type: 'quick',
  };
  if (!validCaller(tx.from)) return;
  const tenderlyResponse = await axios.post(
    `https://api.tenderly.co/api/v1/account/yearn/project/${process.env.TENDERLY_PROJECT}/simulate`,
    POST_DATA
  );
  if (doesTransactionRevert(tenderlyResponse.data.transaction)) return;
  if (isContractCreation(tenderlyResponse.data.transaction)) return;
  const isValidating = isValidatingHash(tenderlyResponse.data.transaction.transaction_info.call_trace.calls);
  if (!isValidating.validating) return;
  const logs = tenderlyResponse.data.transaction.transaction_info.logs;
  if (logs[isValidating.index!].raw.address.toLowerCase() === stealthVaultAddress.toLowerCase()) {
    const parsedLogs = stealthVaultInterface.parseLog(logs[isValidating.index!].raw);
    if (parsedLogs.name === 'ValidatedHash') {
      await reportHash(parsedLogs.args._hash);
    }
  }
}
function doesTransactionRevert(transaction: any): boolean {
  if (!transaction.status) return true;
  return false;
}

function isContractCreation(transaction: any): boolean {
  if (!transaction.transaction_info.call_trace.calls) return true;
  return false;
}

function isValidatingHash(calls: any[]): { validating: boolean; index?: number } {
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].to.toLowerCase() === stealthVaultAddress.toLowerCase().toLowerCase()) {
      if (!validJob(calls[i].from)) return { validating: false };
      return {
        validating: true,
        index: i,
      };
    }
  }
  return {
    validating: false,
  };
}

async function reportHash(hash: string): Promise<void> {
  console.log('reporting hash', hash);
  // await stealthVault.reportHash(hash);
}

function validCaller(caller: string): boolean {
  return _.includes(callers, caller);
}

function validJob(job: string): boolean {
  return _.includes(jobs, job);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
