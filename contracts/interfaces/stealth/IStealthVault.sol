// SPDX-License-Identifier: MIT
pragma solidity >=0.6.8;

interface IStealthVault {
    function isStealthVault() external pure returns (bool);

    //events
    event Bonded(address _keeper, uint256 _amount, uint256 _finalBond);
    event Unbonded(address _keeper, uint256 _amount, uint256 _finalBond);
    event ReportedHash(bytes32 _hash, address _reportedBy);
    event BondTaken(bytes32 _hash, address _keeper, uint256 _penalty, address _reportedBy);
    event ValidatedHash(bytes32 _hash, address _keeper, uint256 _penalty);

    // getters
    function keepers() external view returns (address[] memory _keepers);
    function keeperJobs(address _keeper) external view returns (address[] memory _jobs);

    // global bond
    function totalBonded() external view returns (uint256 _totalBonded);
    function bonded(address _keeper) external view returns (uint256 _bond);
    function keeperLastBondAt(address _keeper) external view returns (uint256 _lastBondAt);

    // global keeper
    function keeper(address _keeper) external view returns (bool _enabled);
    function keeperStealthJob(address _keeper, address _job) external view returns (bool _enabled);

    // global hash
    function hashReportedBy(bytes32 _hash) external view returns (address _reportedBy);

    // governor
    function transferGovernorBond(address _keeper, uint256 _amount) external /*onlyGovernor*/;

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
