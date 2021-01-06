// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.6.8;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import "@lbertenasco/contract-utils/contracts/utils/Governable.sol";
import "@lbertenasco/contract-utils/contracts/utils/Manageable.sol";
import "@lbertenasco/contract-utils/contracts/utils/StealthTx.sol";

contract StealthERC20 is ERC20, Governable, Manageable, StealthTx {
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _mintAmount,
        address _stealthVault
    ) public ERC20(_name, _symbol) Governable(msg.sender) Manageable(msg.sender) StealthTx(_stealthVault) {
        _mint(msg.sender, _mintAmount);
    }

    function stealthMint(address _to, uint256 _amount, bytes23 _hash) public validateStealthTx(_hash) returns (bool) {
        _mint(_to, _amount);
    }

    // StealthTx: restricted-access
    function setPenalty(uint256 _penalty) external override onlyGovernor {
        _setPenalty(_penalty);
    }

    function migrateStealthVault() external override onlyManager {
        _migrateStealthVault();
    }

    // Governable: restricted-access
    function setPendingGovernor(address _pendingGovernor) external override onlyGovernor {
        _setPendingGovernor(_pendingGovernor);
    }

    function acceptGovernor() external override onlyPendingGovernor {
        _acceptGovernor();
    }

    // Manageable: restricted-access
    function setPendingManager(address _pendingManager) external override onlyManager {
        _setPendingManager(_pendingManager);
    }

    function acceptManager() external override onlyPendingManager {
        _acceptManager();
    }
}
