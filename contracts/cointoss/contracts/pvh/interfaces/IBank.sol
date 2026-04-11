// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {IAccessControlEnumerable} from "@openzeppelin/contracts/access/IAccessControlEnumerable.sol";

/// @notice Defines common functionalities used across IBankAdmin & IBankAffiliate interfaces.
interface IBankCommon {
 /// @notice Reverting error when trying to do an action with a non added token.
 error TokenNotExists();

 /// @notice Reverting error when param is not valid or not in range
 error InvalidParam();

 /// @notice Reverting error when team wallet or treasury is the zero address.
 error InvalidAddress();
}

/// @notice Defines affiliate functionalities, essentially withdrawing house edge amount.
interface IBankAffiliate is IBankCommon {
 /// @notice Emitted after the token's affiliate allocation is distributed.
 /// @param token Address of the token.
 /// @param affiliate Address of the affiliate.
 /// @param affiliateAmount The number of tokens sent to the affiliate.
 event AffiliateRevenuesDistribution(
 address indexed token,
 address affiliate,
 uint256 affiliateAmount
 );

 /// @notice Distributes the token's affiliate allocation amount.
 /// @param tokenAddress Address of the token.
 /// @param to Address on which to send the tokens.
 function withdrawAffiliateRevenues(
 address tokenAddress,
 address to
 ) external;
}

/// @notice Defines administrative functionalities.
interface IBankAdmin is IBankCommon {
 /// @notice Emitted after the team wallet is set.
 /// @notice previousTeamWallet Old team wallet address.
 /// @param teamWallet The team wallet address.
 event SetTeamWallet(address previousTeamWallet, address teamWallet);

 /// @notice Emitted after the max call gas is set.
 /// @param previousMaxCallGas The old max call gas value.
 /// @param maxCallGas The max call gas value.
 event SetMaxCallGas(uint256 previousMaxCallGas, uint256 maxCallGas);

 /// @notice Emitted after a token is added or removed.
 /// @param token Address of the token.
 /// @param added Whether the token must be added or removed.
 event AddToken(address token, bool added);

 /// @notice Emitted after the token's house edge allocations for bet payout is set.
 /// @param token Address of the token.
 /// @param bank Rate to be allocated to the bank, on bet payout.
 /// @param dividend Rate to be allocated as staking rewards, on bet payout.
 /// @param affiliate Rate to be allocated to the affiliate, on bet payout.
 /// @param treasury Rate to be allocated to the treasury, on bet payout.
 /// @param team Rate to be allocated to the team, on bet payout.
 event SetTokenHouseEdgeSplit(
 address indexed token,
 uint16 bank,
 uint16 dividend,
 uint16 affiliate,
 uint16 treasury,
 uint16 team
 );

 /// @notice Emitted after a token is allowed.
 /// @param token Address of the token.
 /// @param allowed Whether the token is allowed for betting.
 event SetAllowedToken(address indexed token, bool allowed);

 /// @notice Emitted after the token's treasury and team allocations are distributed.
 /// @param token Address of the token.
 /// @param treasuryAmount The number of tokens sent to the treasury.
 /// @param teamAmount The number of tokens sent to the team.
 event ProtocolRevenuesDistribution(
 address indexed token,
 uint256 treasuryAmount,
 uint256 teamAmount
 );

 /// @notice Emitted after the token's dividend allocation is distributed.
 /// @param token Address of the token.
 /// @param amount The number of tokens sent to the dividend manager.
 event WithdrawDividend(address indexed token, uint256 amount);

