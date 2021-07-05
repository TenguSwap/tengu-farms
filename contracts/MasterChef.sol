// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./libs/IBEP20.sol";
import "./libs/SafeBEP20.sol";
import "./libs/ITenguReferral.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "./TenguToken.sol";

// MasterChef is the master of Tengu. He can make Tengu and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once TENGU is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterChef is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;
    using SafeBEP20 for TenguToken;

    // Info of each user.
    struct UserInfo {
        uint256 amount;         // How many LP tokens the user has provided.
        uint256 rewardDebt;     // Reward debt. See explanation below.
        uint256 rewardLockedUp;  // Reward locked up.
        uint256 nextHarvestUntil; // When can the user harvest again.
        //
        // We do some fancy math here. Basically, any point in time, the amount of TENGUs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accTenguPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accTenguPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. TENGUs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that TENGUs distribution occurs.
        uint256 accTenguPerShare;   // Accumulated TENGUs per share, times 1e12. See below.
        uint256 depositFeeBP;      // Deposit fee in basis points
        uint256 harvestInterval;  // Harvest interval in seconds
        uint256 lpSupply;        // To determine more precisely the deposits and avoid the dilution of rewards
    }

    // The TENGU TOKEN!
    TenguToken public tengu;
    // Dev address.
    address public devAddress;
    // Deposit Fee address
    address public feeAddress;
    // TENGU tokens created per block.
    uint256 public tenguPerBlock;
    // Max tokens / block
    uint256 public constant MAX_EMISSION_RATE = 10 ether;
    // Bonus muliplier for early tengu makers.
    uint256 public constant BONUS_MULTIPLIER = 1;
    // Max harvest interval: 14 days.
    uint256 public constant MAXIMUM_HARVEST_INTERVAL = 14 days;


    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when TENGU mining starts.
    uint256 public startBlock;
    // Total locked up rewards
    uint256 public totalLockedUpRewards;

    // Tengu referral contract address.
    ITenguReferral public tenguReferral;
    // Referral commission rate in basis points.
    uint256 public referralCommissionRate = 100;
    // Max referral commission rate: 10%.
    uint256 public constant MAXIMUM_REFERRAL_COMMISSION_RATE = 1000;
    // Max deposit fee: 4%
    uint256 public constant MAXIMUM_DEPOSIT_FEE = 400;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmissionRateUpdated(uint256 previousAmount, uint256 newAmount);
    event ReferralCommissionPaid(address indexed user, address indexed referrer, uint256 commissionAmount);
    event RewardLockedUp(address indexed user, uint256 indexed pid, uint256 amountLockedUp);
    event AddPool(uint256 indexed pid, uint256 allocPoint, address lpTokenAddress, uint256 depositFeeBP, uint256 harvestInterval, uint256 lastRewardBlock);
    event SetPool(uint256 indexed pid, uint256 allocPoint, uint256 depositFeeBP, uint256 harvestInterval);
    event SetDevAddress(address previousDevAddress, address newDevAddress);
    event SetFeeAddress(address previousFeeAddress, address newFeeAddress);
    event SetReferralCommissionRate(uint256 previousReferralCommissionRate, uint256 newReferralCommissionRate);
    event SetTenguReferral(address previousTenguReferral, address newTenguReferral);

    constructor(
        TenguToken _tengu,
        uint256 _startBlock,
        uint256 _tenguPerBlock
    ) public {
        tengu = _tengu;
        startBlock = _startBlock;
        tenguPerBlock = _tenguPerBlock;

        devAddress = msg.sender;
        feeAddress = msg.sender;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IBEP20 _lpToken, uint256 _depositFeeBP, uint256 _harvestInterval, bool _withUpdate) public onlyOwner {
        require(_depositFeeBP <= MAXIMUM_DEPOSIT_FEE, "add: invalid deposit fee basis points");
        require(_harvestInterval <= MAXIMUM_HARVEST_INTERVAL, "add: invalid harvest interval");

        // Test line to ensure the function will fail if the token doesn't exist
        _lpToken.balanceOf(address(this));

        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accTenguPerShare: 0,
            depositFeeBP: _depositFeeBP,
            harvestInterval: _harvestInterval,
            lpSupply: 0
        }));
        uint256 pid = poolInfo.length.sub(1);
        emit AddPool(pid, _allocPoint, address(_lpToken), _depositFeeBP, _harvestInterval, lastRewardBlock);
    }

    // Update the given pool's TENGU allocation point and deposit fee. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, uint256 _depositFeeBP, uint256 _harvestInterval, bool _withUpdate) public onlyOwner {
        require(_depositFeeBP <= MAXIMUM_DEPOSIT_FEE, "set: invalid deposit fee basis points");
        require(_harvestInterval <= MAXIMUM_HARVEST_INTERVAL, "set: invalid harvest interval");

        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].depositFeeBP = _depositFeeBP;
        poolInfo[_pid].harvestInterval = _harvestInterval;
        emit SetPool(_pid, _allocPoint, _depositFeeBP, _harvestInterval);
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to.sub(_from).mul(BONUS_MULTIPLIER);
    }

    // View function to see pending TENGUs on frontend.
    function pendingTengu(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accTenguPerShare = pool.accTenguPerShare;
        if (block.number > pool.lastRewardBlock && pool.lpSupply != 0) {
            uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
            uint256 tenguReward = multiplier.mul(tenguPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
            accTenguPerShare = accTenguPerShare.add(tenguReward.mul(1e12).div(pool.lpSupply));
        }
        uint256 pending = user.amount.mul(accTenguPerShare).div(1e12).sub(user.rewardDebt);
        return pending.add(user.rewardLockedUp);
    }

    // View function to see if user can harvest TENGUs.
    function canHarvest(uint256 _pid, address _user) public view returns (bool) {
        UserInfo storage user = userInfo[_pid][_user];
        return block.timestamp >= user.nextHarvestUntil;
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            _updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function _updatePool(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        if (pool.lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 tenguReward = multiplier.mul(tenguPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        tengu.mint(devAddress, tenguReward.div(10));
        tengu.mint(address(this), tenguReward);
        pool.accTenguPerShare = pool.accTenguPerShare.add(tenguReward.mul(1e12).div(pool.lpSupply));
        pool.lastRewardBlock = block.number;
    }

    // Update reward variables of the given pool to be up-to-date (external version w/ non-reentrancy)
    function updatePool(uint256 _pid) external nonReentrant {
        _updatePool(_pid);
    }

    // Deposit LP tokens to MasterChef for TENGU allocation.
    function deposit(uint256 _pid, uint256 _amount, address _referrer) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        _updatePool(_pid);
        if (_amount > 0 && address(tenguReferral) != address(0) && _referrer != address(0) && _referrer != msg.sender) {
            tenguReferral.recordReferral(msg.sender, _referrer);
        }
        _payOrLockupPendingTengu(_pid);
        if (_amount > 0) {
            // To handle correctly the transfer tax tokens w/ the pools
            uint256 balanceBefore = pool.lpToken.balanceOf(address(this));
            pool.lpToken.safeTransferFrom(address(msg.sender), address(this), _amount);
            _amount = pool.lpToken.balanceOf(address(this)).sub(balanceBefore);

            if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, depositFee);
                user.amount = user.amount.add(_amount).sub(depositFee);
                pool.lpSupply = pool.lpSupply.add(_amount).sub(depositFee);
            } else {
                user.amount = user.amount.add(_amount);
                pool.lpSupply = pool.lpSupply.add(_amount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accTenguPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");

        _updatePool(_pid);
        _payOrLockupPendingTengu(_pid);
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
            pool.lpSupply = pool.lpSupply.sub(_amount);
        }
        user.rewardDebt = user.amount.mul(pool.accTenguPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        pool.lpSupply = pool.lpSupply.sub(user.amount);
        user.amount = 0;
        user.rewardDebt = 0;
        user.rewardLockedUp = 0;
        user.nextHarvestUntil = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Pay or lockup pending TENGUs.
    function _payOrLockupPendingTengu(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];

        if (user.nextHarvestUntil == 0) {
            user.nextHarvestUntil = block.timestamp.add(pool.harvestInterval);
        }

        uint256 pending = user.amount.mul(pool.accTenguPerShare).div(1e12).sub(user.rewardDebt);
        if (canHarvest(_pid, msg.sender)) {
            if (pending > 0 || user.rewardLockedUp > 0) {
                uint256 totalRewards = pending.add(user.rewardLockedUp);

                // reset lockup
                totalLockedUpRewards = totalLockedUpRewards.sub(user.rewardLockedUp);
                user.rewardLockedUp = 0;
                user.nextHarvestUntil = block.timestamp.add(pool.harvestInterval);

                // send rewards
                _safeTenguTransfer(msg.sender, totalRewards);
                _payReferralCommission(msg.sender, totalRewards);
            }
        } else if (pending > 0) {
            user.rewardLockedUp = user.rewardLockedUp.add(pending);
            totalLockedUpRewards = totalLockedUpRewards.add(pending);
            emit RewardLockedUp(msg.sender, _pid, pending);
        }
    }

    // Safe tengu transfer function, just in case if rounding error causes pool to not have enough TENGUs.
    function _safeTenguTransfer(address _to, uint256 _amount) internal {
        uint256 tenguBal = tengu.balanceOf(address(this));
        if (_amount > tenguBal) {
            tengu.safeTransfer(_to, tenguBal);
        } else {
            tengu.safeTransfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function setDevAddress(address _devAddress) public {
        require(msg.sender == devAddress, "setDevAddress: FORBIDDEN");
        require(_devAddress != address(0), "setDevAddress: ZERO");

        address previousDevAddress = devAddress;
        devAddress = _devAddress;
        emit SetDevAddress(previousDevAddress, devAddress);
    }

    function setFeeAddress(address _feeAddress) public {
        require(msg.sender == feeAddress, "setFeeAddress: FORBIDDEN");
        require(_feeAddress != address(0), "setFeeAddress: ZERO");

        address previousFeeAddress = feeAddress;
        feeAddress = _feeAddress;
        emit SetFeeAddress(previousFeeAddress, feeAddress);
    }

    // Pancake has to add hidden dummy pools in order to alter the emission, here we make it simple and transparent to all.
    function updateEmissionRate(uint256 _tenguPerBlock) public onlyOwner {
        require(_tenguPerBlock <= MAX_EMISSION_RATE, "TENGU::updateEmissionRate: emission rate must not exceed the the maximum rate");

        massUpdatePools();
        uint256 previousTenguPerBlock = tenguPerBlock;
        tenguPerBlock = _tenguPerBlock;
        emit EmissionRateUpdated(previousTenguPerBlock, tenguPerBlock);
    }

    // Update the tengu referral contract address by the owner
    function setTenguReferral(ITenguReferral _tenguReferral) public onlyOwner {
        address previousTenguReferral = address(tenguReferral);
        tenguReferral = _tenguReferral;
        emit SetTenguReferral(previousTenguReferral, address(tenguReferral));
    }

    // Update referral commission rate by the owner
    function setReferralCommissionRate(uint256 _referralCommissionRate) public onlyOwner {
        require(_referralCommissionRate <= MAXIMUM_REFERRAL_COMMISSION_RATE, "setReferralCommissionRate: invalid referral commission rate basis points");

        uint256 previousReferralCommissionRate = referralCommissionRate;
        referralCommissionRate = _referralCommissionRate;
        emit SetReferralCommissionRate(previousReferralCommissionRate, referralCommissionRate);
    }

    // Pay referral commission to the referrer who referred this user.
    function _payReferralCommission(address _user, uint256 _pending) internal {
        if (address(tenguReferral) != address(0) && referralCommissionRate > 0) {
            address referrer = tenguReferral.getReferrer(_user);
            uint256 commissionAmount = _pending.mul(referralCommissionRate).div(10000);

            if (referrer != address(0) && commissionAmount > 0) {
                tengu.mint(referrer, commissionAmount);
                tenguReferral.recordReferralCommission(referrer, commissionAmount);
                emit ReferralCommissionPaid(_user, referrer, commissionAmount);
            }
        }
    }
}
