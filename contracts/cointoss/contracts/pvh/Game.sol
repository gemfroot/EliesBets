// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {IBankGame} from "./interfaces/IBank.sol";
import {IGame} from "./interfaces/IGame.sol";
import {IVRFV2PlusWrapperCustom} from "../shared/interfaces/IVRFV2PlusWrapperCustom.sol";
import {IWrapped} from "../shared/interfaces/IWrapped.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

/// @title Game base contract
/// @author Romuald Hog
/// @notice This should be the parent contract of each games.
/// It defines all the games common functions and state variables.
/// @dev All rates are in basis point. Chainlink VRF v2.5 is used.
abstract contract Game is
 Pausable,
 VRFConsumerBaseV2Plus,
 ReentrancyGuard,
 IGame
{
 using SafeERC20 for IERC20;

 /// @notice Chainlink VRF configuration state.
 ChainlinkConfig private _chainlinkConfig;

 /// @notice Maps bets IDs to Bet information.
 mapping(uint256 => Bet) public bets;

 /// @notice Maps tokens addresses to token configuration.
 mapping(address => Token) public tokens;

 /// @notice Affiliate's house edge rates (token => affiliate => house edge).
 mapping(address => mapping(address => uint16)) public _affiliateHouseEdges;

 /// @notice The bank that manage to payout a won bet and collect a loss bet.
 IBankGame public immutable BANK;

 /// @notice Set the wrapped token in case of transfer issue
 IWrapped public immutable WRAPPED;

 /// @notice Time to wait before to be refunded
 uint64 public refundTime;

 /// @notice Maximum gas to send to "call" function
 uint256 public maxCallGas;

 uint256 internal constant BP_VALUE = 10_000;

 /// @notice Maximum settable house edge
 uint256 private constant MAX_HOUSE_EDGE = 3500;

 /// @notice Extra gas consumed in VRF callback that is used in addition to a single bet. This is independent of the betCount and token used.
 uint32 private constant EXTRA_MULTIBET_GAS = 5500;

 /// @notice Minimum extra VRF fees received in wager to refund the user. It is a little more than an ETH transfer.
 uint256 private constant MIN_VRF_EXTRA_FEE_REFUNDED = 22_000;

 /// @notice Initialize contract's state variables and VRF Consumer.
 /// @param bankAddress The address of the bank.
 /// @param chainlinkCoordinatorAddress Address of the Chainlink VRF Coordinator.
 /// @param chainlinkWrapperAddress Chainlink Wrapper used to estimate the VRF cost.
 /// @param numRandomWords How many random words is needed to resolve a game's bet.
 /// @param wrappedGasToken Address of the wrapped gas token.
 /// @param refundTime_ Time to wait before to be refunded.
 /// @param maxCallGas_ Maximum call gas value.
 constructor(
 address bankAddress,
 address chainlinkCoordinatorAddress,
 address chainlinkWrapperAddress,
 uint16 numRandomWords,
 address wrappedGasToken,
 uint64 refundTime_,
 uint256 maxCallGas_
 ) VRFConsumerBaseV2Plus(chainlinkCoordinatorAddress) {
 if (
 chainlinkWrapperAddress == address(0) ||
 chainlinkCoordinatorAddress == address(0) ||
 bankAddress == address(0) ||
 wrappedGasToken == address(0)
 ) {
 revert InvalidAddress();
 }
 require(
 numRandomWords != 0 && numRandomWords <= 500,
 "Wrong Chainlink NumRandomWords"
 );

 BANK = IBankGame(bankAddress);
 WRAPPED = IWrapped(wrappedGasToken);
 _chainlinkConfig.numRandomWords = numRandomWords;
 _chainlinkConfig.chainlinkWrapper = IVRFV2PlusWrapperCustom(
 chainlinkWrapperAddress
 );
 setRefundTime(refundTime_);
 setMaxCallGas(maxCallGas_);
 }

 /// @notice Calculates the amount's fee based on the house edge.
 /// @param amount From which the fee amount will be calculated.
 /// @param houseEdge The house edge of the bet.
 /// @return The fee amount.
 function _getFees(
 uint256 amount,
 uint16 houseEdge
 ) private pure returns (uint256) {
 return (houseEdge * amount) / BP_VALUE;
 }

 /// @notice Get the affiliate's house edge. If the affiliate has not their own house edge,
 /// then it takes the default house edge.
 /// @param affiliate Address of the affiliate.
 /// @param token Address of the token.
 /// @return The affiliate's house edge.
 function getAffiliateHouseEdge(
 address affiliate,
 address token
 ) public view returns (uint16) {
 uint16 affiliateHouseEdge = _affiliateHouseEdges[token][affiliate];
 return
 affiliateHouseEdge == 0
 ? tokens[token].houseEdge
 : affiliateHouseEdge;
 }

 /// @notice Creates a new bet and request randomness to Chainlink,
 /// transfer the ERC20 tokens to the contract or refund the bet amount overflow if the bet amount exceed the maxBetAmount.
 /// @param receiver Address of the receiver.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @param affiliate Address of the affiliate.
 /// @param betData Data about the bet.
 /// @return newBet A new Bet struct information.
 // @return chargedVRFCost The charged VRF cost estimation.
 /// @dev msg.value must always contain the VRF cost.
 /// If the bet is made in gas token, then tokenAddress must be equal to zero address and msg.value must be equal to tokenAmount + VRF cost.
 /// The user is the address who receives the payout. Only msg.sender pays the bet amount and VRF fees.
 /// tokenAmount can now be lower than 10,000. In the worst case, the user's gains are rounded down, and the bank receives no fees.
 function _newBet(
 address receiver,
 uint256 multiplier,
 address affiliate,
 IGame.BetData memory betData
 )
 internal
 whenNotPaused
 nonReentrant
 returns (Bet memory newBet, uint256 chargedVRFCost)
 {
 if (affiliate == address(0) || receiver == address(0))
 revert InvalidAddress();
 uint16 betCount = betData.betCount;
 if (betCount == 0) revert UnderMinBetCount(1);
 address tokenAddress = betData.token;
 uint256 tokenAmount = betData.betAmount;

 if (tokenAmount == 0) revert UnderMinBetAmount(1);

 if (
 getAffiliateHouseEdge(affiliate, tokenAddress) >
 betData.maxHouseEdge
 ) revert HouseEdgeTooHigh();

 bool isGasToken = address(0) == tokenAddress;

 Token storage token = tokens[tokenAddress];

 chargedVRFCost = isGasToken
 ? msg.value - tokenAmount * betCount
 : msg.value;

 {
 // Charge sender for Chainlink VRF fee.
 uint256 chainlinkVRFCost = getChainlinkVRFCost(
 tokenAddress,
 betCount
 );
 if (chargedVRFCost < chainlinkVRFCost) {
 revert WrongGasValueToCoverVRFFee();
 }
 uint256 extraVRFFees = chargedVRFCost - chainlinkVRFCost;

 // Refund if user sent too much VRF fee
 if (extraVRFFees > MIN_VRF_EXTRA_FEE_REFUNDED * tx.gasprice) {
 Address.sendValue(payable(msg.sender), extraVRFFees);
 chargedVRFCost -= extraVRFFees;
 }
 unchecked {
 token.VRFFees += chargedVRFCost;
 }
 }

 {
 (
 bool isAllowedToken,
 uint256 maxBetAmount,
 uint256 maxBetCount
 ) = BANK.getBetRequirements(tokenAddress, multiplier);

 if (!isAllowedToken || token.houseEdge == 0) {
 revert ForbiddenToken();
 }

 if (betCount > maxBetCount) {
 revert BetCountTooHigh(maxBetCount);
 }

 if (tokenAmount > maxBetAmount) {
 if (isGasToken) {
 Address.sendValue(
 payable(msg.sender),
 // excess gas token sent
 (tokenAmount - maxBetAmount) * betCount
 );
 }
 tokenAmount = maxBetAmount;
 }
 }

 // Create bet
 uint256 id = s_vrfCoordinator.requestRandomWords(
 VRFV2PlusClient.RandomWordsRequest({
 keyHash: _chainlinkConfig.keyHash,
 subId: token.vrfSubId,
 requestConfirmations: _chainlinkConfig.requestConfirmations,
 callbackGasLimit: _getCallbackGasLimit(tokenAddress, betCount),
 numWords: _chainlinkConfig.numRandomWords,
 extraArgs: VRFV2PlusClient._argsToBytes(
 VRFV2PlusClient.ExtraArgsV1({
 nativePayment: _chainlinkConfig.nativePayment
 })
 )
 })
 );
 newBet = Bet(
 false,
 receiver,
 tokenAddress,
 id,
 tokenAmount,
 getAffiliateHouseEdge(affiliate, tokenAddress), // Stack too deep
 uint32(block.timestamp),
 0,
 betCount,
 betData.stopGain,
 betData.stopLoss,
 affiliate
 );
 bets[id] = newBet;

 unchecked {
 ++token.pendingCount;
 }

 // Get the ERC20 tokens from the caller
 if (!isGasToken) {
 IERC20(tokenAddress).safeTransferFrom(
 msg.sender,
 address(this),
 tokenAmount * betCount
 );
 }
 }

 function _roll(
 uint256 id,
 uint256 amount,
 uint256 randomWord
 ) internal view virtual returns (uint256, uint256);

 /// @notice Resolves multi bets taking into account the stopGain and stopLoss. It is a wrapped above _resolvePayout function.
 /// @param betId The bet id.
 /// @param randomSeed The VRF random seed. It derives a randomWord for each bet based on this randomSeed.
 /// @return payout The payout amount.
 /// @return cumulatedBetAmount The total bet amount.
 /// @return rolledValues The rolled values in common format (uint256).
 /// @dev Should not revert as it resolves the bet with the randomness.
 function _resolveBets(
 uint256 betId,
 uint256 randomSeed
 )
 internal
 returns (
 uint256 payout,
 uint256 cumulatedBetAmount,
 uint256[] memory rolledValues
 )
 {
 Bet storage bet = bets[betId];

 uint256 cumulatedPayout;
 uint16 betCount = bet.betCount;
 uint256 betAmount = bet.amount;
 rolledValues = new uint256[](betCount);

 uint256 stopGain = bet.stopGain;
 uint256 stopLoss = bet.stopLoss;
 uint16 rollCount = 0;
 do {
 cumulatedBetAmount += betAmount;

 // Compute random word here instead if in VRF Coordinator to avoid waste some gas if stopGain/stopLoss are triggered before the end
 (uint256 rolled, uint256 rolledPayout) = _roll(
 betId,
 betAmount,
 uint256(keccak256(abi.encode(randomSeed, rollCount)))
 );
 rolledValues[rollCount] = rolled;
 unchecked {
 ++rollCount;
 }

 cumulatedPayout += rolledPayout;
 } while (
 rollCount < betCount &&
 // Check if stopGain & stopLoss are triggered
 !((stopGain > 0 &&
 cumulatedPayout >= stopGain + cumulatedBetAmount) ||
 (stopLoss > 0 &&
 cumulatedBetAmount >= stopLoss + cumulatedPayout))
 );

 // Shorten the array if needed (when stopGain/stopLoss has been triggered)
 if (rollCount < betCount) {
 assembly {
 mstore(rolledValues, rollCount)
 }
 }
 payout = _resolvePayout(bet, cumulatedBetAmount, cumulatedPayout);
 }

 /// @notice Resolves the bet based on the game child contract result.
 /// In case bet is won, the bet amount minus the house edge is transfered to user from the game contract, and the profit is transfered to the user from the Bank.
 /// In case bet is lost, the bet amount is transfered to the Bank from the game contract.
 /// In case bet is lost but with a payout, a part of the bet amount + fees are transfered to the Bank, and the payout is transfered to the user.
 /// @param bet The Bet struct information.
 /// @param totalBetAmount The total bet amount (betAmount * rolled betCount). If stopLoss or stopGain has been triggered,
 /// it means the value may be lower than the amount taken in wager tx.
 /// @param payout What should be sent to the user in case of a won bet. Payout = bet amount + profit amount.
 /// @return payout The payout amount.
 /// @dev Should not revert as it resolves the bet with the randomness.
 function _resolvePayout(
 Bet storage bet,
 uint256 totalBetAmount,
 uint256 payout
 ) internal returns (uint256) {
 if (bet.resolved || bet.id == 0) {
 revert NotPendingBet();
 }
 bet.resolved = true;

 address tokenAddress = bet.token;
 Token storage token = tokens[tokenAddress];
 unchecked {
 --token.pendingCount;
 }

 // We may refund amount if bets have been stopped via stopLoss or stopGain
 uint256 refundAmount = bet.amount * bet.betCount - totalBetAmount;
 bool isGasToken = tokenAddress == address(0);
 address affiliate = bet.affiliate;
 if (payout > totalBetAmount) {
 // Check payout does not exceeds bankroll (could happens in very rare case)
 {
 uint256 bankroll = BANK.getBalance(tokenAddress);
 if (bankroll < payout - totalBetAmount)
 payout = bankroll + totalBetAmount;
 }
 // The receiver has won more than his bet
 address receiver = bet.receiver;
 uint256 profit = payout - totalBetAmount;
 uint256 betAmountFee = _getFees(totalBetAmount, bet.houseEdge);
 uint256 profitFee = _getFees(profit, bet.houseEdge);
 uint256 fee = betAmountFee + profitFee;

 payout -= fee;

 uint256 betAmountPayout = totalBetAmount -
 betAmountFee +
 refundAmount;

 // Transfer the payout from the bank, the bet amount fee to the bank, and account fees.
 if (!isGasToken)
 IERC20(tokenAddress).safeTransfer(address(BANK), betAmountFee);

 BANK.payout{value: isGasToken ? betAmountFee : 0}(
 receiver,
 tokenAddress,
 profit - profitFee, // profitPayout
 fee,
 affiliate
 );
 // Transfer the bet amount payout to the player
 if (isGasToken) _safeNativeTransfer(receiver, betAmountPayout);
 else IERC20(tokenAddress).safeTransfer(receiver, betAmountPayout);
 } else if (payout > 0) {
 // The receiver has won something smaller than his bet
 uint256 fee = _getFees(payout, bet.houseEdge);
 payout -= fee;
 uint256 bankCashIn = totalBetAmount - payout;
 uint256 betAmountPayout = payout + refundAmount;

 // Transfer the bet amount payout to the player
 if (isGasToken) _safeNativeTransfer(bet.receiver, betAmountPayout);
 else
 IERC20(tokenAddress).safeTransfer(
 bet.receiver,
 betAmountPayout
 );

 // Transfer the lost bet amount and fee to the bank
 if (!isGasToken && bankCashIn > 0) {
 IERC20(tokenAddress).safeTransfer(address(BANK), bankCashIn);
 }
 BANK.cashIn{value: isGasToken ? bankCashIn : 0}(
 tokenAddress,
 bankCashIn,
 fee,
 affiliate
 );
 } else {
 // The receiver did not win anything

 if (refundAmount > 0) {
 if (isGasToken) {
 _safeNativeTransfer(bet.receiver, refundAmount);
 } else {
 IERC20(tokenAddress).safeTransfer(
 address(bet.receiver),
 refundAmount
 );
 }
 }
 if (!isGasToken) {
 IERC20(tokenAddress).safeTransfer(
 address(BANK),
 totalBetAmount
 );
 }
 BANK.cashIn{value: isGasToken ? totalBetAmount : 0}(
 tokenAddress,
 totalBetAmount,
 0,
 affiliate
 );
 }

 bet.payout = payout;
 return payout;
 }

 function _safeNativeTransfer(address recipient, uint256 amount) internal {
 (bool success, ) = recipient.call{value: amount, gas: maxCallGas}("");

 if (!success) {
 // Fallback to wrapped gas token in case of error
 WRAPPED.deposit{value: amount}();
 WRAPPED.transfer(recipient, amount);
 }
 }

 /// @notice Sets the game house edge rate for a specific token.
 /// @param token Address of the token.
 /// @param houseEdge House edge rate.
 /// @dev Setting the house edge to 0 allow to pause the use of the token for the new bets.
 function setHouseEdge(
 address token,
 uint16 houseEdge
 ) external nonReentrant onlyOwner {
 if (houseEdge > MAX_HOUSE_EDGE) {
 revert HouseEdgeTooHigh();
 }
 uint16 oldHouseEdge = tokens[token].houseEdge;
 tokens[token].houseEdge = houseEdge;
 emit SetHouseEdge(token, oldHouseEdge, houseEdge);
 }

 /// @notice Sets the game affiliate's house edge rate for a specific token.
 /// @param token Address of the token.
 /// @param affiliateHouseEdge Affiliate's house edge rate.
 /// @dev The msg.sender of the tx is considered as to be the affiliate.
 function setAffiliateHouseEdge(
 address token,
 uint16 affiliateHouseEdge
 ) external nonReentrant {
 uint16 defaultHouseEdge = tokens[token].houseEdge;
 if (defaultHouseEdge == 0) {
 revert AccessDenied();
 }
 if (affiliateHouseEdge < defaultHouseEdge) {
 revert HouseEdgeTooLow();
 }
 if (affiliateHouseEdge > MAX_HOUSE_EDGE) {
 revert HouseEdgeTooHigh();
 }
 address affiliate = msg.sender;
 uint16 oldAffiliateHouseEdge = _affiliateHouseEdges[token][affiliate];
 _affiliateHouseEdges[token][affiliate] = affiliateHouseEdge;
 emit SetAffiliateHouseEdge(
 token,
 affiliate,
 oldAffiliateHouseEdge,
 affiliateHouseEdge
 );
 }

 /// @notice Pauses/Unpauses the contract to disable/enable new bets.
 function togglePause() external nonReentrant onlyOwner {
 if (paused()) {
 _unpause();
 } else {
 _pause();
 }
 }

 /// @notice Sets the Chainlink VRF subscription ID for a specific token.
 /// @param token Address of the token.
 /// @param subId Subscription ID.
 function setVRFSubId(
 address token,
 uint256 subId
 ) external nonReentrant onlyOwner {
 if (subId == 0) revert InvalidVRFSubId();
 uint256 oldVRFSubId = tokens[token].vrfSubId;
 tokens[token].vrfSubId = subId;
 emit SetVRFSubId(token, oldVRFSubId, subId);
 }

 /// @notice Sets the new max call gas value.
 /// @param maxCallGas_ The max call gas value.
 function setMaxCallGas(uint256 maxCallGas_) public nonReentrant onlyOwner {
 if (maxCallGas_ == 0) {
 revert InvalidMaxCallGas();
 }
 uint256 oldMaxCallGas = maxCallGas;
 maxCallGas = maxCallGas_;
 emit SetMaxCallGas(oldMaxCallGas, maxCallGas_);
 }

 /// @notice Sets the new refund time value.
 /// @param refundTime_ The refund time value.
 /// @dev Should be bewteen 24h (provided by Chainlink) & 30 days.
 function setRefundTime(uint64 refundTime_) public nonReentrant onlyOwner {
 // 24h to 30d
 require(
 refundTime_ >= 86_400 && refundTime_ <= 2_592_000,
 "refundTime must be between 24 hours & 30 days"
 );
 uint64 oldRefundTime = refundTime;
 refundTime = refundTime_;
 emit SetRefundTime(oldRefundTime, refundTime_);
 }

 /// @notice Sets the Chainlink VRF V2.5 configuration.
 /// @param requestConfirmations How many confirmations the Chainlink node should wait before responding.
 /// @param keyHash Hash of the public key used to verify the VRF proof.
 /// @param chainlinkWrapper Chainlink Wrapper used to estimate the VRF cost.
 /// @param VRFCallbackGasExtraBet Callback gas to be added for each bet while multi betting.
 /// @param nativePayment Whether Betswirl pays VRF fees in gas token or in LINK token.
 function setChainlinkConfig(
 uint16 requestConfirmations,
 bytes32 keyHash,
 IVRFV2PlusWrapperCustom chainlinkWrapper,
 uint32 VRFCallbackGasExtraBet,
 bool nativePayment
 ) external nonReentrant onlyOwner {
 if (address(chainlinkWrapper) == address(0)) revert InvalidAddress();
 if (keyHash == 0) revert InvalidParam();

 _chainlinkConfig.requestConfirmations = requestConfirmations;
 _chainlinkConfig.keyHash = keyHash;
 _chainlinkConfig.chainlinkWrapper = chainlinkWrapper;
 _chainlinkConfig.VRFCallbackGasExtraBet = VRFCallbackGasExtraBet;
 _chainlinkConfig.nativePayment = nativePayment;

 emit SetChainlinkConfig(
 requestConfirmations,
 keyHash,
 chainlinkWrapper,
 VRFCallbackGasExtraBet,
 nativePayment
 );
 }

 /// @notice Sets the Chainlink VRF V2.5 configuration.
 /// @param callbackGasBase How much gas is needed in the Chainlink VRF callback.
 function setVRFCallbackGasBase(
 address token,
 uint32 callbackGasBase
 ) external nonReentrant onlyOwner {
 uint32 oldCallbackGasBase = tokens[token].VRFCallbackGasBase;
 tokens[token].VRFCallbackGasBase = callbackGasBase;
 emit SetVRFCallbackGasBase(token, oldCallbackGasBase, callbackGasBase);
 }

 /// @notice Refunds the bet to the receiver if the Chainlink VRF callback failed.
 /// @param id The Bet ID.
 /// @dev VRF fees are not refunded.
 function refundBet(uint256 id) external nonReentrant {
 Bet storage bet = bets[id];
 if (bet.resolved || bet.id == 0) {
 revert NotPendingBet();
 } else if (block.timestamp < bet.timestamp + refundTime) {
 revert NotFulfilled();
 }

 Token storage token = tokens[bet.token];
 unchecked {
 token.pendingCount--;
 }

 bet.resolved = true;
 bet.payout = bet.amount * bet.betCount;
 if (bet.token == address(0)) {
 _safeNativeTransfer(payable(bet.receiver), bet.payout);
 } else {
 IERC20(bet.token).safeTransfer(bet.receiver, bet.payout);
 }

 emit BetRefunded(id, bet.receiver, bet.payout);
 }

 /// @notice Distributes the token's collected Chainlink fees.
 /// @param token Address of the token.
 function withdrawTokenVRFFees(address token) external nonReentrant {
 uint256 tokenChainlinkFees = tokens[token].VRFFees;
 uint256 vrfSubId = tokens[token].vrfSubId;
 if (vrfSubId == 0) revert InvalidVRFSubId();
 if (tokenChainlinkFees != 0) {
 delete tokens[token].VRFFees;
 s_vrfCoordinator.fundSubscriptionWithNative{
 value: tokenChainlinkFees
 }(vrfSubId);
 emit DistributeTokenVRFFees(token, tokenChainlinkFees);
 }
 }

 /// @notice Returns the Chainlink VRF config.
 /// @param requestConfirmations How many confirmations the Chainlink node should wait before responding.
 /// @param keyHash Hash of the public key used to verify the VRF proof.
 /// @param chainlinkCoordinator Reference to the VRFCoordinatorV2Plus deployed contract.
 /// @param chainlinkWrapper Reference to the VRFV2PlusWrapper deployed contract.
 /// @param VRFCallbackGasExtraBet Callback gas to be added for each bet while multi betting.
 function getChainlinkConfig()
 external
 view
 returns (
 uint16 requestConfirmations,
 bytes32 keyHash,
 IVRFCoordinatorV2Plus chainlinkCoordinator,
 IVRFV2PlusWrapperCustom chainlinkWrapper,
 uint32 VRFCallbackGasExtraBet,
 bool nativePayment
 )
 {
 return (
 _chainlinkConfig.requestConfirmations,
 _chainlinkConfig.keyHash,
 s_vrfCoordinator,
 _chainlinkConfig.chainlinkWrapper,
 _chainlinkConfig.VRFCallbackGasExtraBet,
 _chainlinkConfig.nativePayment
 );
 }

 /// @notice Returns whether the token has pending bets.
 /// @return Whether the token has pending bets.
 function hasPendingBets(address token) public view returns (bool) {
 return tokens[token].pendingCount != 0;
 }

 /// @notice Returns the amount of ETH that should be passed to the wager transaction.
 /// to cover Chainlink VRF fee.
 /// @param token Address of the token.
 /// @param betCount The number of bets to place.
 /// @return The bet resolution cost amount.
 /// @dev The user always pays VRF fees in gas token, whatever we pay in gas token or in LINK on our side.
 function getChainlinkVRFCost(
 address token,
 uint16 betCount
 ) public view returns (uint256) {
 IVRFV2PlusWrapperCustom chainlinkWrapper = _chainlinkConfig
 .chainlinkWrapper;
 (, , , , uint256 wrapperGasOverhead, , , , , , , ) = chainlinkWrapper
 .getConfig();
 uint256 gas = tx.gasprice;
 return
 chainlinkWrapper.estimateRequestPriceNative(
 _getCallbackGasLimit(token, betCount),
 _chainlinkConfig.numRandomWords,
 gas
 ) - (gas * wrapperGasOverhead);
 }

 /// @notice Calculate the total callback gas limit based on the token + betCount.
 /// @param token Address of the token.
 /// @param betCount The number of bets to place.
 /// @return The total VRF callback gas limit.
 /// @dev The first bet is already included in the VRFCallbackGasBase.
 function _getCallbackGasLimit(
 address token,
 uint16 betCount
 ) private view returns (uint32) {
 return
 tokens[token].VRFCallbackGasBase +
 (
 betCount > 1
 ? betCount *
 _chainlinkConfig.VRFCallbackGasExtraBet +
 EXTRA_MULTIBET_GAS
 : 0
 );
 }
}
