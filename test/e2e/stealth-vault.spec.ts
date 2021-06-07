import { Contract, ContractFactory } from '@ethersproject/contracts';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { utils } from 'ethers';

describe('e2e: StealthVault', () => {
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

  beforeEach('StealthVault', async () => {
    stealthVault = await stealthVaultFactory.deploy();
    stealthRelayer = await stealthRelayerFactory.deploy(
      owner.address, // address governor
      stealthVault.address // address _stealthVault
    );
    stealthERC20 = await stealthERC20Factory.deploy(
      'stealth token', // string memory _name,
      'sToken', // string memory _symbol,
      utils.parseEther('1000000'), // uint256 _mintAmount,
      stealthRelayer.address // address _stealthRelayer
    );

    // set penalty and enables stealth ERC20 to be called from stealthRelayer
    await stealthRelayer.setPenalty(penalty); // (default is 1 ETH)
    await stealthRelayer.addJob(stealthERC20.address);
  });

  it('bonds, works and loses', async () => {
    const amount = penalty; // bonds enough to cover for stealthRelayer's penalty
    await stealthVault.connect(alice).bond({ value: amount });
    const bonded = await stealthVault.bonded(alice.address);
    const totalBonded = await stealthVault.totalBonded();

    expect(bonded).to.eq(amount);
    expect(totalBonded).to.eq(amount);

    // alice adds stealthRelayer as a valid job she'll perform stealth txs on
    await stealthVault.connect(alice).enableStealthJob(stealthRelayer.address);
    const callers = await stealthVault.callers();
    const aliceJobs = await stealthVault.callerJobs(alice.address);

    expect(callers).to.be.deep.eq([alice.address]);
    expect(aliceJobs).to.be.deep.eq([stealthRelayer.address]);

    // call stealthERC20 through stealth relayer
    const mintAmount = utils.parseEther('100');
    const rawTx = await stealthERC20.connect(alice).populateTransaction.stealthMint(alice.address, mintAmount);
    const callData = rawTx.data;

    const stealthHash = ethers.utils.solidityKeccak256(['string'], ['random-secret-hash']);
    let blockNumber = await ethers.provider.getBlockNumber();

    await stealthRelayer.connect(alice).execute(
      stealthERC20.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1 // uint256 _blockNumber
    );

    const aliceStealthERC20Balance = await stealthERC20.balanceOf(alice.address);
    expect(aliceStealthERC20Balance).to.eq(mintAmount);

    await expect(
      stealthRelayer.connect(alice).execute(
        stealthERC20.address, // address _job,
        callData, // bytes memory _callData,
        stealthHash, // bytes32 _stealthHash,
        blockNumber + 1 // uint256 _blockNumber
      )
    ).to.be.revertedWith('ST: wrong block');

    // bob reports the hash (just for this test, hash is the same alice preiously used)
    await stealthVault.connect(bob).reportHash(stealthHash);
    const hashReportedBy = await stealthVault.hashReportedBy(stealthHash);
    expect(hashReportedBy).to.eq(bob.address);

    blockNumber = await ethers.provider.getBlockNumber();
    await stealthRelayer.connect(alice).execute(
      stealthERC20.address, // address _job,
      callData, // bytes memory _callData,
      stealthHash, // bytes32 _stealthHash,
      blockNumber + 1 // uint256 _blockNumber
    );

    // balance should not change
    const aliceStealthERC20Balance2 = await stealthERC20.balanceOf(alice.address);
    expect(aliceStealthERC20Balance).to.eq(aliceStealthERC20Balance2);

    // alice should lose penalty
    const aliceBonded = await stealthVault.bonded(alice.address);
    const bobBonded = await stealthVault.bonded(bob.address);
    const governorBonded = await stealthVault.bonded(owner.address);

    expect(aliceBonded).to.eq(0);
    expect(bobBonded).to.eq(penalty.div(10));
    expect(governorBonded).to.eq(penalty.sub(penalty.div(10)));
  });
});
