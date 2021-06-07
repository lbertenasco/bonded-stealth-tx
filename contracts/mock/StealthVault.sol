// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.4;

import '../StealthVault.sol';

contract StealthVaultMock is StealthVault {
  using EnumerableSet for EnumerableSet.AddressSet;

  function setBonded(address _user, uint256 _bond) external {
    bonded[_user] = _bond;
  }

  function setTotalBonded(uint256 _bond) external {
    totalBonded = _bond;
  }

  function setCallerLastBondAt(address _user, uint32 _lastBond) external {
    callerLastBondAt[_user] = _lastBond;
  }

  function addCallerStealthJob(address _caller, address _job) external {
    _callerStealthJobs[_caller].add(_job);
  }

  function setHashReportedBy(bytes32 _hash, address _reportedBy) external {
    hashReportedBy[_hash] = _reportedBy;
  }

  function addCaller(address _caller) external {
    _callers.add(_caller);
  }
  
  function addCallerJob(address _caller, address _job) external {
    _callerStealthJobs[_caller].add(_job);
  }

  function penalize(
    address _caller,
    uint256 _penalty,
    address _reportedBy
  ) external {
    _penalize(_caller, _penalty, _reportedBy);
  } 
}

contract JobMock {
  address public stealthVault;
  constructor(address _stealthVault) {
    stealthVault = _stealthVault;
  }

  function validateHash(
    bytes32 _hash,
    uint256 _penalty
  ) external returns (bool) {
    return StealthVault(stealthVault).validateHash(msg.sender, _hash, _penalty);
  }
}