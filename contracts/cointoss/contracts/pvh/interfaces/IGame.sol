// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {IVRFV2PlusWrapperCustom} from "../../shared/interfaces/IVRFV2PlusWrapperCustom.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {IVRFMigratableConsumerV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFMigratableConsumerV2Plus.sol";
import {IOwnable} from "@chainlink/contracts/src/v0.8/shared/interfaces/IOwnable.sol";

/// @notice Defines common functionalities used across IGameAdmin, IGameAffiliate & IGamePlayer interfaces.
interface IGameCommon {
 /// @notice Reverting error when token has pending bets.
 error TokenHasPendingBets();

 /// @notice Reverting error when house edge is too high (setHouseEdge & newBet)
 error HouseEdgeTooHigh();
}

/// @notice Defines administrative functionalities.
interface IGameAdmin is IVRFMigratableConsumerV2Plus, IOwnable, IGameCommon {
 /// @notice Emitted after the house edge is set for a token.
 /// @param token Address of the token.
 /// @param previousHouseEdge Old house edge rate.
 /// @param houseEdge House edge rate.
 event SetHouseEdge(
 address indexed token,
 uint16 previousHouseEdge,
 uint16 houseEdge
 );

 /// @notice Emitted after the Chainlink base callback gas is set for a token.
 /// @param token Address of the token.
 /// @param previousCallbackGasBase Previous Chainlink VRF base callback gas.
 /// @param callbackGasBase New Chainlink VRF base callback gas.
 event SetVRFCallbackGasBase(
 address indexed token,
 uint32 previousCallbackGasBase,
 uint32 callbackGasBase
 );

 /// @notice Emitted after the token's VRF subscription ID is set.
 /// @param token Address of the token.
 /// @param previousSubId Previous subscription ID.
 /// @param subId Subscription ID.
 event SetVRFSubId(
 address indexed token,
 uint256 previousSubId,
 uint256 subId
 );

 /// @notice Emitted after the max call gas is set.
 /// @param previousMaxCallGas The previous max call gas value.
 /// @param maxCallGas The max call gas value.
 event SetMaxCallGas(uint256 previousMaxCallGas, uint256 maxCallGas);

 /// @notice Emitted after the refund time is set.
 /// @param previousRefundTime The previous refund yime value.
 /// @param refundTime The refund time value.
 event SetRefundTime(uint64 previousRefundTime, uint64 refundTime);

 /// @notice Emitted after the Chainlink config is set.
 /// @param requestConfirmations How many confirmations the Chainlink node should wait before responding.
 /// @param keyHash Hash of the public key used to verify the VRF proof.
 /// @param chainlinkWrapper Chainlink Wrapper used to estimate the VRF cost.
 /// @param VRFCallbackGasExtraBet Callback gas to be added for each bet while multi betting.
 /// @param nativePayment Whether Betswirl pays VRF fees in gas token or in LINK token.
 event SetChainlinkConfig(
 uint16 requestConfirmations,
 bytes32 keyHash,
 IVRFV2PlusWrapperCustom chainlinkWrapper,
 uint32 VRFCallbackGasExtraBet,
 bool nativePayment
 );

 /// @notice Emitted after the token's VRF fees amount is transfered to the user.
 /// @param token Address of the token.
 /// @param amount Token amount refunded.
 event DistributeTokenVRFFees(address indexed token, uint256 amount);

 /// @notice Chainlink VRF configuration struct.
 /// @param requestConfirmations How many confirmations the Chainlink node should wait before responding.
 /// @param numRandomWords How many random words is needed to resolve a game's bet.
 /// @param keyHash Hash of the public key used to verify the VRF proof.
 /// @param chainlinkWrapper Chainlink Wrapper used to estimate the VRF cost
 /// @param VRFCallbackGasExtraBet Callback gas to be added for each bet while multi betting.
 /// @param nativePayment Whether Betswirl pays VRF fees in gas token or in LINK token.
 struct ChainlinkConfig {
 uint16 requestConfirmations;
 uint16 numRandomWords;
 bytes32 keyHash;
 IVRFV2PlusWrapperCustom chainlinkWrapper;
 uint32 VRFCallbackGasExtraBet;
 bool nativePayment;
 }

