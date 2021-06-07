// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IStealthRelayer {
  function forceBlockProtection() external view returns (bool _forceBlockProtection);

  function setForceBlockProtection(bool _forceBlockProtection) external;

  function addJobs(address[] calldata _jobsList) external;

  function addJob(address _job) external;

  function removeJobs(address[] calldata _jobsList) external;

  function removeJob(address _job) external;

  function execute(
    address _address,
    bytes memory _callData,
    bytes32 _stealthHash,
    uint256 _blockNumber
  ) external payable returns (bytes memory _returnData);

  function executeWithoutBlockProtection(
    address _address,
    bytes memory _callData,
    bytes32 _stealthHash
  ) external payable returns (bytes memory _returnData);
}
