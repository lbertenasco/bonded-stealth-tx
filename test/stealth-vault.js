const { expect } = require('chai');
const config = require('../.config.json');
const { getTxCost } = require('../utils/web3-utils');

const e18 = ethers.BigNumber.from(10).pow(18);

describe('StealthVault', () => {
  let owner, alice;
  let StealthVault, stealthVault;

  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
    StealthVault = await ethers.getContractFactory('StealthVault');
  });
  
  beforeEach('StealthVault', async () => {
    stealthVault = await StealthVault.deploy();
  });

  it('reverts when sending eth', async () => {
    await expect(owner.sendTransaction({ to: stealthVault.address, value: e18 }))
      .to.be.revertedWith('function selector was not recognized and there\'s no fallback nor receive function');
  })

  describe('isStealthVault', async () => {
    it('returns true', async () => {
      expect(await stealthVault.isStealthVault()).to.be.true;
    })
  });
  
  describe('bond', async () => {

    it('reverts on no msg.value', async () => {
      await expect(stealthVault.bond())
        .to.be.revertedWith('StealthVault::bond:msg-value-should-be-greater-than-zero');
    })
    it('adds msg.value to bonded[msg.sender] and totalBonded', async () => {
      const bond = e18;
      await stealthVault.bond({value: bond});
      expect(await stealthVault.bonded(owner.address)).to.eq(bond);
      expect(await stealthVault.totalBonded()).to.eq(bond);
    })
    it('emits Bonded event', async () => {
      const bond = e18;
      const tx = await stealthVault.bond({value: bond});
      const event = (await tx.wait()).events[0];
      expect(event.event).to.eq('Bonded');
      expect(event.args._keeper).to.eq(owner.address);
      expect(event.args._amount).to.eq(bond);
      expect(event.args._finalBond).to.eq(bond);
    })
    
    
  });

  describe('unbond', async () => {
    it('reverts on amount 0', async () => {
      await expect(stealthVault.unbond(0))
        .to.be.revertedWith('StealthVault::unbond:amount-should-be-greater-than-zero');
    })
    it('reverts on no bond', async () => {
      const bond = e18;
      await expect(stealthVault.unbond(bond))
        .to.be.revertedWith('SafeMath: subtraction overflow');
    })
    it('reverts on higher amount than bond', async () => {
      const bond = e18;
      await expect(stealthVault.unbond(bond.add(1)))
        .to.be.revertedWith('SafeMath: subtraction overflow');
    })
    it('partially removes bond and totalBonded', async () => {
      const bond = e18;
      const removedBond = bond.div(10);
      await stealthVault.bond({ value: bond });
      await stealthVault.unbond(removedBond);
      expect(await stealthVault.bonded(owner.address)).to.eq(bond.sub(removedBond));
      expect(await stealthVault.totalBonded()).to.eq(bond.sub(removedBond));

    })
    it('fully removes bond and totalBonded', async () => {
      const bond = e18;
      const balance = await ethers.provider.getBalance(owner.address);
      const tx1 = await stealthVault.bond({ value: bond });
      const tx2 = await stealthVault.unbondAll();
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      expect(balance).to.eq(balanceAfter.add(await getTxCost(tx1)).add(await getTxCost(tx2)));
      expect(await stealthVault.bonded(owner.address)).to.eq(0);
      expect(await stealthVault.totalBonded()).to.eq(0);
    })
    it('emits Unbonded event', async () => {
      const bond = e18;
      await stealthVault.bond({ value: bond });
      const tx = await stealthVault.unbondAll();
      const event = (await tx.wait()).events[0];
      expect(event.event).to.eq('Unbonded');
      expect(event.args._keeper).to.eq(owner.address);
      expect(event.args._amount).to.eq(bond);
      expect(event.args._finalBond).to.eq(0);
    })
  });

  /*
  function validateHash(address _keeper, bytes32 _hash, uint256 _penalty) external override returns (bool) {
    // keeper is required to be an EOA to avoid onc-hain hash generation to bypass penalty
    // TODO Check how to prevent contract to forward txs from keep3rs to steal the bond
    require(_keeper == tx.origin, 'StealthVault::validateHash:keeper-should-be-EOA');

    address reportedBy = hashReportedBy[_hash];
    if (reportedBy != address(0)) {
      // User reported this TX as public, taking penalty away
      _burnBond(_keeper, _penalty);

      delete hashReportedBy[_hash];
      payable(reportedBy).transfer(_penalty);

      emit BondTaken(_keeper, _penalty, bonded[_keeper], reportedBy);

      // invalid: has was reported
      return false;
    }

    // valid: has was not reported
    return true;
  }
  */
  describe('validateHash', async () => {
    
    
  });

  describe('reportHash', async () => {
    
    
  });
});
