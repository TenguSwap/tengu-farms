// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./libs/BEP20.sol";
import "./libs/IBEP20.sol";
import "./libs/SafeBEP20.sol";

contract GreatTenguToken is BEP20("GTG Token", "GTG") {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    IBEP20 public tengu;

    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    // Active fee to swap TENGU to GTENGU (default is 10%)
    uint256 public swapToGTenguFee = 1000;
    // Max fee to swap TENGU to GTENGU (30%)
    uint256 public constant SWAP_TO_GTENGU_MAX_FEE = 3000;

    event SetSwapToGTenguFee(uint256 previousFee, uint256 newFee);
    event SwapToGTengu(address indexed sender, address indexed recipient, uint256 tenguAmount, uint256 gTenguAmount);

    /**
     * @dev Swap an amount of Tengu for the corresponding amount of newly minted GTengu. Burn the swapped Tengu.
     */
    function _swapToGTengu(address sender, address recipient, uint256 amount) internal {
        require(amount > 0, "GTENGU::swapToGTengu: amount 0");
        require(tengu.balanceOf(sender) >= amount, "GTENGU::swapToGTengu: not enough TENGU");

        uint256 gTenguAmount = getSwapToGTenguAmount(amount);
        _mint(recipient, gTenguAmount);
        tengu.safeTransferFrom(sender, BURN_ADDRESS, amount);
        emit SwapToGTengu(sender, recipient, amount, gTenguAmount);
    }

    function swapToGTengu(uint256 amount) external {
        _swapToGTengu(msg.sender, msg.sender, amount);
    }

    function swapToGTengu(uint256 amount, address recipient) external {
        _swapToGTengu(msg.sender, recipient, amount);
    }

    /**
     * @dev Set the fee when swapping Tengu for GTengu.
     * Can only be called by the current owner.
     */
    function setSwapToGTenguFee(uint256 fee) external onlyOwner() {
        require(fee <= SWAP_TO_GTENGU_MAX_FEE, "GTENGU::swapToGTengu: fee too high");

        uint256 previousFee = swapToGTenguFee;
        swapToGTenguFee = fee;
        emit SetSwapToGTenguFee(previousFee, swapToGTenguFee);
    }

    /**
     * @dev Returns the amount of GTengu obtainable for swapping 'amount' of Tengu.
     */
    function getSwapToGTenguAmount(uint256 amount) public view returns (uint256 gTenguAmount) {
        return amount.mul(10000 - swapToGTenguFee).div(10000);
    }

    /**
     * @dev Set the Tengu contract address.
     * Can only be called by the current owner.
     * Can only be called once.
     */
    function setTenguContractAddress(IBEP20 tengu_) external onlyOwner() {
        require(address(tengu) == address(0), "GTENGU::setTenguContractAddress: already initialized");

        tengu = tengu_;
    }
}