 /// @notice Token's house edge allocations & splits struct.
 /// The games house edge is divided into several allocations and splits.
 /// The allocated amounts stays in the bank until authorized parties withdraw. They are subtracted from the balance.
 /// @param bank Rate to be allocated to the bank, on bet payout.
 /// @param dividend Rate to be allocated as staking rewards, on bet payout.
 /// @param affiliate Rate to be allocated to the affiliate, on bet payout.
 /// @param treasury Rate to be allocated to the treasury, on bet payout.
 /// @param team Rate to be allocated to the team, on bet payout.
 /// @param dividendAmount The number of tokens to be sent as staking rewards.
 /// @param affiliateAmount The total number of tokens to be sent to the affiliates.
 /// @param treasuryAmount The number of tokens to be sent to the treasury.
 /// @param teamAmount The number of tokens to be sent to the team.
 struct HouseEdgeSplitAndAllocation {
 uint16 bank;
 uint16 dividend;
 uint16 affiliate;
 uint16 treasury;
 uint16 team;
 uint256 dividendAmount;
 uint256 affiliateAmount;
 uint256 treasuryAmount;
 uint256 teamAmount;
 }
 /// @notice Token struct.
 /// List of tokens to bet on games.
 /// @param allowed Whether the token is allowed for bets.
 /// @param paused Whether the token is paused for bets.
 /// @param balanceRisk Defines the maximum bank payout, used to calculate the max bet amount.
 /// @param bankrollProvider Address of the bankroll manager to manage the token.
 /// @param pendingBankrollProvider Address of the elected new bankroll manager during transfer
 /// @param houseEdgeSplit House edge allocations.
 struct Token {
 bool allowed;
 bool paused;
 uint16 balanceRisk;
 address bankrollProvider;
 address pendingBankrollProvider;
 HouseEdgeSplitAndAllocation houseEdgeSplitAndAllocation;
 }

 /// @notice Token's metadata struct. It contains additional information from the ERC20 token.
 /// @dev Only used on the `getTokens` getter for the front-end.
 /// @param decimals Number of token's decimals.
 /// @param tokenAddress Contract address of the token.
 /// @param name Name of the token.
 /// @param symbol Symbol of the token.
 /// @param token Token data.
 struct TokenMetadata {
 uint8 decimals;
 address tokenAddress;
 string name;
 string symbol;
 Token token;
 }

 /// @notice Adds or removes a token that'll be visible for the games' betting.
 /// @param token Address of the token.
 /// @param added Whether the token must be added or removed.
 function addToken(address token, bool added) external;

 /// @notice Changes the token's bet permission.
 /// @param token Address of the token.
 /// @param allowed Whether the token is enabled for bets.
 function setAllowedToken(address token, bool allowed) external;

 /// @notice Sets the token's house edge allocations for bet payout.
 /// @param token Address of the token.
 /// @param bank Rate to be allocated to the bank, on bet payout.
 /// @param dividend Rate to be allocated as staking rewards, on bet payout.
 /// @param affiliate Rate to be allocated to the affiliate, on bet payout.
 /// @param treasury Rate to be allocated to the treasury, on bet payout.
 /// @param team Rate to be allocated to the team, on bet payout.
 /// @dev `bank`, `dividend`, `treasury` and `team` rates sum must equals 10000.
 function setHouseEdgeSplit(
 address token,
 uint16 bank,
 uint16 dividend,
 uint16 affiliate,
 uint16 treasury,
 uint16 team
 ) external;

 /// @notice Withdraws token dividends.
 /// @param tokenAddress Address of the token.
 function withdrawDividend(address tokenAddress) external;

 /// @notice Withdraws all tokens dividends.
 function withdrawDividends() external;

 /// @notice Sets the new team wallet.
 /// @param teamWallet_ The team wallet address.
 function setTeamWallet(address teamWallet_) external;

 /// @notice Sets the new max call gas value.
 /// @param maxCallGas_ The max call gas value.
 function setMaxCallGas(uint256 maxCallGas_) external;

 /// @notice Distributes the token's treasury and team allocations amounts.
 /// @param tokenAddress Address of the token.
 function withdrawProtocolRevenues(address tokenAddress) external;

