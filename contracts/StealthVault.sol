// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import '@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol';
import '@lbertenasco/contract-utils/contracts/utils/Governable.sol';
import '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';

import './interfaces/IStealthVault.sol';

/*
 * StealthVault
 */
contract StealthVault is Governable, CollectableDust, ReentrancyGuard, IStealthVault {
  using EnumerableSet for EnumerableSet.AddressSet;

  uint256 public override totalBonded;
  mapping(address => uint256) public override bonded;
  mapping(address => uint256) public override canUnbondAt;

  mapping(address => EnumerableSet.AddressSet) internal _callerStealthContracts;
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

  function callerContracts(address _caller) external view override returns (address[] memory _callerContractsList) {
    _callerContractsList = new address[](_callerStealthContracts[_caller].length());
    for (uint256 i; i < _callerStealthContracts[_caller].length(); i++) {
      _callerContractsList[i] = _callerStealthContracts[_caller].at(i);
    }
  }

  function caller(address _caller) external view override returns (bool _enabled) {
    return _callers.contains(_caller);
  }

  function callerStealthContract(address _caller, address _contract) external view override returns (bool _enabled) {
    return _callerStealthContracts[_caller].contains(_contract);
  }

  function bond() external payable override nonReentrant() {
    require(msg.value > 0, 'SV: bond more than zero');
    bonded[msg.sender] = bonded[msg.sender] + msg.value;
    totalBonded = totalBonded + msg.value;
    emit Bonded(msg.sender, msg.value, bonded[msg.sender]);
  }

  function unbondAll() external override {
    unbond(bonded[msg.sender]);
  }

  function startUnbond() public override nonReentrant() {
    canUnbondAt[msg.sender] = block.timestamp + 4 days;
  }

  function cancelUnbond() public override nonReentrant() {
    canUnbondAt[msg.sender] = 0;
  }

  function unbond(uint256 _amount) public override nonReentrant() {
    require(_amount > 0, 'SV: more than zero');
    require(_amount <= bonded[msg.sender], 'SV: amount too high');
    require(canUnbondAt[msg.sender] > 0, 'SV: not unbondind');
    require(block.timestamp > canUnbondAt[msg.sender], 'SV: unbond in cooldown');

    bonded[msg.sender] = bonded[msg.sender] - _amount;
    totalBonded = totalBonded - _amount;
    canUnbondAt[msg.sender] = 0;

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
    // Caller is required to be an EOA to avoid on-chain hash generation to bypass penalty.
    // solhint-disable-next-line avoid-tx-origin
    require(_caller == tx.origin, 'SV: not eoa');
    require(_callerStealthContracts[_caller].contains(msg.sender), 'SV: contract not enabled');
    require(bonded[_caller] >= _penalty, 'SV: not enough bonded');
    require(canUnbondAt[_caller] == 0, 'SV: unbonding');

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
    _reportHash(_hash);
  }

  function reportHashAndPay(bytes32 _hash) external payable override nonReentrant() {
    _reportHash(_hash);
    block.coinbase.transfer(msg.value);
  }

  function _reportHash(bytes32 _hash) internal {
    require(hashReportedBy[_hash] == address(0), 'SV: hash already reported');
    hashReportedBy[_hash] = msg.sender;
    emit ReportedHash(_hash, msg.sender);
  }

  // Caller Contracts
  function enableStealthContract(address _contract) external override nonReentrant() {
    _addCallerContract(_contract);
    emit StealthJobEnabled(msg.sender, _contract);
  }

  function enableStealthContracts(address[] calldata _contracts) external override nonReentrant() {
    for (uint256 i = 0; i < _contracts.length; i++) {
      _addCallerContract(_contracts[i]);
    }
    emit StealthJobsEnabled(msg.sender, _contracts);
  }

  function disableStealthContract(address _contract) external override nonReentrant() {
    _removeCallerContract(_contract);
    emit StealthJobDisabled(msg.sender, _contract);
  }

  function disableStealthContracts(address[] calldata _contracts) external override nonReentrant() {
    for (uint256 i = 0; i < _contracts.length; i++) {
      _removeCallerContract(_contracts[i]);
    }
    emit StealthJobsDisabled(msg.sender, _contracts);
  }

  function _addCallerContract(address _contract) internal {
    if (!_callers.contains(msg.sender)) _callers.add(msg.sender);
    require(_callerStealthContracts[msg.sender].add(_contract), 'SV: contract already added');
  }

  function _removeCallerContract(address _contract) internal {
    require(_callerStealthContracts[msg.sender].remove(_contract), 'SV: contract not found');
    if (_callerStealthContracts[msg.sender].length() == 0) _callers.remove(msg.sender);
  }

  // Governable: restricted-access
  function transferGovernorBond(address _caller, uint256 _amount) external override onlyGovernor {
    bonded[governor] = bonded[governor] - _amount;
    bonded[_caller] = bonded[_caller] + _amount;
  }

  function transferBondToGovernor(address _caller, uint256 _amount) external override onlyGovernor {
    bonded[_caller] = bonded[_caller] - _amount;
    bonded[governor] = bonded[governor] + _amount;
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
