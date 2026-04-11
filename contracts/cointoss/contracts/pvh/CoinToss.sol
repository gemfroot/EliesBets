// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {Game} from "./Game.sol";
import {IGameImplementation} from "./interfaces/IGameImplementation.sol";

interface ICoinToss is IGameImplementation {
 /// @notice Emitted after a bet is placed.
 /// @param id The bet ID.
 /// @param receiver Address of the receiver.
 /// @param token Address of the token.
 /// @param amount The bet amount.
 /// @param chargedVRFCost The Chainlink VRF cost paid by player.
 /// @param face The chosen coin face.
 /// @param affiliate Address of the affiliate.
 /// @param betCount How many bets at maximum must be placed.
 /// @param stopGain Profit limit indicating that bets must stop after surpassing it (before deduction of house edge).
 /// @param stopLoss Loss limit indicating that bets must stop after surpassing it (before deduction of house edge).
 event PlaceBet(
 uint256 id,
 address indexed receiver,
 address indexed token,
 uint256 amount,
 uint256 chargedVRFCost,
 bool face,
 address affiliate,
 uint32 betCount,
 uint256 stopGain,
 uint256 stopLoss
 );

 /// @notice Emitted after a bet is rolled.
 /// @param id The bet ID.
 /// @param receiver Address of the receiver.
 /// @param token Address of the token.
 /// @param totalBetAmount The total bet amount.
 /// @param face The chosen coin face.
 /// @param rolled The rolled coin faces.
 /// @param payout The payout amount.
 event Roll(
 uint256 indexed id,
 address indexed receiver,
 address indexed token,
 uint256 totalBetAmount,
 bool face,
 bool[] rolled,
 uint256 payout
 );

 /// @notice Coin Toss bet information struct.
 /// @param face The chosen coin face.
 /// @param rolled The rolled coin faces.
 struct CoinTossBet {
 bool face;
 bool[] rolled;
 }

 /// @notice Creates multiple bets and stores the chosen coin face.
 /// @param face The chosen coin face.
 /// @param receiver Address of the receiver who will receive the payout.
 /// @param affiliate Address of the affiliate.
 /// @param betData Data about the bet.
 /// @return Bet ID.
 function wager(
 bool face,
 address receiver,
 address affiliate,
 Game.BetData memory betData
 ) external payable returns (uint256);

 function coinTossBets(
 uint256 id
 ) external view returns (CoinTossBet memory);
}