 /// @notice Calculates the max bet amount based on the token balance, the balance risk, and the game multiplier.
 /// @param token Address of the token.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @return Maximum bet amount for the token.
 /// @dev The multiplier should be at least 10000 in theory.
 function getMaxBetAmount(
 address token,
 uint256 multiplier
 ) external view returns (uint256);

 /// @notice Reverting error when trying to add an existing token.
 error TokenExists();

 /// @notice Reverting error when setting the house edge allocations, but the sum isn't 100%.
 /// @param splitSum Sum of the house edge allocations rates.
 error WrongHouseEdgeSplit(uint16 splitSum);
}

/// @notice Defines bankroll provider functionalities.
interface IBankBankrollProvider {
 /// @notice Emitted after the balance risk is set.
 /// @param previousBalanceRisk Old balance risk value.
 /// @param balanceRisk Rate defining the balance risk.
 event SetBalanceRisk(
 address indexed token,
 uint16 previousBalanceRisk,
 uint16 balanceRisk
 );

 /// @notice Emitted after a token is paused.
 /// @param token Address of the token.
 /// @param paused Whether the token is paused for betting.
 event SetPausedToken(address indexed token, bool paused);

 /// @notice Emitted after a token deposit.
 /// @param token Address of the token.
 /// @param amount The number of token deposited.
 event Deposit(address indexed token, uint256 amount);

 /// @notice Emitted after a token withdrawal.
 /// @param token Address of the token.
 /// @param amount The number of token withdrawn.
 /// @param to who gets the funds.
 event Withdraw(address indexed token, uint256 amount, address indexed to);

 /// @notice emitted when starting a token's bankroll manager transfer
 /// @param token Address of the token.
 /// @param newBankrollProvider The new bankroll provider address.
 event TokenBankrollProviderTransferStarted(
 address token,
 address newBankrollProvider
 );

 /// @notice emitted when accepting a token's bankroll manager transfer
 /// @param token Address of the token.
 /// @param previousBankrollProvider Old bankroll provider address.
 /// @param bankrollProvider The bankroll provider address.
 event TokenBankrollProviderTransferAccepted(
 address token,
 address previousBankrollProvider,
 address bankrollProvider
 );

 /// @notice Deposit funds in the bank to allow gamers to win more.
 /// ERC20 token allowance should be given prior to deposit.
 /// @param token Address of the token.
 /// @param amount Number of tokens.
 function deposit(address token, uint256 amount) external payable;

 /// @notice Withdraw funds from the bank. Token has to be paused and no pending bet resolution on games.
 /// @param token Address of the token.
 /// @param amount Number of tokens.
 function withdraw(address token, uint256 amount) external;

 /// @notice Sets the new token balance risk.
 /// @param token Address of the token.
 /// @param balanceRisk Risk rate.
 function setBalanceRisk(address token, uint16 balanceRisk) external;

 /// @notice Changes the token's paused status.
 /// @param token Address of the token.
 /// @param paused Whether the token is paused.
 function setPausedToken(address token, bool paused) external;

 /// @notice Gets the token's bankrollProvider.
 /// @param token Address of the token.
 /// @return Address of the bankrollProvider.
 function getBankrollProvider(address token) external view returns (address);

 /// @notice starts a token's bankroll manager transfer
 /// @param token address to tranfer
 /// @param to sets the new bankroll manager
 function setTokenBankrollProviderTransfer(
 address token,
 address to
 ) external;

 /// @notice accepts a token's bankrollProvider transfer
 /// @param token address to tranfer
 function acceptTokenBankrollProviderTransfer(address token) external;

 /// @notice Reverting error when sender isn't allowed.
 error AccessDenied();

 /// @notice Reverting error when withdrawing a non paused token.
 error TokenNotPaused();

 /// @notice Reverting error when token has pending bets on a game.
 error TokenHasPendingBets();

 /// @notice Reverting error when value sent is not valid
 error InvalidValue();
}

