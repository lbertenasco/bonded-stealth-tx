// SPDX-License-Identifier: MIT
pragma solidity >=0.6.8;

interface IStealthVault {
    function isStealthVault() external pure returns (bool);

    //events
    event Bonded(address _keeper, uint256 _amount, uint256 _finalBond);
    event Unbonded(address _keeper, uint256 _amount, uint256 _finalBond);
    event ReportedHash(bytes32 _hash, address _reportedBy);
    event BondTaken(address _keeper, uint256 _penalty, uint256 _finalBond, address _reportedBy);

    // global
    function totalBonded() external view returns (uint256 _totalBonded);
    function penaltyReviewPeriod() external view returns (uint256 _penaltyReviewPeriod);
    function hashReportedBy(bytes32 _hash) external view returns (address _reportedBy);
    function keeperStealthJob(address _keeper, address _job) external view returns (bool _enabled);
    function bonded(address _keeper) external view returns (uint256 _bond);

    // keeper
    function bond() external payable;
    function unbondAll() external;
    function unbond(uint256 _amount) external; 
    function enableStealthJob(address _job) external;
    function enableStealthJobs(address[] calldata _jobs) external;
    function disableStealthJob(address _job) external;
    function disableStealthJobs(address[] calldata _jobs) external;

    // job
    function validateHash(address _keeper, bytes32 _hash, uint256 _penalty) external returns (bool);

    // watcher
    function reportHash(bytes32 _hash) external;

}
