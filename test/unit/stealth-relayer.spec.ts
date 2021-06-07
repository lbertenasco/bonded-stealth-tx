import moment from 'moment';
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { deployMockContract, MockContract } from '@ethereum-waffle/mock-contract';
import { MockProvider } from '@ethereum-waffle/provider';
import { BigNumber, BigNumberish, utils, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { given, then, when } from '../utils/bdd';
import { constants, wallet } from '../utils';
import { expect } from 'chai';

import StealthVault from '../../artifacts/contracts/StealthVault.sol/StealthVault.json';
import { expectNoEventWithName } from '../utils/event-utils';

describe('StealthRelayer', () => {
  let governor: SignerWithAddress;
  let forceETHFactory: ContractFactory;
  let stealthRelayerFactory: ContractFactory;
  let stealthRelayer: Contract;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;

  before('Setup accounts and contracts', async () => {
    [governor] = await ethers.getSigners();
    stealthVaultFactory = await ethers.getContractFactory('contracts/mock/StealthVault.sol:StealthVaultMock');
    stealthRelayerFactory = await ethers.getContractFactory('contracts/mock/StealthRelayer.sol:StealthRelayerMock');
    forceETHFactory = await ethers.getContractFactory('contracts/mock/ForceETH.sol:ForceETH');
  });

  beforeEach(async () => {
    stealthVault = await stealthVaultFactory.deploy();
    stealthRelayer = await stealthRelayerFactory.deploy(stealthVault.address);
  });

  describe('execute', () => {
    // only valid job
    // validateStealthTxAndBlock
  });

  describe('executeWithoutBlockProtection', () => {
    // only valid job
    // validateStealthTx
    when('block protection is forced', () => {
      then('tx is reverted with reason');
    });
    when('all parameters are valid and function call reverts', () => {
      then('tx is reverted with reason');
    });
    when('all parameters are valid and function call doesnt revert', () => {
      then('returns function call return');
    });
  });

  describe('onlyValidJob', () => {
    // behaves like only valid job
    when('executing with an invalid job', () => {
      then('tx is reverted with reason');
    });
    when('executing with an valid job', () => {
      then('tx is executed or not reverted with invalid job reason');
    });
  });

  describe('jobs', () => {
    when('there are no added jobs', () => {
      then('returns empty array');
    });
    when('there are jobs', () => {
      then('returns correct values');
    });
  });

  describe('addJob', () => {
    when('job was already added', () => {
      then('tx is reverted with reason');
    });
    when('job was not already added', () => {
      then('adds job to set');
    });
  });

  describe('addJobs', () => {
    when('a job was already added', () => {
      then('tx is reverted with reason');
    });
    when('jobs were not already added', () => {
      then('adds jobs to set');
    });
  });

  describe('removeJob', () => {
    when('job was not added', () => {
      then('tx is reverted with reason');
    });
    when('job was added', () => {
      then('removes job from set');
    });
  });

  describe('removeJobs', () => {
    when('one of the job was not added', () => {
      then('tx is reverted with reason');
    });
    when('jobs were added', () => {
      then('removes jobs from set');
    });
  });
});
