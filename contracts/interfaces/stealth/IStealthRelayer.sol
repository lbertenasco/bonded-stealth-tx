// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IStealthRelayer {
    function execute(
        address _address,
        bytes memory _callData,
        bytes32 _stealthHash,
        uint256 _blockNumber
    ) external payable returns (bytes memory _returnData);
}
