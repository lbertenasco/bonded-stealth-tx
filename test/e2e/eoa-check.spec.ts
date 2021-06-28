import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { utils } from 'ethers';

describe('e2e: eoa check', () => {
  let owner: SignerWithAddress, alice: SignerWithAddress, bob: SignerWithAddress;
  let keeper: string;
  let stealthVaultFactory: ContractFactory;
  let stealthVault: Contract;
  let stealthRelayerFactory: ContractFactory;
  let stealthRelayer: Contract;
  let stealthERC20Factory: ContractFactory;
  let stealthERC20: Contract;
  const penalty = utils.parseEther('1');

  before('Setup accounts and contracts', async () => {
    [owner, alice, bob] = await ethers.getSigners();
    keeper = owner.address;
    stealthVaultFactory = await ethers.getContractFactory('StealthVault');
    stealthRelayerFactory = await ethers.getContractFactory('StealthRelayer');
    stealthERC20Factory = await ethers.getContractFactory('StealthERC20');
  });

  beforeEach('EoA checks', async () => {
    stealthVault = await stealthVaultFactory.deploy();
    stealthRelayer = await stealthRelayerFactory.deploy(stealthVault.address);
    stealthERC20 = await stealthERC20Factory.deploy(
      'stealth token', // string memory _name,
      'sToken', // string memory _symbol,
      utils.parseEther('1000000'), // uint256 _mintAmount,
      stealthRelayer.address // address _stealthRelayer
    );

    // set penalty and enables stealth ERC20 to be called from stealthRelayer
    await stealthRelayer.setPenalty(penalty); // (default is 1 ETH)
    await stealthRelayer.addJob(stealthERC20.address);
    await stealthVault.connect(alice).bond({ value: penalty });
    await stealthVault.connect(alice).enableStealthContract(stealthRelayer.address);
  });

  it('receives proper gas', async () => {
    // call stealthERC20 through stealth relayer
    const mintAmount = utils.parseEther('100');
    const rawTx = await stealthERC20.connect(alice).populateTransaction.stealthMint(alice.address, mintAmount);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    await expect(
      stealthRelayer.connect(alice).execute(
        stealthERC20.address, // address _job,
        callData, // bytes memory _callData,
        stealthHash, // bytes32 _stealthHash,
        blockNumber + 1, // uint256 _blockNumber
        { gasLimit: 1_000_000 } // hardhat default block.gasLimit is 12450000
      )
    ).to.be.revertedWith('SV: eoa gas check failed');

    await stealthRelayer.connect(alice).execute(
      stealthERC20.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 2 // uint256 _blockNumber
    );
  });
});