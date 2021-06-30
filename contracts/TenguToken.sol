// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libs/BEP20.sol";
import "./libs/IGreatTengu.sol";
import "./libs/SafeBEP20.sol";

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

// TenguToken with Governance.
contract TenguToken is BEP20 {
    using SafeBEP20 for IGreatTengu;

    IGreatTengu public gTengu;
    // Transfer tax rate in basis points. (default 8%)
    uint256 public transferTaxRate = 800;
    // Burn rate % of transfer tax. (default 25% x 8% = 2% of total amount).
    uint256 public burnRate = 25;
    // Rate % of the gTengu obtained from the transfer tax. (default 50% x 8% = 4% of total amount)
    uint256 public gTenguRate = 50;
    // Max transfer tax rate: 10%.
    uint256 public constant MAXIMUM_TRANSFER_TAX_RATE = 1000;
    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    // Active fee to swap GTENGU to TENGU (default is 20%)
    uint256 public swapGTenguToTenguFee = 2000;
    // Max fee to swap GTENGU to TENGU (30%)
    uint256 public constant SWAP_GTENGU_TO_TENGU_MAX_FEE = 3000;

    // Max transfer amount rate in basis points. (default is 0.5% of total supply)
    uint256 public maxTransferAmountRate = 50;
    // Min. transfer amount rate : 0.3% of total supply
    uint256 public constant MIN_TRANSFER_AMOUNT_RATE = 30;
    // Addresses that excluded from antiWhale
    mapping(address => bool) private _excludedFromAntiWhale;
    // Min amount to liquify. (default 500 TENGUs)
    uint256 public minAmountToLiquify = 500 ether;
    // The swap router, modifiable. Will be changed to TenguSwap's router when our own AMM release
    IUniswapV2Router02 public tenguSwapRouter;
    // The trading pair
    address public tenguSwapPair;
    // Not in swap and liquify
    bool private _notInSwapAndLiquify = true;
    // Set locker contract address
    address public locker;

    /**
    * @notice The operator can update the transfer tax rate and its repartition, and update the tenguSwapRouter
    * It will be transferred to the timelock contract
    */
    address private _operator;

    // Events
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);
    event TransferTaxRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event BurnRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event GTenguRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event MaxTransferAmountRateUpdated(address indexed operator, uint256 previousRate, uint256 newRate);
    event MinAmountToLiquifyUpdated(address indexed operator, uint256 previousAmount, uint256 newAmount);
    event TenguSwapRouterUpdated(address indexed operator, address indexed router, address indexed pair);
    event SwapAndLiquify(uint256 tokensSwapped, uint256 ethReceived, uint256 tokensIntoLiqudity);
    event SetSwapGTenguToTenguFee(uint256 previousFee, uint256 newFee);
    event SwapGTenguToTengu(address indexed sender, address indexed recipient, uint256 gTenguAmount, uint256 tenguAmount);
    event LockerUpdated(address previousLocker, address newLocker);

    modifier onlyOperator() {
        require(_operator == msg.sender, "operator: caller is not the operator");
        _;
    }

    modifier antiWhale(address sender, address recipient, uint256 amount) {
        if (maxTransferAmount() > 0) {
            if (
                _excludedFromAntiWhale[sender] == false
                && _excludedFromAntiWhale[recipient] == false
            ) {
                require(amount <= maxTransferAmount(), "TENGU::antiWhale: Transfer amount exceeds the maxTransferAmount");
            }
        }
        _;
    }

    modifier lockTheSwap {
        require(_notInSwapAndLiquify, "TENGU::lockTheSwap: already in");
        _notInSwapAndLiquify = false;
        _;
        _notInSwapAndLiquify = true;
    }

    modifier transferTaxFree {
        uint256 _transferTaxRate = transferTaxRate;
        transferTaxRate = 0;
        _;
        transferTaxRate = _transferTaxRate;
    }

    /**
     * @notice Constructs the TenguToken contract.
     */
    constructor() public BEP20("TG Token", "TG") {
        _operator = _msgSender();
        emit OperatorTransferred(address(0), _operator);

        _excludedFromAntiWhale[msg.sender] = true;
        _excludedFromAntiWhale[address(0)] = true;
        _excludedFromAntiWhale[address(this)] = true;
        _excludedFromAntiWhale[BURN_ADDRESS] = true;
    }

    /// @notice Creates `_amount` token to `_to`. Must only be called by the owner (MasterChef).
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    /// @dev overrides transfer function to meet tokenomics of TENGU
    function _transfer(address sender, address recipient, uint256 amount) internal virtual override antiWhale(sender, recipient, amount) {
        if (recipient == BURN_ADDRESS || transferTaxRate == 0) {
            super._transfer(sender, recipient, amount);
        } else {
            // default tax is 8% of every transfer
            uint256 taxAmount = amount.mul(transferTaxRate).div(10000);

            // default 92% of transfer sent to recipient
            uint256 sendAmount = amount.sub(taxAmount);
            require(amount == sendAmount + taxAmount, "TENGU::transfer: Tax value invalid");

            uint256 burnAmount = taxAmount.mul(burnRate).div(100);
            uint256 toGTenguAmount = taxAmount.mul(gTenguRate).div(100);
            uint256 liquidityAmount = taxAmount.sub(burnAmount).sub(toGTenguAmount);
            require(taxAmount == burnAmount + toGTenguAmount + liquidityAmount, "TENGU::transfer: Burn value invalid");

            super._transfer(sender, BURN_ADDRESS, burnAmount);
            // transfer on this contract the amounts to liquify and to swap to GTengu
            super._transfer(sender, address(this), liquidityAmount.add(toGTenguAmount));
            super._transfer(sender, recipient, sendAmount);
            if (toGTenguAmount > 0) {
                gTengu.swapToGTengu(toGTenguAmount, sender);
            }
        }
    }

    /// @dev Swap and liquify
    function swapAndLiquify() external lockTheSwap transferTaxFree {
        require(address(tenguSwapRouter) != address(0), "TENGU::swapAndLiquify: Router not defined");

        uint256 contractTokenBalance = balanceOf(address(this));
        uint256 maxTransferAmount = maxTransferAmount();
        contractTokenBalance = contractTokenBalance > maxTransferAmount ? maxTransferAmount : contractTokenBalance;

        if (contractTokenBalance >= minAmountToLiquify) {
            // only min amount to liquify
            uint256 liquifyAmount = minAmountToLiquify;

            // split the liquify amount into halves
            uint256 half = liquifyAmount.div(2);
            uint256 otherHalf = liquifyAmount.sub(half);

            // capture the contract's current ETH balance.
            // this is so that we can capture exactly the amount of ETH that the
            // swap creates, and not make the liquidity event include any ETH that
            // has been manually sent to the contract
            uint256 initialBalance = address(this).balance;

            // swap tokens for ETH
            swapTokensForEth(half);

            // how much ETH did we just swap into?
            uint256 newBalance = address(this).balance.sub(initialBalance);

            // add liquidity
            addLiquidity(otherHalf, newBalance);

            emit SwapAndLiquify(half, newBalance, otherHalf);
        }
    }

    /// @dev Swap tokens for eth
    function swapTokensForEth(uint256 tokenAmount) private {
        // generate the tenguSwap pair path of token -> weth
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = tenguSwapRouter.WETH();

        _approve(address(this), address(tenguSwapRouter), tokenAmount);

        // make the swap
        tenguSwapRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0, // accept any amount of ETH
            path,
            address(this),
            block.timestamp
        );
    }

    /// @dev Add liquidity
    function addLiquidity(uint256 tokenAmount, uint256 ethAmount) private {
        require(locker != address(0), "TENGU::addLiquidity: locker address must be set");

        // approve token transfer to cover all possible scenarios
        _approve(address(this), address(tenguSwapRouter), tokenAmount);

        // add the liquidity
        tenguSwapRouter.addLiquidityETH{value: ethAmount}(
            address(this),
            tokenAmount,
            0, // slippage is unavoidable
            0, // slippage is unavoidable
            locker,
            block.timestamp
        );
    }

    /**
     * @dev Returns the max transfer amount.
     */
    function maxTransferAmount() public view returns (uint256) {
        return totalSupply().mul(maxTransferAmountRate).div(10000);
    }

    /**
     * @dev Returns the address is excluded from antiWhale or not.
     */
    function isExcludedFromAntiWhale(address _account) public view returns (bool) {
        return _excludedFromAntiWhale[_account];
    }

    // To receive BNB from tenguSwapRouter when swapping
    receive() external payable {}

    /**
     * @dev Update the transfer tax rate.
     * Can only be called by the current operator.
     */
    function updateTransferTaxRate(uint256 _transferTaxRate) public onlyOperator {
        require(_transferTaxRate <= MAXIMUM_TRANSFER_TAX_RATE, "TENGU::updateTransferTaxRate: Transfer tax rate must not exceed the maximum rate.");

        uint256 previousTransferTaxRate = transferTaxRate;
        transferTaxRate = _transferTaxRate;
        emit TransferTaxRateUpdated(msg.sender, previousTransferTaxRate, transferTaxRate);
    }

    /**
     * @dev Update the burn rate.
     * Can only be called by the current operator.
     */
    function updateBurnRate(uint256 _burnRate) public onlyOperator {
        require(_burnRate + gTenguRate <= 100, "TENGU::updateBurnRate: GTengu + burn rates must not exceed the maximum rate.");

        uint256 previousBurnRate = burnRate;
        burnRate = _burnRate;
        emit BurnRateUpdated(msg.sender, previousBurnRate, burnRate);
    }

    /**
     * @dev Update the burn rate.
     * Can only be called by the current operator.
     */
    function updateGTenguRate(uint256 _gTenguRate) public onlyOperator {
        require(burnRate + _gTenguRate <= 100, "TENGU::updateGTenguRate: GTengu + burn rates must not exceed the maximum rate.");

        uint256 previousGTenguRate = gTenguRate;
        gTenguRate = _gTenguRate;
        emit GTenguRateUpdated(msg.sender, previousGTenguRate, gTenguRate);
    }

    /**
     * @dev Update the max transfer amount rate.
     * Can only be called by the current operator.
     */
    function updateMaxTransferAmountRate(uint256 _maxTransferAmountRate) public onlyOperator {
        require(_maxTransferAmountRate <= 10000, "TENGU::updateMaxTransferAmountRate: Max transfer amount rate must not exceed the maximum rate.");
        require(_maxTransferAmountRate >= MIN_TRANSFER_AMOUNT_RATE, "TENGU::updateMaxTransferAmountRate: Min transfer amount rate must be above the minimum rate.");

        uint256 previousMaxTransferAmountRate = maxTransferAmountRate;
        maxTransferAmountRate = _maxTransferAmountRate;
        emit MaxTransferAmountRateUpdated(msg.sender, previousMaxTransferAmountRate, maxTransferAmountRate);
    }

    /**
     * @dev Update the min amount to liquify.
     * Can only be called by the current operator.
     */
    function updateMinAmountToLiquify(uint256 _minAmount) public onlyOperator {
        uint256 previousMinAmountToLiquify = minAmountToLiquify;
        minAmountToLiquify = _minAmount;
        emit MinAmountToLiquifyUpdated(msg.sender, previousMinAmountToLiquify, minAmountToLiquify);
    }

    /**
     * @dev Exclude or include an address from antiWhale.
     * Can only be called by the current operator.
     */
    function setExcludedFromAntiWhale(address _account, bool _excluded) public onlyOperator {
        _excludedFromAntiWhale[_account] = _excluded;
    }

    /**
     * @dev Update the swap router.
     * Can only be called by the current operator.
     */
    function updateTenguSwapRouter(address _router) public onlyOperator {
        tenguSwapRouter = IUniswapV2Router02(_router);
        tenguSwapPair = IUniswapV2Factory(tenguSwapRouter.factory()).getPair(address(this), tenguSwapRouter.WETH());
        require(tenguSwapPair != address(0), "TENGU::updateTenguSwapRouter: Invalid pair address.");
        emit TenguSwapRouterUpdated(msg.sender, address(tenguSwapRouter), tenguSwapPair);
    }

    /**
     * @dev Update the tengu locker contract.
     * Can only be called by the current operator.
     */
    function updateLocker(address _locker) public onlyOperator {
        require(_locker != address(0), "TENGU::updateTenguLocker: new operator is the zero address");

        address previousLocker = locker;
        locker = _locker;
        emit LockerUpdated(previousLocker, locker);
    }

    /**
     * @dev Returns the address of the current operator.
     */
    function operator() public view returns (address) {
        return _operator;
    }

    /**
     * @dev Transfers operator of the contract to a new account (`newOperator`).
     * Can only be called by the current operator.
     */
    function transferOperator(address newOperator) public onlyOperator {
        require(newOperator != address(0), "TENGU::transferOperator: new operator is the zero address");

        address previousOperator = _operator;
        _operator = newOperator;
        emit OperatorTransferred(previousOperator, _operator);
    }

    /**
     * @dev Swap an amount of GTengu for the corresponding amount of newly minted Tengu. Burn the swapped GTengu.
     */
    function swapGTenguToTengu(uint256 amount) external {
        require(amount > 0, "TENGU::swapGTenguToTengu: amount 0");
        require(gTengu.balanceOf(msg.sender) >= amount, "TENGU::swapGTenguToTengu: not enough GTENGU");

        uint256 tenguAmount = getSwapGTenguToTenguAmount(amount);
        super._mint(msg.sender, tenguAmount);
        gTengu.safeTransferFrom(msg.sender, BURN_ADDRESS, amount);
        emit SwapGTenguToTengu(msg.sender, msg.sender, amount, tenguAmount);
    }

    /**
     * @dev Set the fee when swapping GTengu for Tengu.
     * Can only be called by the current operator.
     */
    function setSwapGTenguToTenguFee(uint256 fee) external onlyOperator() {
        require(fee <= SWAP_GTENGU_TO_TENGU_MAX_FEE, "TENGU::setSwapGTenguToTenguFee: fee too high");

        uint256 previousFee = swapGTenguToTenguFee;
        swapGTenguToTenguFee = fee;
        emit SetSwapGTenguToTenguFee(previousFee, swapGTenguToTenguFee);
    }

    /**
     * @dev Returns the amount of Tengu obtainable for swapping 'amount' of GTengu.
     */
    function getSwapGTenguToTenguAmount(uint256 amount) public view returns (uint256 tenguAmount) {
        uint256 fee = amount.mul(swapGTenguToTenguFee).div(10000);
        return amount.sub(fee);
    }

    /**
     * @dev Set the GTengu contract address.
     * Can only be called by the current operator.
     * Can only be called once.
     */
    function setGTenguContractAddress(IGreatTengu gTengu_) external onlyOperator() {
        require(address(gTengu) == address(0), "TENGU::setGTenguContractAddress: already initialized");

        gTengu = gTengu_;
        // Authorize GTengu contract to transfer (to the burn address) the Tengu we want to swap to GTengu
        // cf GreatTenguToken._swapToGTengu()
        _approve(address(this), address(gTengu), uint256(-1));
    }

}
