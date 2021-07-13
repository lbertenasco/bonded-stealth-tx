import { Transaction as Web3Transaction } from 'web3-core';
import { ethers, hardhatArguments } from 'hardhat';
import _ from 'lodash';
import { BigNumber, Contract, utils, Transaction as EthersTransaction } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import * as contracts from '../../utils/contracts';
import Web3 from 'web3';
import WebSocket from 'ws';

const web3 = new Web3('ws://127.0.0.1:8546');
const gasnowWebSocketUrl = 'wss://www.gasnow.org/ws';
const gasnowWebSocket = new WebSocket(gasnowWebSocketUrl);

const MAX_GAS_PRICE = utils.parseUnits('350', 'gwei');

const stealthVaultAddress = contracts.stealthVault[hardhatArguments.network! as contracts.DeployedNetwork];

const stealthRelayerAddress = contracts.stealthRelayer[hardhatArguments.network! as contracts.DeployedNetwork];

export const chainIds = {
  mainnet: 1,
  goerli: 5,
  ropsten: 3,
  rinkeby: 4,
};
const chainId = chainIds[hardhatArguments.network! as contracts.DeployedNetwork];

export const reporterPrivateKeys = {
  mainnet: process.env.MAINNET_PRIVATE_KEY,
  goerli: process.env.GOERLY_2_PRIVATE_KEY,
  ropsten: process.env.ROPSTEN_2_PRIVATE_KEY,
  rinkeby: process.env.RINKEBY_2_PRIVATE_KEY,
};
const reporterPrivateKey = reporterPrivateKeys[hardhatArguments.network! as contracts.DeployedNetwork];

let rapidGasPrice: number;
type GasNow = {
  gasPrices: {
    rapid: number;
    fast: number;
    standerd: number;
    slow: number;
  };
};
const updatePageGasPriceData = (data: GasNow) => {
  if (data && data.gasPrices) {
    rapidGasPrice = data.gasPrices['rapid'];
    console.log('Updated rapid gas price to', utils.formatUnits(rapidGasPrice, 'gwei'));
  }
};

gasnowWebSocket.onopen = () => {
  console.log('Gasnow connection open ...');
};
gasnowWebSocket.onmessage = (evt: WebSocket.MessageEvent) => {
  const data = JSON.parse(evt.data as string);
  if (data.type) {
    updatePageGasPriceData(data.data);
  }
};

gasnowWebSocket.onclose = () => {
  console.log('Gasnow connection closed.');
  process.exit(1);
};

let nonce: number;
let reporterSigner: SignerWithAddress;
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

async function main(): Promise<void> {
  return new Promise(async (resolve) => {
    console.log(`Starting on network ${hardhatArguments.network!}(${chainId}) ...`);
    console.log('Getting reporter ...');
    [reporterSigner] = await ethers.getSigners();
    nonce = await reporterSigner.getTransactionCount();
    stealthVault = await ethers.getContractAt('contracts/StealthVault.sol:StealthVault', stealthVaultAddress, reporterSigner);
    stealthRelayer = await ethers.getContractAt('contracts/StealthRelayer.sol:StealthRelayer', stealthRelayerAddress, reporterSigner);
    console.log('Getting penalty ...');
    stealthRelayerPenalty = await stealthRelayer.penalty();
    console.log('Penalty set to', utils.formatEther(stealthRelayerPenalty));
    console.log('Getting callers ...');
    callers = (await stealthVault.callers()).map((caller: string) => normalizeAddress(caller));
    console.log('Getting callers jobs ...');
    for (let i = 0; i < callers.length; i++) {
      addCallerStealthContracts(callers[i], await stealthVault.callerContracts(callers[i]));
      console.log('Getting bonded from', callers[i]);
      addBond(callers[i], await stealthVault.bonded(callers[i]));
    }
    console.log('Hooking up to mempool ...');
    web3.eth.subscribe('pendingTransactions', async (error: Error, transactionHash: string) => {
      let tx;
      try {
        // For some reason web3 is failing sometimes to parse the transaction
        tx = await web3.eth.getTransaction(transactionHash);
      } catch (err) {}
      if (tx && tx.to && normalizeAddress(tx.to) === normalizeAddress(stealthRelayerAddress)) {
        checkTx(web3TransactionToEthers(tx));
      }
    });
    console.log('Hooking up to events ...');
    stealthRelayer.on('PenaltySet', (penalty: BigNumber) => {
      console.log('Updating penalty to', utils.formatEther(penalty));
      stealthRelayerPenalty = penalty;
    });
    stealthVault.on('StealthContractEnabled', (caller: string, job: string) => {
      addCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthContractsEnabled', (caller: string, jobs: string[]) => {
      addCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('StealthContractDisabled', (caller: string, job: string) => {
      removeCallerStealthContracts(caller, [job]);
    });
    stealthVault.on('StealthContractsDisabled', (caller: string, jobs: string[]) => {
      removeCallerStealthContracts(caller, jobs);
    });
    stealthVault.on('Bonded', (caller: string, bonded: BigNumber, _: BigNumber) => {
      addBond(caller, bonded);
    });
    stealthVault.on('Unbonded', (caller: string, unbonded: BigNumber, _: BigNumber) => {
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
    chainId,
    hash: tx.hash,
    nonce: tx.nonce,
    from: normalizeAddress(tx.from),
    to: normalizeAddress(tx.to!),
    gasLimit: BigNumber.from(tx.gas),
    gasPrice: BigNumber.from(tx.gasPrice),
    data: tx.input,
    value: BigNumber.from(tx.value),
  };
}

async function checkTx(tx: EthersTransaction) {
  console.log(tx);
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
  await reportHash(parsedTx.args._stealthHash, tx.gasPrice!);
}

async function reportHash(hash: string, validatingGasPrice: BigNumber): Promise<void> {
  console.log('reporting hash', hash);
  nonce++;
  let rushGasPrice = validatingGasPrice.gt(rapidGasPrice)
    ? validatingGasPrice.add(validatingGasPrice.div(3))
    : BigNumber.from(`${rapidGasPrice}`);
  rushGasPrice = rushGasPrice.gt(MAX_GAS_PRICE) ? MAX_GAS_PRICE : rushGasPrice;
  const populatedTx = await stealthVault.populateTransaction.reportHash(hash, { gasLimit: 1000000, gasPrice: rushGasPrice, nonce });
  const signedtx = await web3.eth.accounts.signTransaction(
    {
      to: stealthVaultAddress,
      gasPrice: `${rushGasPrice.toString()}`,
      gas: '100000',
      data: populatedTx.data!,
    },
    reporterPrivateKey as string
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

function removeCallerStealthContracts(caller: string, callerContracts: string[]): void {
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
