const MAX_UNRESPONSIVE_TIME = 5000;
let aliveInterval: NodeJS.Timeout;

export const startCheck = (): void => {
  aliveInterval = setTimeout(dead, MAX_UNRESPONSIVE_TIME);
};

export const stillAlive = (): void => {
  clearTimeout(aliveInterval);
  startCheck();
};

const dead = (): void => {
  console.error('Aliveness check failed');
  process.exit(1);
};
