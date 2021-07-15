import { utils } from 'ethers';
import WebSocket from 'ws';

let gasnowWebSocket: WebSocket;
let lastGasPrice: GasPrice;

export type GasPrice = {
  rapid: number;
  fast: number;
  standard: number;
  slow: number;
};

type GasNow = {
  gasPrices: GasPrice;
};

const updatePageGasPriceData = (data: GasNow) => {
  if (data && data.gasPrices) {
    lastGasPrice = data.gasPrices;
    console.log('Updated rapid gas price to', utils.formatUnits(lastGasPrice.rapid, 'gwei'));
  }
};

const onOpen = () => {
  console.log('Gasnow connection open ...');
};

const onMessage = (evt: WebSocket.MessageEvent) => {
  const data = JSON.parse(evt.data as string);
  if (data.type) {
    updatePageGasPriceData(data.data);
  }
};

const onClose = () => {
  console.log('Gasnow connection closed.');
  process.exit(1);
};

export const start = async (): Promise<void> => {
  return new Promise((resolve) => {
    gasnowWebSocket = new WebSocket('wss://www.gasnow.org/ws');
    gasnowWebSocket.onopen = () => {
      console.log('Gasnow connection open ...');
      resolve();
    };
    gasnowWebSocket.onmessage = onMessage;
    gasnowWebSocket.onclose = onClose;
  });
};

export const getGasPrice = (): GasPrice => lastGasPrice;
