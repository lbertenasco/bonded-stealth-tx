import axios from 'axios';
import tenderlyStaticResponse from '../../tenderly_response.json';
import { run, ethers } from 'hardhat';
import StealthVault from '../../artifacts/contracts/StealthVault.sol/StealthVault.json';
import { Transaction } from '@ethersproject/transactions';
import { BigNumber } from '@ethersproject/bignumber';

const stealthVaultAddress = '0x4F15455166895e7B0D98715C1e540BbA2718A526';
// const stealthRelayerAddress = '0xD6C31564ffe01722991Ced16fC4AFC00F70B6C44';
// const stealthERC20Address = '0xEBDe6d5e761792a817177A2ED4A6225693a06D70';

const stealthVault = new ethers.utils.Interface(StealthVault.abi);

axios.defaults.headers.post['X-Access-Key'] = process.env.TENDERLY_ACCESS_TOKEN;

async function main() {
  console.log('Starting ...');
  // checkTx({
  //   data: '0xb778f5e7000000000000000000000000ebde6d5e761792a817177a2ed4a6225693a06d70000000000000000000000000000000000000000000000000000000000000006068617368000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044d6431e74000000000000000000000000e448d3c8d814fa8ca047c9cdc33efc513f8fc5c70000000000000000000000000000000000000000000000241a9b4f617a28000000000000000000000000000000000000000000000000000000000000',
  //   to: '0xD6C31564ffe01722991Ced16fC4AFC00F70B6C44',
  //   from: '0xE448D3C8d814fA8Ca047C9cDC33efC513f8FC5c7',
  //   gasLimit: BigNumber.from(1000000),
  //   gasPrice: BigNumber.from(0),
  //   value: BigNumber.from(0),
  //   nonce: 0,
  //   chainId: 42
  // });
  return new Promise(async () => {
    ethers.provider.on('pending', (tx: Transaction) => {
      console.log('new tx');
      checkTx(tx);
    });
  });
}

async function checkTx(tx: Transaction) {
  const POST_DATA = {
    network_id: '42',
    from: tx.from!,
    to: tx.to!,
    input: tx.data,
    gas: tx.gasLimit.toNumber(),
    gas_price: tx.gasPrice.toString(),
    value: tx.value.toString(),
    save: true,
    save_if_fails: true,
    simulation_type: 'quick',
  };
  const tenderlyResponse = await axios.post(
    `https://api.tenderly.co/api/v1/account/yearn/project/${process.env.TENDERLY_PROJECT}/simulate`,
    POST_DATA
  );
  if (!tenderlyResponse.data.transaction.status) return; // transaction reverts
  const { calls } = tenderlyResponse.data.transaction.transaction_info.call_trace;
  if (!calls) return; // contract creation
  const isValidating = isValidatingHash(calls);
  if (!isValidating.validating) return;
  const logs = tenderlyResponse.data.transaction.transaction_info.logs;
  if (logs[isValidating.index!].raw.address.toLowerCase() === stealthVaultAddress.toLowerCase()) {
    const parsedLogs = stealthVault.parseLog(logs[isValidating.index!].raw);
    if (parsedLogs.name === 'ValidatedHash') {
      await reportHash(parsedLogs.args._hash);
    }
  }
}

function isValidatingHash(calls: any[]): { validating: boolean; index?: number } {
  for (let i = 0; i < calls.length; i++) {
    if (calls[i].to.toLowerCase() === stealthVaultAddress.toLowerCase().toLowerCase()) {
      if (!validJob(calls[i].from)) return { validating: false };
      return {
        validating: true,
        index: i,
      };
    }
  }
  return {
    validating: false,
  };
}

async function reportHash(hash: string): Promise<void> {
  console.log('reporting hash', hash);
}

function validJob(job: string): boolean {
  // check
  return true;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
