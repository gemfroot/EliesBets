// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;
import {IGame} from "./IGame.sol";

/// @notice Defines common functionalities between all PVH implemention games.
interface IGameImplementation {
 function wagerWithData(
 bytes calldata bet,
 address receiver,
 address affiliate,
 IGame.BetData memory betData
 ) external payable returns (uint256);
}
