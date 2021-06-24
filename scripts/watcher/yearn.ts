import { Transaction as Web3Transaction } from 'web3-core';
import { ethers } from 'hardhat';
import _ from 'lodash';
import { BigNumber, Contract, utils, Transaction as EthersTransaction } from 'ethers';
import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

// Using WebSockets
const web3 = createAlchemyWeb3('wss://eth-kovan.ws.alchemyapi.io/v2/OAh_8Jbu8aMsuFAj1n8gRzo8PPRfK7VP');

const stealthVaultAddress = '0x12F86457C6aa1d0e63aef72b4E2ae391A7EeB14D';
const stealthRelayerAddress = '0x4A7a3b790D0aD2b9e1e65f9a3cf31e99455D4E1c';
let nonce: number;
let reporter: SignerWithAddress;
let stealthVault: Contract;
let stealthRelayer: Contract;
let callers: string[];
let jobs: string[];
let stealthRelayerPenalty: BigNumber;
const bonded: { [key: string]: BigNumber } = {};
const callersJobs: { [key: string]: string[] } = {};

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
    stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', stealthRelayerAddress, reporter);
    console.log('Getting penalty ...');
    stealthRelayerPenalty = await stealthRelayer.penalty();
    console.log('Getting callers ...');
    callers = (await stealthVault.callers()).map((caller: string) => caller.toLowerCase());
    console.log('Getting callers jobs ...');
    for (let i = 0; i < callers.length; i++) {
      addCallerStealthContracts(callers[i], await stealthVault.callerContracts(callers[i]));
      console.log('Getting bonded from', callers[i]);
      addBond(callers[i], await stealthVault.bonded(callers[i]));
    }
    console.log('Hooking up to mempool ...');
    web3.eth.subscribe('alchemy_filteredFullPendingTransactions', { address: stealthRelayerAddress }, (err: Error, tx: Web3Transaction) => {
      checkTx(web3TransactionToEthers(tx));
    });
    console.log('Hooking up to events ...');
    stealthRelayer.on('PenaltySet', (penalty: BigNumber) => {
      console.log('Updating penalty to', utils.formatEther(penalty));
      stealthRelayerPenalty = penalty;
    });
    stealthVault.on('StealthJobEnabled', (caller: string, job: string) => {
      addCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthJobsEnabled', (caller: string, jobs: string[]) => {
      addCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('StealthJobDisabled', (caller: string, job: string) => {
      removeCallerStealthJobs(caller, [job]);
    });
    stealthVault.on('StealthJobsDisabled', (caller: string, jobs: string[]) => {
      removeCallerStealthJobs(caller, jobs);
    });
    stealthVault.on('Bonded', (caller: string, bonded: BigNumber) => {
      addBond(caller, bonded);
    });
    stealthVault.on('Unbonded', (caller: string, unbonded: BigNumber) => {
      reduceBond(caller, unbonded);
    });
    stealthVault.on('PenaltyApplied', (hash: string, caller: string, penalty: BigNumber, reporter: string) => {
      reduceBond(caller, penalty);
      addBond(reporter, penalty.div(10));
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
  if (!validCallerJobs(tx.from!, stealthRelayerAddress)) return;
  console.timeEnd(`Validate caller jobs ${rand}-${tx.hash!}`);
  console.time(`Validate bond for penalty ${rand}-${tx.hash!}`);
  if (!validBondForPenalty(tx.from!)) return;
  console.timeEnd(`Validate bond for penalty ${rand}-${tx.hash!}`);
  console.time(`Transaction parse ${rand}-${tx.hash!}`);
  const parsedTx = await stealthRelayer.interface.parseTransaction(tx);
  console.timeEnd(`Transaction parse ${rand}-${tx.hash!}`);
  console.time(`Validate hash ${rand}-${tx.hash!}`);
  if (!isValidatingHash(parsedTx.name)) return;
  console.timeEnd(`Validate hash ${rand}-${tx.hash!}`);
  await reportHash(parsedTx.args._stealthHash, tx.gasPrice);
}

async function reportHash(hash: string, gasPrice: BigNumber): Promise<void> {
  console.log('reporting hash', hash);
  nonce++;
  const populatedTx = await stealthVault.populateTransaction.reportHash(hash, { gasLimit: 1000000, gasPrice: gasPrice.mul(3), nonce });
  const signedtx = await web3.eth.accounts.signTransaction(
    {
      to: stealthVaultAddress,
      gasPrice: `${gasPrice.mul(3).toString()}`,
      gas: '100000',
      data: populatedTx.data!,
    },
    process.env.KOVAN_2_PRIVATE_KEY as string
  );
  await web3.eth.sendSignedTransaction(signedtx.rawTransaction!, (error: Error, hash: string) => {
    console.log('sent report with tx hash', hash);
  });
}

function validCallerJobs(caller: string, jobs: string): boolean {
  caller = normalizeAddress(caller);
  jobs = normalizeAddress(jobs);
  if (!_.has(callersJobs, caller)) return false;
  if (!_.includes(callersJobs[caller], jobs)) return false;
  return true;
}

function validBondForPenalty(caller: string): boolean {
  return bonded[caller].gte(stealthRelayerPenalty);
}

function isValidatingHash(functionName: string): boolean {
  return (
    functionName === 'execute' ||
    functionName === 'executeAndPay' ||
    functionName === 'executeWithoutBlockProtection' ||
    functionName === 'executeWithoutBlockProtectionAndPay'
  );
}

function addCallerStealthContracts(caller: string, callerContracts: string[]): void {
  console.log('Adding', callerContracts.length, 'jobs of', caller);
  callerContracts = callerContracts.map((cj) => normalizeAddress(cj));
  caller = normalizeAddress(caller);
  if (!_.has(callersJobs, caller)) callersJobs[caller] = [];
  callersJobs[caller] = _.union(callersJobs[caller], callerContracts);
  jobs = _.union(jobs, callerContracts);
}

function removeCallerStealthJobs(caller: string, callerContracts: string[]): void {
  console.log('Removing', callerContracts.length, 'jobs of', caller);
  callerContracts = callerContracts.map((cj) => normalizeAddress(cj));
  caller = normalizeAddress(caller);
  callersJobs[caller] = _.difference(callersJobs[caller], callerContracts);
  jobs = _.difference(jobs, callerContracts);
}

function reduceBond(caller: string, amount: BigNumber): void {
  console.log('Reducing', utils.formatEther(amount), 'of', caller, 'bonds');
  caller = normalizeAddress(caller);
  bonded[caller] = bonded[caller].sub(amount);
}

function addBond(caller: string, amount: BigNumber): void {
  console.log('Adding', utils.formatEther(amount), 'to', caller, 'bonds');
  caller = normalizeAddress(caller);
  if (!_.has(bonded, caller)) bonded[caller] = BigNumber.from('0');
  bonded[caller] = bonded[caller].add(amount);
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
