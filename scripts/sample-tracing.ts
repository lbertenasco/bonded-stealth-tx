import { utils } from 'ethers';
import { ethers, network } from 'hardhat';
import moment from 'moment';
import axios from 'axios';
import Web3 from 'web3';

async function execute() {
  const [deployer] = await ethers.getSigners();
  const web3 = new Web3('ws://127.0.0.1:8546');
  return new Promise((resolve, reject) => {
    web3.eth.subscribe('pendingTransactions', async (error: Error, transactionHash: string) => {
      console.log(transactionHash);
      const tx = await web3.eth.getTransaction(transactionHash);
      console.log(tx);
      try {
        // const traced = await network.provider.request({
        //   method: 'debug_traceTransaction',
        //   params: [transactionHash, 'latest'],
        // });
        const traced = await network.provider.request({
          method: 'debug_traceCall',
          params: [
            {
              from: tx.from,
              to: tx.to,
              gas: tx.gas,
              data: tx.input,
            },
            'latest',
          ],
        });
        console.log(traced);
      } catch (err) {
        reject(err);
      }
    });
  });

  // ethers.provider.on('block', (stuff: any) => {
  //   console.log(stuff);
  // });
  // ethers.provider.on('eth_pendingTransactions', (stuff: any) => {
  //   console.log(stuff);
  // });
}

execute()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
