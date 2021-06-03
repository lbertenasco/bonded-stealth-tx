// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@lbertenasco/contract-utils/contracts/abstract/UtilsReady.sol';

import '../interfaces/stealth/IStealthVault.sol';

/*
 * StealthVault
 */
contract StealthVault is UtilsReady, ReentrancyGuard, IStealthVault {
  using EnumerableSet for EnumerableSet.AddressSet;

  // report
  mapping(bytes32 => address) public override hashReportedBy;

  EnumerableSet.AddressSet internal _callers;

  function caller(address _caller) external view override returns (bool _enabled) {
    return _callers.contains(_caller);
  }

  mapping(address => EnumerableSet.AddressSet) internal _callerStealthJobs;

  function callerStealthJob(address _caller, address _job) external view override returns (bool _enabled) {
    return _callerStealthJobs[_caller].contains(_job);
  }

  uint256 public override totalBonded;
  mapping(address => uint256) public override bonded;
  mapping(address => uint256) public override callerLastBondAt;

  constructor() UtilsReady() {}

  function isStealthVault() external pure override returns (bool) {
    return true;
  }

  // Governor
  function transferGovernorBond(address _caller, uint256 _amount) external override onlyGovernor {
    bonded[governor] = bonded[governor] - _amount;
    bonded[_caller] = bonded[_caller] + _amount;
  }

  // getters
  function callers() external view override returns (address[] memory _callersList) {
    _callersList = new address[](_callers.length());
    for (uint256 i; i < _callers.length(); i++) {
      _callersList[i] = _callers.at(i);
    }
  }

  function callerJobs(address _caller) external view override returns (address[] memory _callerJobsList) {
    _callerJobsList = new address[](_callerStealthJobs[_caller].length());
    for (uint256 i; i < _callerStealthJobs[_caller].length(); i++) {
      _callerJobsList[i] = _callerStealthJobs[_caller].at(i);
    }
  }

  // Bonds
  function bond() external payable override nonReentrant() {
    _addBond(msg.sender, msg.value);
    callerLastBondAt[msg.sender] = block.timestamp;
  }

  function _addBond(address _caller, uint256 _amount) internal {
    require(_amount > 0, 'StealthVault::addBond:amount-should-be-greater-than-zero');
    bonded[_caller] = bonded[_caller] + _amount;
    totalBonded = totalBonded + _amount;
    emit Bonded(_caller, _amount, bonded[_caller]);
  }

  function unbondAll() external override nonReentrant() {
    _unbond(bonded[msg.sender]);
  }

  function unbond(uint256 _amount) public override nonReentrant() {
    _unbond(_amount);
  }

  function _unbond(uint256 _amount) internal {
    require(_amount > 0, 'StealthVault::unbond:amount-should-be-greater-than-zero');
    require(block.timestamp > callerLastBondAt[msg.sender] + 4 days, 'StealthVault::unbond:wait-4-days-after-bond');

    bonded[msg.sender] = bonded[msg.sender] - _amount;
    totalBonded = totalBonded - _amount;

    payable(msg.sender).transfer(_amount);
    emit Unbonded(msg.sender, _amount, bonded[msg.sender]);
  }

  function _takeBond(
    address _caller,
    uint256 _amount,
    address _reportedBy
  ) internal {
    bonded[_caller] = bonded[_caller] - _amount;
    uint256 _amountReward = _amount / 10;
    bonded[_reportedBy] = bonded[_reportedBy] + _amountReward;
    bonded[governor] = (bonded[governor] + _amount) - _amountReward;
  }

  // Hash
  function validateHash(
    address _caller,
    bytes32 _hash,
    uint256 _penalty
  ) external override nonReentrant() returns (bool) {
    // caller is required to be an EOA to avoid on-chain hash generation to bypass penalty
    require(_caller == tx.origin, 'StealthVault::validateHash:caller-should-be-EOA');
    require(_callerStealthJobs[_caller].contains(msg.sender), 'StealthVault::validateHash:caller-job-not-enabled');
    require(bonded[_caller] >= _penalty, 'StealthVault::validateHash:bond-less-than-penalty');

    address reportedBy = hashReportedBy[_hash];
    if (reportedBy != address(0)) {
      // User reported this TX as public, locking penalty away
      _takeBond(_caller, _penalty, reportedBy);

      emit BondTaken(_hash, _caller, _penalty, reportedBy);
      // invalid: has was reported
      return false;
    }

    emit ValidatedHash(_hash, _caller, _penalty);
    // valid: has was not reported
    return true;
  }

  function reportHash(bytes32 _hash) external override nonReentrant() {
    require(hashReportedBy[_hash] == address(0), 'StealthVault::reportHash:hash-already-reported');
    hashReportedBy[_hash] = msg.sender;
    emit ReportedHash(_hash, msg.sender);
  }

  // Caller Jobs
  function enableStealthJob(address _job) external override nonReentrant() {
    _addCallerJob(_job);
  }

  function enableStealthJobs(address[] calldata _jobs) external override nonReentrant() {
    for (uint256 i = 0; i < _jobs.length; i++) {
      _addCallerJob(_jobs[i]);
    }
  }

  function disableStealthJob(address _job) external override nonReentrant() {
    _removeCallerJob(_job);
  }

  function disableStealthJobs(address[] calldata _jobs) external override nonReentrant() {
    for (uint256 i = 0; i < _jobs.length; i++) {
      _removeCallerJob(_jobs[i]);
    }
  }

  function _addCallerJob(address _job) internal {
    if (!_callers.contains(msg.sender)) _callers.add(msg.sender);
    require(_callerStealthJobs[msg.sender].add(_job), 'StealthVault::addCallerJob:job-already-added');
  }

  function _removeCallerJob(address _job) internal {
    require(_callerStealthJobs[msg.sender].remove(_job), 'StealthVault::removeCallerJob:job-not-found');
    if (_callerStealthJobs[msg.sender].length() == 0) _callers.remove(msg.sender);
  }
}
