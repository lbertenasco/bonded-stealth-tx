// SPDX-License-Identifier: MIT

pragma solidity >=0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@lbertenasco/contract-utils/contracts/utils/UtilsReady.sol";

import '../../interfaces/stealth/IStealthVault.sol';

/*
 * StealthVault
 */
contract StealthVault is UtilsReady, IStealthVault {
    using SafeMath for uint256;

    mapping(bytes32 => address) public override hashReportedBy;

    mapping(address => mapping(address => bool)) internal _keeperStealthJobs;
    function keeperStealthJobs(address _keeper, address _job) external view override returns (bool _enabled) {
        return _keeperStealthJobs[_keeper][_job];
    }


    uint256 public override totalBonded;
    mapping(address => uint256) public override bonded;

    // TODO Add penalty lock for 1 week to make sure it was not an uncle block. (find a way to make this not a stress on governor)

    constructor() public UtilsReady() {
    }

    function isStealthVault() external pure override returns (bool) {
        return true;
    }

    function bond() external payable override {
        require(msg.value > 0, 'StealthVault::bond:msg-value-should-be-greater-than-zero');
        bonded[msg.sender] = bonded[msg.sender].add(msg.value);
        totalBonded = totalBonded.add(msg.value);
        emit Bonded(msg.sender, msg.value, bonded[msg.sender]);
    }

    function unbondAll() external override {
        unbond(bonded[msg.sender]);
    }

    function unbond(uint256 _amount) public override { 
        require(_amount > 0, 'StealthVault::unbond:amount-should-be-greater-than-zero');

        _burnBond(msg.sender, _amount);

        payable(msg.sender).transfer(_amount);
        emit Unbonded(msg.sender, _amount, bonded[msg.sender]);
    }

    function _burnBond(address _user, uint256 _amount) internal {
        bonded[_user] = bonded[_user].sub(_amount);
        totalBonded = totalBonded.sub(_amount);
    }

    function validateHash(address _keeper, bytes32 _hash, uint256 _penalty) external override returns (bool) {
        // keeper is required to be an EOA to avoid onc-hain hash generation to bypass penalty
        // TODO Check how to prevent contract to forward txs from keep3rs to steal the bond
        require(_keeper == tx.origin, 'StealthVault::validateHash:keeper-should-be-EOA');

        address reportedBy = hashReportedBy[_hash];
        if (reportedBy != address(0)) {
            // User reported this TX as public, taking penalty away
            _burnBond(_keeper, _penalty);

            delete hashReportedBy[_hash];
            payable(reportedBy).transfer(_penalty);

            emit BondTaken(_keeper, _penalty, bonded[_keeper], reportedBy);

            // invalid: has was reported
            return false;
        }

        // valid: has was not reported
        return true;
    }

    function reportHash(bytes32 _hash) external override {
        require(hashReportedBy[_hash] == address(0), 'StealthVault::reportHash:hash-already-reported');
        hashReportedBy[_hash] = msg.sender;
        emit ReportedHash(_hash, msg.sender);
    }

    function enableStealthJob(address _job) external override {
        _setKeeperJob(_job, true);
    }
    function enableStealthJobs(address[] calldata _jobs) external override {
        for (uint i = 0; i < _jobs.length; i++) {
            _setKeeperJob(_jobs[i], true);
        }
    }
    function disableStealthJob(address _job) external override {
        _setKeeperJob(_job, false);
    }
    function disableStealthJobs(address[] calldata _jobs) external override {
        for (uint i = 0; i < _jobs.length; i++) {
            _setKeeperJob(_jobs[i], false);
        }
    }
    function _setKeeperJob(address _job, bool _enabled) internal {
        _keeperStealthJobs[msg.sender][_job] = _enabled;
    }
}
