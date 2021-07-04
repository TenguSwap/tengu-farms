// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libs/IBEP20.sol";
import "./libs/SafeBEP20.sol";
import "./libs/ITenguReferral.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TenguReferral is ITenguReferral, Ownable {
    using SafeBEP20 for IBEP20;

    address public operator;
    mapping(address => address) public referrers; // user address => referrer address
    mapping(address => uint256) public referralsCount; // referrer address => referrals count
    mapping(address => uint256) public totalReferralCommissions; // referrer address => total referral commissions

    event ReferralRecorded(address indexed user, address indexed referrer);
    event ReferralCommissionRecorded(address indexed referrer, uint256 commission);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);

    constructor() public {
        operator = msg.sender;
    }

    modifier onlyOperator {
        require(operator == msg.sender, "Operator: caller is not the operator");
        _;
    }

    function recordReferral(address _user, address _referrer) public override onlyOwner {
        if (_user != address(0)
            && _referrer != address(0)
            && _user != _referrer
            && referrers[_user] == address(0)
        ) {
            referrers[_user] = _referrer;
            referralsCount[_referrer] += 1;
            emit ReferralRecorded(_user, _referrer);
        }
    }

    function recordReferralCommission(address _referrer, uint256 _commission) public override onlyOwner {
        if (_referrer != address(0) && _commission > 0) {
            totalReferralCommissions[_referrer] += _commission;
            emit ReferralCommissionRecorded(_referrer, _commission);
        }
    }

    // Get the referrer address that referred the user
    function getReferrer(address _user) public override view returns (address) {
        return referrers[_user];
    }

    // Update the status of the operator
    function updateOperator(address _operator) external onlyOperator {
        require(_operator != address(0), "TENGU::updateOperator: operator address must be set");

        address previousOperator = operator;
        operator = _operator;
        emit OperatorUpdated(previousOperator, operator);
    }

    // Owner can drain tokens that are sent here by mistake
    function drainBEP20Token(IBEP20 _token, uint256 _amount, address _to) external onlyOperator {
        _token.safeTransfer(_to, _amount);
    }
}