/// @notice Defines functionalities used by game contracts.
interface IBankGame {
 /// @notice Emitted after the token's house edge is allocated.
 /// @param token Address of the token.
 /// @param bank The number of tokens allocated to bank.
 /// @param dividend The number of tokens allocated as staking rewards.
 /// @param treasury The number of tokens allocated to the treasury.
 /// @param team The number of tokens allocated to the team.
 /// @param affiliate The number of tokens allocated to the affiliate.
 /// @param affiliateAddress The address of the affiliate.
 event AllocateHouseEdgeAmount(
 address indexed token,
 uint256 bank,
 uint256 dividend,
 uint256 treasury,
 uint256 team,
 uint256 affiliate,
 address affiliateAddress
 );

 /// @notice Emitted after the bet profit amount is sent to the user.
 /// @param token Address of the token.
 /// @param newBalance New token balance.
 /// @param profit Bet profit amount sent.
 event Payout(address indexed token, uint256 newBalance, uint256 profit);

 /// @notice Emitted after the bet amount is collected from the game smart contract.
 /// @param token Address of the token.
 /// @param newBalance New token balance.
 /// @param amount Bet amount collected.
 event CashIn(address indexed token, uint256 newBalance, uint256 amount);

 /// @notice Payouts a winning bet, and allocate the house edge fee.
 /// @param user Address of the player.
 /// @param token Address of the token.
 /// @param profit Number of tokens to be sent to the player.
 /// @param fees Bet amount and bet profit fees amount.
 /// @param affiliate Address of the affiliate
 function payout(
 address user,
 address token,
 uint256 profit,
 uint256 fees,
 address affiliate
 ) external payable;

 /// @notice Accounts a loss bet.
 /// @dev In case of an ERC20, the bet amount should be transfered prior to this tx.
 /// @dev In case of the gas token, the bet amount is sent along with this tx.
 /// @param tokenAddress Address of the token.
 /// @param amount Loss bet amount.
 /// @param fees Bet amount and bet profit fees amount.
 /// @param affiliate Address of the affiliate
 function cashIn(
 address tokenAddress,
 uint256 amount,
 uint256 fees,
 address affiliate
 ) external payable;

 /// @notice Calculates the max bet amount based on the token balance, the balance risk, and the game multiplier.
 /// @param tokenAddress Address of the token.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @notice Gets the token's min bet amount.
 /// @return isAllowedToken Whether the token is enabled for bets.
 /// @return maxBetAmount Maximum bet amount for the token.
 /// @return maxBetCount Maximum bet count for the token/multiplier.
 /// @dev The multiplier should be at least 10000 in theory.
 function getBetRequirements(
 address tokenAddress,
 uint256 multiplier
 )
 external
 view
 returns (
 bool isAllowedToken,
 uint256 maxBetAmount,
 uint256 maxBetCount
 );

 /// @notice Gets the token's balance.
 /// The token's house edge allocation amounts are subtracted from the balance.
 /// @param token Address of the token.
 /// @return The amount of token available for profits.
 function getBalance(address token) external view returns (uint256);

 /// @notice Calculates the max bet count based the balance risk, and the game multiplier.
 /// The formula has been designed so that the player cannot win more than the entire bankroll
 /// in the case all their bets are won.
 /// @param token Address of the token.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @return Maximum bet count for the token/multiplier.
 /// @dev The multiplier should be at least 10000 in theory.
 function getMaxBetCount(
 address token,
 uint256 multiplier
 ) external view returns (uint256);
}

/// @notice Aggregates all functionalities from IBankAdmin, IBankBankrollProvider, IBankGame, IBankAffiliate & IAccessControlEnumerable interfaces.
interface IBank is
 IBankAdmin,
 IBankBankrollProvider,
 IBankGame,
 IBankAffiliate,
 IAccessControlEnumerable
{
 /// @dev For the front-end
 function getTokens() external view returns (TokenMetadata[] memory);
}
