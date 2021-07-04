// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IBEP20.sol";


interface IGreatTengu is IBEP20 {
    function swapTenguToGTengu(uint256 amount) external;
    function swapTenguToGTengu(uint256 amount, address recipient) external;
}