 /// @notice Token struct.
 /// @param houseEdge House edge rate.
 /// @param pendingCount Number of pending bets.
 /// @param vrfSubId Chainlink VRF v2.5 subscription ID.
 /// @param VRFCallbackGasBase How much gas is needed in the Chainlink VRF callback.
 /// @param VRFFees Chainlink's VRF collected fees amount.
 struct Token {
 uint16 houseEdge;
 uint64 pendingCount;
 uint256 vrfSubId;
 uint32 VRFCallbackGasBase;
 uint256 VRFFees;
 }

 /// @notice Sets the game house edge rate for a specific token.
 /// @param token Address of the token.
 /// @param houseEdge House edge rate.
 function setHouseEdge(address token, uint16 houseEdge) external;

 /// @notice Pauses/Unpauses the contract to disable/enable new bets.
 function togglePause() external;

 /// @notice Sets the Chainlink VRF subscription ID for a specific token.
 /// @param token Address of the token.
 /// @param subId Subscription ID.
 function setVRFSubId(address token, uint256 subId) external;

 /// @notice Sets the new max call gas value.
 /// @param maxCallGas_ The max call gas value.
 function setMaxCallGas(uint256 maxCallGas_) external;

 /// @notice Sets the new refund time value.
 /// @param refundTime_ The refund time value.
 /// @dev Should be bewteen 24h (provided by Chainlink) & 30 days.
 function setRefundTime(uint64 refundTime_) external;

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
 ) external;

 /// @notice Sets the Chainlink VRF V2.5 configuration.
 /// @param callbackGasBase How much gas is needed in the Chainlink VRF callback.
 function setVRFCallbackGasBase(
 address token,
 uint32 callbackGasBase
 ) external;

 /// @notice Distributes the token's collected Chainlink fees.
 /// @param token Address of the token.
 function withdrawTokenVRFFees(address token) external;

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
 );

 /// @notice Reverting error when max call gas value is not valid.
 error InvalidMaxCallGas();

 /// @notice Reverting error when calling withdrawTokenVRFFees with a token for which VRF sub ID is not set.
 error InvalidVRFSubId();

 /// @notice Reverting when calling setChainlinkConfig with wrong requestConfirmations or keyHash value
 error InvalidParam();
}

/// @notice Defines affiliate functionalities, essentially setting house edge.
interface IGameAffiliate is IGameCommon {
 /// @notice Emitted after the affiliate's house edge is set for a token.
 /// @param token Address of the token.
 /// @param affiliate Address of the affiliate.
 /// @param previousHouseEdge Previous affiliate's house edge rate.
 /// @param houseEdge Affiliate's house edge rate.
 event SetAffiliateHouseEdge(
 address indexed token,
 address affiliate,
 uint16 previousHouseEdge,
 uint16 houseEdge
 );

 /// @notice Sets the game affiliate's house edge rate for a specific token.
 /// @param token Address of the token.
 /// @param affiliateHouseEdge Affiliate's house edge rate.
 /// @dev The msg.sender of the tx is considered as to be the affiliate.
 function setAffiliateHouseEdge(
 address token,
 uint16 affiliateHouseEdge
 ) external;

 /// @notice Reverting error when sender isn't allowed.
 error AccessDenied();

 /// @notice Reverting error when house edge is too low
 error HouseEdgeTooLow();
}

/// @notice Defines functionalities used by the bank contract.
interface IGameBank {
 /// @notice Returns whether the token has pending bets.
 /// @return Whether the token has pending bets.
 function hasPendingBets(address token) external view returns (bool);
}

