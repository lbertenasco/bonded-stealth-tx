// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import "@openzeppelin/contracts/utils/Address.sol";
import "@lbertenasco/contract-utils/contracts/utils/Governable.sol";
import "@lbertenasco/contract-utils/contracts/utils/CollectableDust.sol";
import "@lbertenasco/contract-utils/contracts/utils/StealthTx.sol";

import '../interfaces/stealth/IStealthRelayer.sol';

/*
 * StealthRelayer
 */
contract StealthRelayer is Governable, CollectableDust, StealthTx, IStealthRelayer {
    using Address for address;

    constructor(address _stealthVault) Governable(msg.sender) StealthTx(_stealthVault) {}

    function execute(
        address _address,
        bytes memory _callData,
        bytes32 _stealthHash,
        uint256 _blockNumber
    ) external payable override validateStealthTxAndBlock(_stealthHash, _blockNumber) returns (bytes memory _returnData) {
        return _address.functionCallWithValue(_callData, msg.value, "StealthRelayer::execute:call-reverted");
    }

    // StealthTx: restricted-access
    function setPenalty(uint256 _penalty) external override onlyGovernor {
        _setPenalty(_penalty);
    }

    function migrateStealthVault() external override onlyGovernor {
        _migrateStealthVault();
    }

    // Governable: restricted-access
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
    ) external override virtual onlyGovernor {
        _sendDust(_to, _token, _amount);
    }
}
