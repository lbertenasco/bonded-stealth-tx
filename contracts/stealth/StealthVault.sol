// SPDX-License-Identifier: MIT

pragma solidity >=0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";
import "@lbertenasco/contract-utils/contracts/abstract/UtilsReady.sol";

import '../interfaces/stealth/IStealthVault.sol';

/*
 * StealthVault
 */
contract StealthVault is UtilsReady, IStealthVault {
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    // report
    mapping(bytes32 => address) public override hashReportedBy;

    EnumerableSet.AddressSet internal _keepers;
    function keeper(address _keeper) external view override returns (bool _enabled) {
        return _keepers.contains(_keeper);
    }
    mapping(address => EnumerableSet.AddressSet) internal _keeperStealthJobs;
    function keeperStealthJob(address _keeper, address _job) external view override returns (bool _enabled) {
        return _keeperStealthJobs[_keeper].contains(_job);
    }

    uint256 public override totalBonded;
    mapping(address => uint256) public override bonded;
    mapping(address => uint256) public override keeperLastBondAt;

    constructor() public UtilsReady() {
    }

    function isStealthVault() external pure override returns (bool) {
        return true;
    }

    // Governor
    function transferGovernorBond(address _keeper, uint256 _amount) external override onlyGovernor {
        bonded[governor] = bonded[governor].sub(_amount);
        bonded[_keeper] = bonded[_keeper].add(_amount);
    }

    // getters
    function keepers() external view override returns (address[] memory _keepersList) {
        _keepersList = new address[](_keepers.length());
        for (uint256 i; i < _keepers.length(); i++) {
            _keepersList[i] = _keepers.at(i);
        }
    }
    function keeperJobs(address _keeper) external view override returns (address[] memory _keeperJobsList) {
        _keeperJobsList = new address[](_keeperStealthJobs[_keeper].length());
        for (uint256 i; i < _keeperStealthJobs[_keeper].length(); i++) {
            _keeperJobsList[i] = _keeperStealthJobs[_keeper].at(i);
        }
    }

    // Bonds
    function bond() external payable override {
        _addBond(msg.sender, msg.value);
        keeperLastBondAt[msg.sender] = block.timestamp;
    }
    function _addBond(address _keeper, uint256 _amount) internal {
        require(_amount > 0, 'StealthVault::addBond:amount-should-be-greater-than-zero');
        bonded[_keeper] = bonded[_keeper].add(_amount);
        totalBonded = totalBonded.add(_amount);
        emit Bonded(_keeper, _amount, bonded[_keeper]);
    }

    function unbondAll() external override {
        unbond(bonded[msg.sender]);
    }

    function unbond(uint256 _amount) public override {
        require(_amount > 0, 'StealthVault::unbond:amount-should-be-greater-than-zero');
        require(block.timestamp > keeperLastBondAt[msg.sender].add(4 days), 'StealthVault::unbond:wait-4-days-after-bond');

        bonded[msg.sender] = bonded[msg.sender].sub(_amount);
        totalBonded = totalBonded.sub(_amount);

        payable(msg.sender).transfer(_amount);
        emit Unbonded(msg.sender, _amount, bonded[msg.sender]);
    }

    function _takeBond(address _keeper, uint256 _amount, address _reportedBy) internal {
        bonded[_keeper] = bonded[_keeper].sub(_amount);
        uint256 _amountReward = _amount.div(10);
        bonded[_reportedBy] = bonded[_reportedBy].add(_amountReward);
        bonded[governor] = bonded[governor].add(_amount.sub(_amountReward));
    }


    // Hash
    function validateHash(address _keeper, bytes32 _hash, uint256 _penalty) external override returns (bool) {
        // keeper is required to be an EOA to avoid on-chain hash generation to bypass penalty
        require(_keeper == tx.origin, 'StealthVault::validateHash:keeper-should-be-EOA');
        require(_keeperStealthJobs[_keeper].contains(msg.sender), 'StealthVault::validateHash:keeper-job-not-enabled');
        require(bonded[_keeper] >= _penalty, 'StealthVault::validateHash:bond-less-than-penalty');

        address reportedBy = hashReportedBy[_hash];
        if (reportedBy != address(0)) {
            // User reported this TX as public, locking penalty away
            _takeBond(_keeper, _penalty, reportedBy);

            emit BondTaken(_hash, _keeper, _penalty, reportedBy);
            // invalid: has was reported
            return false;
        }

        emit ValidatedHash(_hash, _keeper, _penalty);
        // valid: has was not reported
        return true;
    }

    function reportHash(bytes32 _hash) external override {
        require(hashReportedBy[_hash] == address(0), 'StealthVault::reportHash:hash-already-reported');
        hashReportedBy[_hash] = msg.sender;
        emit ReportedHash(_hash, msg.sender);
    }


    // Keeper Jobs
    function enableStealthJob(address _job) external override {
        _addKeeperJob(_job);
    }
    function enableStealthJobs(address[] calldata _jobs) external override {
        for (uint i = 0; i < _jobs.length; i++) {
            _addKeeperJob(_jobs[i]);
        }
    }
    function disableStealthJob(address _job) external override {
        _removeKeeperJob(_job);
    }
    function disableStealthJobs(address[] calldata _jobs) external override {
        for (uint i = 0; i < _jobs.length; i++) {
            _removeKeeperJob(_jobs[i]);
        }
    }
    function _addKeeperJob(address _job) internal {
        if (!_keepers.contains(msg.sender)) _keepers.add(msg.sender);
        require(_keeperStealthJobs[msg.sender].add(_job), "StealthVault::addKeeperJob:job-already-added");
    }
    function _removeKeeperJob(address _job) internal {
        require(_keeperStealthJobs[msg.sender].remove(_job), "StealthVault::removeKeeperJob:job-not-found");
        if (_keeperStealthJobs[msg.sender].length() == 0) _keepers.remove(msg.sender);
    }
}