/// @notice Defines player functionalities, essentially wagering & refunding a bet.
interface IGamePlayer {
 /// @notice Bet configuration struct.
 /// @param token Address of the token.
 /// @param betAmount The amount per bet.
 /// @param betCount How many bets at maximum must be placed.
 /// @param stopGain Profit limit indicating that bets must stop after surpassing it (before deduction of house edge).
 /// @param stopLoss Loss limit indicating that bets must stop after exceeding it (before deduction of house edge).
 /// @param maxHouseEdge Maximum authorized house edge.
 struct BetData {
 address token;
 uint256 betAmount;
 uint16 betCount;
 uint256 stopGain;
 uint256 stopLoss;
 uint16 maxHouseEdge;
 }

 /// @notice Bet information struct.
 /// @param resolved Whether the bet has been resolved.
 /// @param receiver Address of the receiver.
 /// @param token Address of the token.
 /// @param id Bet ID generated by Chainlink VRF.
 /// @param amount The bet amount.
 /// @param houseEdge The house ege.
 /// @param timestamp of the bet used to refund in case Chainlink's callback fail.
 /// @param payout The payout amount.
 /// @param betCount How many bets at maximum must be placed.
 /// @param stopGain Profit limit indicating that bets must stop after surpassing it (before deduction of house edge).
 /// @param stopLoss Loss limit indicating that bets must stop after surpassing it (before deduction of house edge).
 /// @param affiliate Address of the affiliate.
 struct Bet {
 bool resolved;
 address receiver;
 address token;
 uint256 id;
 uint256 amount;
 uint16 houseEdge;
 uint32 timestamp;
 uint256 payout;
 uint16 betCount;
 uint256 stopGain;
 uint256 stopLoss;
 address affiliate;
 }

 /// @notice Emitted after the bet amount is transfered to the user.
 /// @param id The bet ID.
 /// @param user Address of the player.
 /// @param amount Token amount refunded.
 event BetRefunded(uint256 id, address user, uint256 amount);

 /// @notice Refunds the bet to the receiver if the Chainlink VRF callback failed.
 /// @param id The Bet ID.
 function refundBet(uint256 id) external;

 /// @notice Returns the amount of ETH that should be passed to the wager transaction.
 /// to cover Chainlink VRF fee.
 /// @param token Address of the token.
 /// @param betCount The number of bets to place.
 /// @return The bet resolution cost amount.
 /// @dev The user always pays VRF fees in gas token, whatever we pay in gas token or in LINK on our side.
 function getChainlinkVRFCost(
 address token,
 uint16 betCount
 ) external view returns (uint256);

 /// @notice Get the affiliate's house edge. If the affiliate has not their own house edge,
 /// then it takes the default house edge.
 /// @param affiliate Address of the affiliate.
 /// @param token Address of the token.
 /// @return The affiliate's house edge.
 function getAffiliateHouseEdge(
 address affiliate,
 address token
 ) external view returns (uint16);

 /// @notice Insufficient bet amount.
 /// @param minBetAmount Bet amount.
 error UnderMinBetAmount(uint256 minBetAmount);

 /// @notice Reverting error when provided betCount isn't valid.
 error UnderMinBetCount(uint256 minBetCount);

 /// @notice Bet count provided is too high.
 /// @param maxBetCount Maximum bet count.
 error BetCountTooHigh(uint256 maxBetCount);

 /// @notice Bet provided doesn't exist or was already resolved.
 error NotPendingBet();

 /// @notice Bet isn't resolved yet.
 error NotFulfilled();

 /// @notice Token is not allowed.
 error ForbiddenToken();

 /// @notice The msg.value is not enough to cover Chainlink's fee.
 error WrongGasValueToCoverVRFFee();

 /// @notice Reverting error when provided address isn't valid.
 error InvalidAddress();
}

/// @notice Aggregates all functionalities from IGameAdmin, IGameBank, IGameAffiliate & IGamePlayer interfaces.
interface IGame is IGameAdmin, IGameBank, IGameAffiliate, IGamePlayer {

}
