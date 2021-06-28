// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import '../StealthVault.sol';

contract StealthVaultEOAMock is StealthVault {
  // Hash
  function validateHash(
    address _caller,
    bytes32 _hash,
    uint256 _penalty
  ) external override onlyEOA() nonReentrant() returns (bool _valid) {
    _caller;
    _hash;
    _penalty;
    return true;
  }
}