/// @title BetSwirl's Coin Toss game
/// @notice The game is played with a two-sided coin. The game's goal is to guess whether the lucky coin face will be Heads or Tails.
/// @author Romuald Hog (based on Yakitori's Coin Toss)
contract CoinToss is Game, ICoinToss {
 /// @notice Maps bets IDs to chosen and rolled coin faces.
 /// @dev Coin faces: true = Tails, false = Heads.
 mapping(uint256 => CoinTossBet) private _coinTossBets;

 /// @notice Initialize the game base contract.
 /// @param bankAddress The address of the bank.
 /// @param chainlinkCoordinatorAddress Address of the Chainlink VRF Coordinator.
 /// @param chainlinkWrapperAddress Address of the Chainlink VRF Wrapper.
 /// @param wrappedGasToken Address of the wrapped gas token.
 /// @param refundTime_ Time to wait before to be refunded.
 /// @param maxCallGas_ Maximum call gas value.
 constructor(
 address bankAddress,
 address chainlinkCoordinatorAddress,
 address chainlinkWrapperAddress,
 address wrappedGasToken,
 uint64 refundTime_,
 uint256 maxCallGas_
 )
 Game(
 bankAddress,
 chainlinkCoordinatorAddress,
 chainlinkWrapperAddress,
 1,
 wrappedGasToken,
 refundTime_,
 maxCallGas_
 )
 {}

 /// @notice Decode bytes into face bool.
 /// @param data Bytes to decode.
 /// @return face The decoded chosen face.
 function _decodeBytesToBool(
 bytes calldata data
 ) private pure returns (bool face) {
 (face) = abi.decode(data, (bool));
 }

 /// @notice Calculates the target payout amount.
 /// @param betAmount Bet amount.
 /// @return The target payout amount.
 function _getPayout(uint256 betAmount) private pure returns (uint256) {
 return betAmount * 2;
 }

 /// @notice Calculates the payout based on the randomWord.
 /// @param id Bet ID.
 /// @param betAmount Bet amount.
 /// @param randomWord Random word.
 /// @return rolled The rolled number (0 if heads & 1 if tails).
 /// @return rolledPayout The payout based on the rolled number & the betAmount.
 function _roll(
 uint256 id,
 uint256 betAmount,
 uint256 randomWord
 ) internal view override returns (uint256 rolled, uint256 rolledPayout) {
 bool face = _coinTossBets[id].face;
 rolled = randomWord % 2;
 if ((face && rolled == 1) || (!face && rolled == 0)) {
 rolledPayout = _getPayout(betAmount);
 }
 }

 /// @notice Creates multiple bets and stores the chosen coin face.
 /// @param face The chosen coin face.
 /// @param receiver Address of the receiver who will receive the payout.
 /// @param affiliate Address of the affiliate.
 /// @param betData Data about the bet.
 /// @return Bet ID.
 function wager(
 bool face,
 address receiver,
 address affiliate,
 BetData memory betData
 ) public payable returns (uint256) {
 (Bet memory bet, uint256 chargedVRFCost) = _newBet(
 receiver,
 _getPayout(BP_VALUE),
 affiliate,
 betData
 );

 _coinTossBets[bet.id].face = face;

 emit PlaceBet(
 bet.id,
 bet.receiver,
 bet.token,
 bet.amount,
 chargedVRFCost,
 face,
 affiliate,
 betData.betCount,
 betData.stopGain,
 betData.stopLoss
 );
 return bet.id;
 }

 /// @notice Creates mutliple bets and stores the chosen coin face.
 /// @param bet The encoded chosen coin face.
 /// @param receiver Address of the receiver who will receive the payout.
 /// @param affiliate Address of the affiliate.
 /// @param betData Data about the bet.
 /// @return Bet ID.
 function wagerWithData(
 bytes calldata bet,
 address receiver,
 address affiliate,
 BetData memory betData
 ) external payable returns (uint256) {
 return wager(_decodeBytesToBool(bet), receiver, affiliate, betData);
 }

 /// @notice Resolves the bet using the Chainlink randomness.
 /// @param id The bet ID.
 /// @param randomWords Random words list. Contains only one for this game.
 function fulfillRandomWords(
 uint256 id,
 uint256[] calldata randomWords
 ) internal override {
 CoinTossBet storage coinTossBet = _coinTossBets[id];
 Bet storage bet = bets[id];
 bool[] memory rolledBetsBoolean;
 uint256 payout;
 uint256 totalBetAmount;
 // Single Bet
 if (bet.betCount == 1) {
 totalBetAmount = bet.amount;
 (uint256 rolled, uint256 rolledPayout) = _roll(
 id,
 totalBetAmount,
 randomWords[0]
 );
 rolledBetsBoolean = new bool[](1);
 rolledBetsBoolean[0] = rolled == 1;
 payout = _resolvePayout(bet, totalBetAmount, rolledPayout);
 }
 // Multi Bet
 else {
 (
 uint256 totalPayout,
 uint256 totalBetAmount_,
 uint256[] memory rolled
 ) = _resolveBets(id, randomWords[0]);
 payout = totalPayout;
 totalBetAmount = totalBetAmount_;
 rolledBetsBoolean = new bool[](rolled.length);
 for (uint16 i; i < rolled.length; ) {
 rolledBetsBoolean[i] = rolled[i] == 1;
 unchecked {
 ++i;
 }
 }
 }
 coinTossBet.rolled = rolledBetsBoolean;
 emit Roll(
 bet.id,
 bet.receiver,
 bet.token,
 totalBetAmount,
 coinTossBet.face,
 rolledBetsBoolean,
 payout
 );
 }

 function coinTossBets(
 uint256 id
 ) external view returns (CoinTossBet memory) {
 return _coinTossBets[id];
 }
}
