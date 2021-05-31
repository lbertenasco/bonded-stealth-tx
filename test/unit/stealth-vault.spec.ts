import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

const { expect } = require('chai');
const { ZERO_ADDRESS, getTxCost } = require('../../utils/web3-utils');

const e18 = ethers.BigNumber.from(10).pow(18);

describe.skip('StealthVault', () => {
  let owner: SignerWithAddress, alice: SignerWithAddress;
  let keeper: string;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;

  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
    keeper = owner.address;
    stealthVaultFactory = await ethers.getContractFactory('StealthVault');
  });

  beforeEach('StealthVault', async () => {
    stealthVault = await stealthVaultFactory.deploy();
  });

  it('reverts when sending eth', async () => {
    await expect(owner.sendTransaction({ to: stealthVault.address, value: e18 })).to.be.revertedWith(
      "function selector was not recognized and there's no fallback nor receive function"
    );
  });

  describe('isStealthVault', async () => {
    it('returns true', async () => {
      expect(await stealthVault.isStealthVault()).to.be.true;
    });
  });

  describe('bond', async () => {
    it('reverts on no msg.value', async () => {
      await expect(stealthVault.bond()).to.be.revertedWith('StealthVault::addBond:amount-should-be-greater-than-zero');
    });
    it('adds msg.value to bonded[msg.sender] and totalBonded', async () => {
      const bond = e18;
      await stealthVault.bond({ value: bond });
      expect(await stealthVault.bonded(keeper)).to.eq(bond);
      expect(await stealthVault.totalBonded()).to.eq(bond);
    });
    it('emits Bonded event', async () => {
      const bond = e18;
      const tx = await stealthVault.bond({ value: bond });
      const event = (await tx.wait()).events[0];
      expect(event.event).to.eq('Bonded');
      expect(event.args._keeper).to.eq(keeper);
      expect(event.args._amount).to.eq(bond);
      expect(event.args._finalBond).to.eq(bond);
    });
  });

  describe('unbond', async () => {
    it('reverts on amount 0', async () => {
      await expect(stealthVault.unbond(0)).to.be.revertedWith('StealthVault::unbond:amount-should-be-greater-than-zero');
    });
    it('reverts on no bond', async () => {
      const bond = e18;
      await expect(stealthVault.unbond(bond)).to.be.revertedWith('SafeMath: subtraction overflow');
    });
    it('reverts on higher amount than bond', async () => {
      const bond = e18;
      await expect(stealthVault.unbond(bond.add(1))).to.be.revertedWith('SafeMath: subtraction overflow');
    });
    it('partially removes bond and totalBonded', async () => {
      const bond = e18;
      const removedBond = bond.div(10);
      await stealthVault.bond({ value: bond });
      await stealthVault.unbond(removedBond);
      expect(await stealthVault.bonded(keeper)).to.eq(bond.sub(removedBond));
      expect(await stealthVault.totalBonded()).to.eq(bond.sub(removedBond));
    });
    it('fully removes bond and totalBonded', async () => {
      const bond = e18;
      const balance = await ethers.provider.getBalance(keeper);
      const tx1 = await stealthVault.bond({ value: bond });
      const tx2 = await stealthVault.unbondAll();
      const balanceAfter = await ethers.provider.getBalance(keeper);
      expect(balance).to.eq(balanceAfter + (await getTxCost(tx1)) + (await getTxCost(tx2)));
      expect(await stealthVault.bonded(keeper)).to.eq(0);
      expect(await stealthVault.totalBonded()).to.eq(0);
    });
    it('emits Unbonded event', async () => {
      const bond = e18;
      await stealthVault.bond({ value: bond });
      const tx = await stealthVault.unbondAll();
      const event = (await tx.wait()).events[0];
      expect(event.event).to.eq('Unbonded');
      expect(event.args._keeper).to.eq(keeper);
      expect(event.args._amount).to.eq(bond);
      expect(event.args._finalBond).to.eq(0);
    });
  });

  describe('validateHash', async () => {
    const hash = ethers.utils.formatBytes32String('random-hash');
    const bond = e18;
    const aliceBond = e18;
    const penalty = e18;
    it('reverts on _keeper not tx.origin', async () => {
      await expect(stealthVault.validateHash(alice.address, hash, penalty)).to.be.revertedWith(
        'StealthVault::validateHash:keeper-should-be-EOA'
      );
    });
    it('reverts on keeper job not  enabled', async () => {
      await expect(stealthVault.validateHash(keeper, hash, penalty)).to.be.revertedWith('StealthVault::validateHash:keeper-job-not-enabled');
    });
    describe('on enabled StealthJob', async () => {
      beforeEach('', async () => {
        await stealthVault.enableStealthJob(keeper);
      });

      it('reverts when bond is less than penalty', async () => {
        await expect(stealthVault.validateHash(keeper, hash, penalty)).to.be.revertedWith('StealthVault::validateHash:bond-less-than-penalty');
      });
      it('returns true on non reported hash', async () => {
        await stealthVault.bond({ value: bond });
        expect(await stealthVault.callStatic.validateHash(keeper, hash, bond)).to.be.true;
      });

      it('reverts on reported hash but no bond', async () => {
        await stealthVault.connect(alice).bond({ value: aliceBond });
        await stealthVault.connect(alice).reportHash(hash);
        await expect(stealthVault.validateHash(keeper, hash, penalty)).to.be.revertedWith('StealthVault::validateHash:bond-less-than-penalty');
      });
      it('reverts on reported hash but bond less than penalty', async () => {
        await stealthVault.bond({ value: bond });
        await stealthVault.connect(alice).bond({ value: aliceBond });
        await stealthVault.connect(alice).reportHash(hash);
        await expect(stealthVault.validateHash(keeper, hash, bond.add(1))).to.be.revertedWith(
          'StealthVault::validateHash:bond-less-than-penalty'
        );
      });
      describe('on reported hash', async () => {
        beforeEach('', async () => {
          await stealthVault.bond({ value: bond });
          await stealthVault.connect(alice).bond({ value: aliceBond });
          await stealthVault.connect(alice).reportHash(hash);
        });
        it('returns false on reported hash', async () => {
          expect(await stealthVault.callStatic.validateHash(keeper, hash, penalty)).to.be.false;
        });
        it('burns keeper bond and keeps totalBonded', async () => {
          await stealthVault.validateHash(keeper, hash, penalty);
          const totalBonded = await stealthVault.totalBonded();
          expect(await stealthVault.bonded(keeper)).to.eq(0);
          expect(await stealthVault.totalBonded()).to.eq(totalBonded);
        });
        it('removes hashReportedBy on reported hash', async () => {
          await stealthVault.validateHash(keeper, hash, penalty);
          expect(await stealthVault.hashReportedBy(hash)).to.eq(alice.address);
        });
        it('emtis event', async () => {
          const tx = await stealthVault.validateHash(keeper, hash, penalty);
          const event = (await tx.wait()).events[0];
          expect(event.event).to.eq('BondTaken');
          expect(event.args._hash).to.eq(hash);
          expect(event.args._keeper).to.eq(keeper);
          expect(event.args._penalty).to.eq(penalty);
          expect(event.args._reportedBy).to.eq(alice.address);
        });
      });
    });
  });

  describe('reportHash', async () => {
    const hash = ethers.utils.formatBytes32String('random-hash');
    let reportBond: BigNumber;
    before('', async () => {
      reportBond = await stealthVault.requiredReportBond();
    });
    it('reverts if bond is less than required report bond', async () => {
      await expect(stealthVault.reportHash(hash)).to.be.revertedWith('StealthVault::reportHash:bond-less-than-required-report-bond');
    });
    it('reverts already reported hash', async () => {
      await stealthVault.bond({ value: reportBond.mul(2) });
      await stealthVault.reportHash(hash);
      await expect(stealthVault.reportHash(hash)).to.be.revertedWith('StealthVault::reportHash:hash-already-reported');
    });
    it('sets msg.sender as hashReportedBy', async () => {
      await stealthVault.bond({ value: reportBond });
      await stealthVault.reportHash(hash);
      expect(await stealthVault.hashReportedBy(hash)).to.eq(owner.address);
    });
    it('emits event', async () => {
      await stealthVault.bond({ value: reportBond });
      const tx = await stealthVault.reportHash(hash);
      const event = (await tx.wait()).events[0];
      expect(event.event).to.eq('ReportedHash');
      expect(event.args._hash).to.eq(hash);
      expect(event.args._reportedBy).to.eq(owner.address);
      expect(event.args._reportBond).to.eq(reportBond);
    });
  });

  /*
  function enableStealthJob(address _job) external override {
    _setKeeperJob(_job, true);
  }
  function enableStealthJobs(address[] calldata _jobs) external override {
    for (uint i = 0; i < _jobs.length; i++) {
      _setKeeperJob(_jobs[i], true);
    }
  }
  function disableStealthJob(address _job) external override {
    _setKeeperJob(_job, false);
  }
  function disableStealthJobs(address[] calldata _jobs) external override {
    for (uint i = 0; i < _jobs.length; i++) {
      _setKeeperJob(_jobs[i], false);
    }
  }
  */
});
