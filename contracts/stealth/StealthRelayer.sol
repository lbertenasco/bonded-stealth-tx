// SPDX-License-Identifier: MIT

pragma solidity >=0.6.8;

import "@openzeppelin/contracts/utils/Address.sol";
import "@lbertenasco/contract-utils/contracts/utils/Governable.sol";
import "@lbertenasco/contract-utils/contracts/utils/StealthTx.sol";

import '../interfaces/stealth/IStealthRelayer.sol';

/*
 * StealthRelayer
 */
contract StealthRelayer is Governable, StealthTx, IStealthRelayer {
    using Address for address;

    constructor(address _stealthVault) public Governable(msg.sender) StealthTx(_stealthVault) {}

    function execute(
        address _address,
        bytes memory _callData,
        bytes32 _stealthHash,
        uint256 _blockNumber
    ) external payable validateStealthTxAndBlock(_stealthHash, _blockNumber) returns (bytes memory) {
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
}
