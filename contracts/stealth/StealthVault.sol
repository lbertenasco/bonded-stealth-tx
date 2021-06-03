// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

import '../interfaces/stealth/IStealthVault.sol';

/*
 * StealthVault
 */
contract StealthVault is Governable, CollectableDust, ReentrancyGuard, IStealthVault {
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 public override totalBonded;
  mapping(address => uint256) public override bonded;
  mapping(address => uint32) public override callerLastBondAt;

  mapping(address => EnumerableSet.AddressSet) internal _callerStealthJobs;
  mapping(bytes32 => address) public override hashReportedBy;

  EnumerableSet.AddressSet internal _callers;

  constructor() Governable(msg.sender) {
    _addProtocolToken(ETH_ADDRESS);
  }

  function isStealthVault() external pure override returns (bool) {
    return true;
  }

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

  function caller(address _caller) external view override returns (bool _enabled) {
    return _callers.contains(_caller);
  }

  function callerStealthJob(address _caller, address _job) external view override returns (bool _enabled) {
    return _callerStealthJobs[_caller].contains(_job);
  }

  function bond() external payable override nonReentrant() {
    require(msg.value > 0, 'SV: bond more than zero');
    bonded[msg.sender] = bonded[msg.sender] + msg.value;
    totalBonded = totalBonded + msg.value;
    callerLastBondAt[msg.sender] = uint32(block.timestamp);
    emit Bonded(msg.sender, msg.value, bonded[msg.sender]);
  }

  function unbondAll() external override {
    unbond(bonded[msg.sender]);
  }

  function unbond(uint256 _amount) public override nonReentrant() {
    require(_amount > 0, 'SV: more than zero');
    require(_amount <= bonded[msg.sender], 'SV: amount too high');
    require(uint32(block.timestamp) > callerLastBondAt[msg.sender] + 4 days, 'SV: bond cooldown');

    bonded[msg.sender] = bonded[msg.sender] - _amount;
    totalBonded = totalBonded - _amount;

    payable(msg.sender).transfer(_amount);
    emit Unbonded(msg.sender, _amount, bonded[msg.sender]);
  }

  function _penalize(
    address _caller,
    uint256 _penalty,
    address _reportedBy
  ) internal {
    bonded[_caller] = bonded[_caller] - _penalty;
    uint256 _amountReward = _penalty / 10;
    bonded[_reportedBy] = bonded[_reportedBy] + _amountReward;
    bonded[governor] = bonded[governor] + (_penalty - _amountReward);
  }

  // Hash
  function validateHash(
    address _caller,
    bytes32 _hash,
    uint256 _penalty
  ) external override nonReentrant() returns (bool) {
    // caller is required to be an EOA to avoid on-chain hash generation to bypass penalty
    require(_caller == tx.origin, 'SV: not eoa');
    require(_callerStealthJobs[_caller].contains(msg.sender), 'SV: job not enabled');
    require(bonded[_caller] >= _penalty, 'SV: not enough bonded');

    address reportedBy = hashReportedBy[_hash];
    if (reportedBy != address(0)) {
      // User reported this TX as public, locking penalty away
      _penalize(_caller, _penalty, reportedBy);

      emit PenaltyApplied(_hash, _caller, _penalty, reportedBy);
      // invalid: has was reported
      return false;
    }

    emit ValidatedHash(_hash, _caller, _penalty);
    // valid: has was not reported
    return true;
  }

  function reportHash(bytes32 _hash) external override nonReentrant() {
    require(hashReportedBy[_hash] == address(0), 'SV: hash already reported');
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
    require(_callerStealthJobs[msg.sender].add(_job), 'SV: job already added');
  }

  function _removeCallerJob(address _job) internal {
    require(_callerStealthJobs[msg.sender].remove(_job), 'SV: job not found');
    if (_callerStealthJobs[msg.sender].length() == 0) _callers.remove(msg.sender);
  }

  // Governable: restricted-access
  function transferGovernorBond(address _caller, uint256 _amount) external override onlyGovernor {
    bonded[governor] = bonded[governor] - _amount;
    bonded[_caller] = bonded[_caller] + _amount;
  }

  function setPendingGovernor(address _pendingGovernor) external override onlyGovernor {
    _setPendingGovernor(_pendingGovernor);
  }

  function acceptGovernor() external override onlyPendingGovernor {
    _acceptGovernor();
  }

  // Collectable Dust: restricted-access
  function sendDust(
    address _to,
    address _token,
    uint256 _amount
  ) external override onlyGovernor {
    _sendDust(_to, _token, _amount);
  }
}
