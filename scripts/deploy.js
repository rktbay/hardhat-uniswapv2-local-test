const { Contract, ContractFactory, utils, BigNumber, constants } = require("ethers")
const { ethers } = require("hardhat")

const WETH9 = require("./WETH9.json")

const factoryArtifact = require('@uniswap/v2-core/build/UniswapV2Factory.json')
const routerArtifact = require('@uniswap/v2-periphery/build/UniswapV2Router02.json')
const pairArtifact = require('@uniswap/v2-periphery/build/IUniswapV2Pair.json')

async function main() {
  const [owner] = await ethers.getSigners();

  //rather than deploy tons of contracts, deploy the UNIV2 factory
  //then deploy ERC20 tokens for adding LP
  //create Pair
  //get the pair

  //deploying UNIV2, and two ERC20s
  const Factory = new ContractFactory(factoryArtifact.abi, factoryArtifact.bytecode, owner);
  //console.log('factory', Factory);
  const factory = await Factory.deploy(owner.address);
  console.log('factory', factory.address);

  const Usdt = await ethers.getContractFactory('Tether', owner)
  const usdt = await Usdt.deploy();
  console.log('USDT', usdt.address);

  const Usdc = await ethers.getContractFactory('UsdCoin', owner)
  const usdc = await Usdt.deploy();
  console.log('USDC', usdc.address);

  //mint dummy usdt and usdc for usage
  await usdt.connect(owner).mint(
    owner.address,
    utils.parseEther('100000')
  )

  await usdc.connect(owner).mint(
    owner.address,
    utils.parseEther('100000')
  )  

  const tx1 = await factory.createPair(usdt.address, usdc.address)
  await tx1.wait()
  console.log(tx1);

  const pairAddress = await factory.getPair(usdt.address, usdc.address)
  console.log('pairAddress', pairAddress)

  const pair = new Contract(pairAddress, pairArtifact.abi, owner);
  //reserves = amount of tokens in a LP/PAIR
  reserves = await pair.getReserves();
  console.log(`reserves before adding LP`, reserves);

  const Weth = new ContractFactory(WETH9.abi, WETH9.bytecode, owner)
  const weth = await Weth.deploy()
  console.log('weth', weth.address)

  //wtf is a UNIV2 router? used for trading tokens most likely
  const Router = new ContractFactory(routerArtifact.abi, routerArtifact.bytecode, owner)
  //console.log(Router)
  const router = await Router.deploy(factory.address, weth.address)
  console.log('router', router.address)

  //need to approve the ERC20 tokens in order to create an LP
  const approvalUsdt = await usdt.approve(router.address, constants.MaxUint256)
  approvalUsdt.wait()
  const approvalUsdc = await usdc.approve(router.address, constants.MaxUint256)
  approvalUsdc.wait()

  //1-1 ratio for now
  const token0Amount = utils.parseUnits('100');
  const token1Amount = utils.parseUnits('100');

  //deadline for trade to execute
  const deadline = Math.floor(Date.now()/1000 * (10*60));
  const addLiquidityTx = await router.connect(owner).addLiquidity(
    usdt.address,
    usdc.address,
    token0Amount,
    token1Amount,
    0,
    0,
    owner.address,
    deadline,
    {gasLimit: utils.hexlify(1000000)}
  )
  addLiquidityTx.wait()

  //added Tokens should reflect
  reserves = await pair.getReserves()
  console.log(`reserves`, reserves);


  //swap 100 usdt for 80 usdc
  // function swapExactTokensForTokens(
  //   uint amountIn,
  //   uint amountOutMin,
  //   address[] calldata path,
  //   address to,
  //   uint deadline
  // ) external returns (uint[] memory amounts);

  const tx = await router.swapExactTokensForTokens(100,80,[usdt.address, usdc.address],owner.address,deadline);
  console.log("Transaction hash:", tx.hash);

  reserves = await pair.getReserves()
  console.log(`reserves after swap`, reserves);
}

// Run the script
// npx hardhat run --network localhost scripts/01_deployContracts.js

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });