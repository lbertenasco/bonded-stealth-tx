// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IStealthTx {
  event StealthVaultSet(address _stealthVault);
  event PenaltySet(uint256 _penalty);
  event MigratedStealthVault(address _migratedTo);

  function setPenalty(uint256 _penalty) external;
}
