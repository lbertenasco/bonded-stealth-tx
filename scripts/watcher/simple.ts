import { Transaction as Web3Transaction } from 'web3-core';
import { ethers } from 'hardhat';
import _ from 'lodash';
import StealthRelayer from '../../artifacts/contracts/StealthRelayer.sol/StealthRelayer.json';
import { BigNumber, Contract, Transaction as EthersTransaction } from 'ethers';
import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// Using WebSockets
const web3 = createAlchemyWeb3('wss://eth-kovan.ws.alchemyapi.io/v2/OAh_8Jbu8aMsuFAj1n8gRzo8PPRfK7VP');

const stealthVaultAddress = '0x4F15455166895e7B0D98715C1e540BbA2718A526';
const stealthRelayerAddress = '0xD6C31564ffe01722991Ced16fC4AFC00F70B6C44';
const stealthRelayerInterface = new ethers.utils.Interface(StealthRelayer.abi);
let nonce: number;
let reporter: SignerWithAddress;
let stealthVault: Contract;
let callers: string[];
let jobs: string[];
let callersJobs: { [key: string]: string[] } = {};
let bonded: { [key: string]: BigNumber } = {};

const generateRandomNumber = (min: number, max: number): string => {
  return `${Math.floor(Math.random() * (max - min) + min)}`;
};

async function main() {
  return new Promise(async () => {
    console.log('Starting ...');
    console.log('Getting reporter ...');
    [, reporter] = await ethers.getSigners();
    nonce = await reporter.getTransactionCount();
    stealthVault = await ethers.getContractAt('contracts/StealthVault.sol:StealthVault', stealthVaultAddress, reporter);
    console.log('Getting callers ...');
    callers = (await stealthVault.callers()).map((caller: string) => caller.toLowerCase());
    console.log('Getting callers jobs ...');
    for (let i = 0; i < callers.length; i++) {
      const callerJobs = (await stealthVault.callerJobs(callers[i])).map((callerJob: string) => callerJob.toLowerCase());
      console.log('Adding', callerJobs.length, 'jobs of', callers[i]);
      callersJobs[callers[i]] = callerJobs;
      jobs = _.merge(jobs, callerJobs);
      console.log('Getting bonded from', callers[i]);
      bonded[callers[i]] = await stealthVault.bonded(callers[i]);
    }
    console.log('Hooking up to mempool ...');

    web3.eth.subscribe('alchemy_fullPendingTransactions', (err: Error, tx: Web3Transaction) => {
      checkTx(web3TransactionToEthers(tx));
    });
  });
}

function web3TransactionToEthers(tx: Web3Transaction): EthersTransaction {
  return {
    chainId: 42,
    hash: tx.hash,
    nonce: tx.nonce,
    from: tx.from,
    to: tx.to!,
    gasLimit: BigNumber.from(tx.gas),
    gasPrice: BigNumber.from(tx.gasPrice),
    data: tx.input,
    value: BigNumber.from(tx.value),
  };
}

async function checkTx(tx: EthersTransaction) {
  const rand = generateRandomNumber(1, 1000000000);
  console.time(`Validate caller jobs ${rand}-${tx.hash!}`);
  if (!validCallerJobs(tx.from!, tx.to!)) return;
  console.timeEnd(`Validate caller jobs ${rand}-${tx.hash!}`);
  // validate penalty and bond from caller
  const parsedTx = await stealthRelayerInterface.parseTransaction(tx);
  if (!isValidatingHash(parsedTx.name)) return;
  await reportHash(parsedTx.args._stealthHash, tx.gasPrice);
}

async function reportHash(hash: string, gasPrice: BigNumber): Promise<void> {
  console.log('reporting hash', hash);
  nonce++;
  const populatedTx = await stealthVault.populateTransaction.reportHash(hash, { gasLimit: 1000000, gasPrice: gasPrice.mul(3), nonce });
  const signedtx = await web3.eth.accounts.signTransaction(
    {
      to: stealthVaultAddress,
      gasPrice: web3.utils.toWei('15', 'gwei'),
      gas: '100000',
      data: populatedTx.data!,
    },
    process.env.KOVAN_2_PRIVATE_KEY as string
  );
  const promiEvent = await web3.eth.sendSignedTransaction(signedtx.rawTransaction!, (error: Error, hash: string) => {
    console.log('Sent report with tx hash', hash);
  });
}

function validCallerJobs(caller: string, jobs: string): boolean {
  if (!_.has(callersJobs, caller)) return false;
  if (!_.includes(callersJobs[caller], jobs)) return false;
  return true;
}

function isValidatingHash(functionName: string): boolean {
  return (
    functionName === 'execute' ||
    functionName === 'executeAndPay' ||
    functionName === 'executeWithoutBlockProtection' ||
    functionName === 'executeWithoutBlockProtectionAndPay'
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
