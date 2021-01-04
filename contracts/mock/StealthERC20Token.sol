// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.6.8;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@lbertenasco/contract-utils/contracts/utils/Governable.sol";
import "@lbertenasco/contract-utils/contracts/utils/StealthTx.sol";

contract ERC20Token is ERC20, Governable, StealthTx {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _mintAmount
    ) public ERC20(_name, _symbol) Governable(msg.sender) {
        _mint(msg.sender, _mintAmount);
    }

    function stealthMint(address _to, uint256 _amount, bytes23 _hash) public validateStealthTx(_hash) returns (bool) {
        _mint(_to, _amount);
    }

    // StealthTx
    function setPenalty(uint256 _penalty) external override onlyGovernor {
        _setPenalty(_penalty);
    }

    function migrateStealthVault() external override onlyManager {
        _migrateStealthVault();
    }

    // Governable
    function setPendingGovernor(address _pendingGovernor) external override onlyGovernor {
        _setPendingGovernor(_pendingGovernor);
    }

    function acceptGovernor() external override onlyPendingGovernor {
        _acceptGovernor();
    }
}
