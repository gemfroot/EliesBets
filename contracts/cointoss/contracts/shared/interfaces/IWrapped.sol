// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

interface IWrapped {
 function deposit() external payable;

 function withdraw(uint wad) external;

 function transfer(address to, uint value) external returns (bool);
}
