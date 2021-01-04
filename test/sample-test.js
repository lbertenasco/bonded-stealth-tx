const { expect } = require('chai');
const config = require('../.config.json');

const e18 = ethers.BigNumber.from(10).pow(18);

describe('MockStrategy', function() {
  let owner;
  let alice;
  before('Setup accounts and contracts', async () => {
    [owner, alice] = await ethers.getSigners();
  });

  it('Should deploy new MockStrategy with GovernanceSwap', async function() {
    const GovernanceSwap = await ethers.getContractFactory('GovernanceSwap');
    const governanceSwap = await GovernanceSwap.deploy();
    const MockStrategy = await ethers.getContractFactory('MockStrategy');
    const mockStrategy = await MockStrategy.deploy(governanceSwap.address, config.contracts.mainnet.controller.address);
    await mockStrategy.deployed();
    const name = await mockStrategy.getName();
    expect(name).to.equal('StrategyCurveYVoterProxy');
  });

  it.only('Should deploy on mainnet fork', async function() {
    await hre.network.provider.request({ method: "hardhat_impersonateAccount", params: [config.accounts.mainnet.crvWhale] });
    const crvWhale = owner.provider.getUncheckedSigner(config.accounts.mainnet.crvWhale);

    const GovernanceSwap = await ethers.getContractFactory('GovernanceSwap');
    const governanceSwap = await GovernanceSwap.deploy();
    
    const MockStrategy = await ethers.getContractFactory('MockStrategy');
    const mockStrategy = await MockStrategy.deploy(governanceSwap.address, config.contracts.mainnet.controller.address);
    
    const uniswapV2Address = config.contracts.mainnet.uniswapV2Router.address;
    const UniswapV2DexHandler = await ethers.getContractFactory('UniswapV2DexHandler');
    const uniswapV2DexHandler = await UniswapV2DexHandler.deploy(uniswapV2Address);
    await uniswapV2DexHandler.deployed();
    
    const isDexHandler = await uniswapV2DexHandler.isDexHandler();
    expect(isDexHandler).to.be.true;
    await governanceSwap.addDexHandler(uniswapV2Address, uniswapV2DexHandler.address);


    // Add CRV -> WETH -> DAI path and data for uniswapv2
    const crvAddress = await mockStrategy.callStatic.crv();
    const daiAddress = await mockStrategy.callStatic.dai();
    const wethAddress = await mockStrategy.callStatic.weth();
    const crvContract = await ethers.getContractAt('ERC20Token', crvAddress, owner);
    const daiContract = await ethers.getContractAt('ERC20Token', daiAddress, owner);

    const customSwapDataCrvDai = await uniswapV2DexHandler.callStatic.customSwapData(
      0, // _amount
      0, // _min
      [crvAddress, wethAddress, daiAddress], // _path
      owner.address, // _to
      0// _expire
    );
    await governanceSwap.setPairDefaults(crvAddress, daiAddress, uniswapV2Address, customSwapDataCrvDai);
    
    const handlerAddress = await governanceSwap.callStatic.getPairDefaultDexHandler(crvAddress, daiAddress);
    const dexHandler = await ethers.getContractAt('UniswapV2DexHandler', handlerAddress, owner);
    
    // Send CRV to strategy
    const crvAmount = e18.mul(10000);
    await crvContract.connect(crvWhale).transfer(mockStrategy.address, crvAmount)
    
    const strategyCrvBalance = await crvContract.callStatic.balanceOf(mockStrategy.address);
    console.log({ strategyCrvBalance: strategyCrvBalance.div(e18).toString() });

    // Suboptimal route in data
    const suboptimalSwapDataCrvDai = await uniswapV2DexHandler.callStatic.customSwapData(
      0, // _amount
      0, // _min
      [crvAddress, daiAddress], // _path
      owner.address, // _to
      0// _expire
    );

    // Should revert with 'custom-swap-is-suboptimal'
    console.log({ customSwapDataCrvDai })
    console.log('getAmountOut(customSwapDataCrvDai):', (await dexHandler.getAmountOut(customSwapDataCrvDai, strategyCrvBalance)).div(e18).toString());
    console.log({ suboptimalSwapDataCrvDai })
    console.log('getAmountOut(suboptimalSwapDataCrvDai):', (await dexHandler.getAmountOut(suboptimalSwapDataCrvDai, strategyCrvBalance)).div(e18).toString());
    await expect(mockStrategy.customHarvest(uniswapV2Address, suboptimalSwapDataCrvDai))
    .to.be.revertedWith('custom-swap-is-suboptimal');
    
    // Should succeed by sending the same path governance uses 
    await mockStrategy.customHarvest(uniswapV2Address, customSwapDataCrvDai);
    const strategyDaiBalance = await daiContract.callStatic.balanceOf(mockStrategy.address);

    console.log({ strategyDaiBalance: strategyDaiBalance.div(e18).toString() })

    // More rewards!
    // Send CRV to strategy
    await crvContract.connect(crvWhale).transfer(mockStrategy.address, crvAmount)


    // Default harvest
    await mockStrategy.harvest();

    const strategyDaiBalance2 = await daiContract.callStatic.balanceOf(mockStrategy.address);

    console.log({ strategyDaiBalance2: strategyDaiBalance2.div(e18).toString() })
    

    // Even more rewards!
    // Send CRV to strategy
    await crvContract.connect(crvWhale).transfer(mockStrategy.address, crvAmount)

    // Old harvest (Directly to uniswapV2)
    await mockStrategy.oldHarvest();

    const strategyDaiBalance3 = await daiContract.callStatic.balanceOf(mockStrategy.address);

    console.log({ strategyDaiBalance3: strategyDaiBalance3.div(e18).toString() })
    
  });

});
