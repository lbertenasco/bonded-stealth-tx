const { expect } = require('chai');
const config = require('../.config.json');

const e18 = ethers.BigNumber.from(10).pow(18);

describe('StealthERC20', () => {
  let owner;
  let alice;
  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it('Should deploy new StealthERC20 with StealthVault', async () => {
    const StealthVault = await ethers.getContractFactory('StealthVault');
    const stealthVault = await StealthVault.deploy();
    const StealthERC20 = await ethers.getContractFactory('StealthERC20');
    const stealthERC20 = await StealthERC20.deploy('Stealth Token', 'sToken', e18.mul(100), stealthVault.address);
    const name = await stealthERC20.name();
    expect(name).to.equal('Stealth Token');
  });

  // describe('StealthVault', () => {
  //   beforeEach('StealthVault', async () => {

  //   })
  //   describe('StealthVault', async () => {
  //   const StealthVault = await ethers.getContractFactory('StealthVault');
  //   const stealthVault = await StealthVault.deploy();
    
    
  // });

});
