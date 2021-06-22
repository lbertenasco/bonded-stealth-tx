// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IStealthVault {
  //events
  event Bonded(address indexed _caller, uint256 _amount, uint256 _finalBond);
  event Unbonded(address indexed _caller, uint256 _amount, uint256 _finalBond);
  event ReportedHash(bytes32 _hash, address _reportedBy);
  event PenaltyApplied(bytes32 _hash, address _caller, uint256 _penalty, address _reportedBy);
  event ValidatedHash(bytes32 _hash, address _caller, uint256 _penalty);

  event StealthJobEnabled(address indexed _caller, address _job);

  event StealthJobsEnabled(address indexed _caller, address[] _jobs);

  event StealthJobDisabled(address indexed _caller, address _job);

  event StealthJobsDisabled(address indexed _caller, address[] _jobs);

  function isStealthVault() external pure returns (bool);

  // getters
  function callers() external view returns (address[] memory _callers);

  function callerJobs(address _caller) external view returns (address[] memory _jobs);

  // global bond
  function totalBonded() external view returns (uint256 _totalBonded);

  function bonded(address _caller) external view returns (uint256 _bond);

  function callerLastBondAt(address _caller) external view returns (uint32 _lastBondAt);

  // global caller
  function caller(address _caller) external view returns (bool _enabled);

  function callerStealthJob(address _caller, address _job) external view returns (bool _enabled);

  // global hash
  function hashReportedBy(bytes32 _hash) external view returns (address _reportedBy);

  // governor
  function transferGovernorBond(
    address _caller,
    uint256 _amount /*onlyGovernor*/
  ) external;

  // caller
  function bond() external payable;

  function unbondAll() external;

  function unbond(uint256 _amount) external;

  function enableStealthJob(address _job) external;

  function enableStealthJobs(address[] calldata _jobs) external;

  function disableStealthJob(address _job) external;

  function disableStealthJobs(address[] calldata _jobs) external;

  // job
  function validateHash(
    address _caller,
    bytes32 _hash,
    uint256 _penalty
  ) external returns (bool);

  // watcher
  function reportHash(bytes32 _hash) external;

  function reportHashAndPay(bytes32 _hash) external payable;
}
