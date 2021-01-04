// SPDX-License-Identifier: MIT
pragma solidity >=0.6.8;

interface IStealthVault {
    function isStealthVault() external pure returns (bool);

    //events
    event Bonded(address _keeper, uint256 _amount, uint256 _finalBond);
    event Unbonded(address _keeper, uint256 _amount, uint256 _finalBond);
    event ReportedHash(bytes32 _hash, address _reportedBy);
    event BondTaken(address _keeper, uint256 _penalty, uint256 _finalBond, address _reportedBy);

    // keeper
    function totalBonded() external view returns (uint256 _totalBonded);
    function bonded(address _user) external view returns (uint256 _bond);
    function hashReportedBy(bytes32 _hash) external view returns (address _reportedBy);
    function bond() external payable;
    function unbondAll() external;
    function unbond(uint256 _amount) external; 

    // job
    function validateHash(address _keeper, bytes32 _hash, uint256 _penalty) external returns (bool);

    // watcher
    function reportHash(bytes32 _hash) external;

}
