// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import {IWrapped} from "../shared/interfaces/IWrapped.sol";
import {IBank} from "./interfaces/IBank.sol";
import {IGameBank} from "./interfaces/IGame.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {IERC20Metadata, IERC20} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/// @title BetSwirl's Bank
/// @author Romuald Hog
/// @notice The Bank contract holds the casino's funds,
/// whitelist the games betting tokens,
/// define the max bet amount based on a risk,
/// payout the bet profit to user and collect the loss bet amount from the game's contract,
/// split and allocate the house edge taken from each bet (won or loss).
/// Only the Games could payout the bet profit from the bank, and send the loss bet amount to the bank.
/// @dev All rates are in basis point.
contract Bank is AccessControlEnumerable, ReentrancyGuard, IBank {
 using SafeERC20 for IERC20;
 using EnumerableSet for EnumerableSet.AddressSet;

 /// @notice Treasury multi-sig wallet.
 address public immutable TREASURY_WALLET;

 /// @notice Team wallet.
 address public teamWallet;

 /// @notice Set the wrapped token in case of transfer issue
 IWrapped public immutable WRAPPED;

 /// @notice Role associated to Games smart contracts.
 bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

 /// @notice Role associated to dividend manager smart contract.
 bytes32 public constant DIVIDEND_MANAGER_ROLE =
 keccak256("DIVIDEND_MANAGER_ROLE");

 /// @notice Maps tokens addresses to token configuration.
 mapping(address => Token) public tokens;

 /// @notice Set of added tokens
 EnumerableSet.AddressSet private _tokensList;

 /// @notice Maps affiliate addresses to the affiliate's fees accumulated for each token (affiliate => token => amount).
 mapping(address => mapping(address => uint256)) public affiliateAmounts;

 uint256 constant BP_VALUE = 10_000;

 /// @notice Maximum gas to send to "call" function
 uint256 public maxCallGas;

 /// @notice Modifier that checks that an account is allowed to interact with a token.
 /// @param role The required role.
 /// @param token The token address.
 modifier onlyBankrollProvider(bytes32 role, address token) {
 address bankrollProvider = tokens[token].bankrollProvider;
 if (bankrollProvider == address(0)) {
 _checkRole(role, msg.sender);
 } else if (msg.sender != bankrollProvider) {
 revert AccessDenied();
 }
 _;
 }

 /// @notice Initialize the contract's admin role to the deployer, and state variables.
 /// @param treasuryAddress Treasury multi-sig wallet.
 /// @param teamWalletAddress Team wallet.
 /// @param wrappedGasToken Address of the wrapped gas token.
 /// @param maxCallGas_ Maximum call gas value.
 constructor(
 address treasuryAddress,
 address teamWalletAddress,
 address wrappedGasToken,
 uint256 maxCallGas_
 ) {
 if (treasuryAddress == address(0) || wrappedGasToken == address(0)) {
 revert InvalidAddress();
 }
 TREASURY_WALLET = treasuryAddress;
 WRAPPED = IWrapped(wrappedGasToken);

 // The ownership should then be transfered to a multi-sig.
 _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);

 setTeamWallet(teamWalletAddress);
 setMaxCallGas(maxCallGas_);
 }

 /// @notice Transfers a specific amount of token to an address.
 /// Uses native transfer or ERC20 transfer depending on the token.
 /// @dev The 0x address is considered the gas token.
 /// @param user Address of destination.
 /// @param token Address of the token.
 /// @param amount Number of tokens.
 function _safeTransfer(
 address user,
 address token,
 uint256 amount
 ) private {
 if (_isGasToken(token)) {
 (bool success, ) = user.call{value: amount, gas: maxCallGas}("");

 if (!success) {
 // Fallback to wrapped gas token in case of error
 WRAPPED.deposit{value: amount}();
 WRAPPED.transfer(user, amount);
 }
 } else {
 IERC20(token).safeTransfer(user, amount);
 }
 }

 /// @notice Check if the token has the 0x address.
 /// @param token Address of the token.
 /// @return Whether the token's address is the 0x address.
 function _isGasToken(address token) private pure returns (bool) {
 return token == address(0);
 }

 /// @notice Deposit funds in the bank to allow gamers to win more.
 /// ERC20 token allowance should be given prior to deposit.
 /// @param token Address of the token.
 /// @param amount Number of tokens.
 function deposit(
 address token,
 uint256 amount
 )
 external
 payable
 nonReentrant
 onlyBankrollProvider(DEFAULT_ADMIN_ROLE, token)
 {
 if (!_tokensList.contains(token)) {
 revert TokenNotExists();
 }
 if (_isGasToken(token)) {
 if (amount != msg.value) revert InvalidValue();
 } else {
 if (msg.value > 0) revert InvalidValue();
 IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
 }
 emit Deposit(token, amount);
 }

 /// @notice Withdraw funds from the bank. Token has to be paused and no pending bet resolution on games.
 /// @param token Address of the token.
 /// @param amount Number of tokens.
 function withdraw(
 address token,
 uint256 amount
 ) external nonReentrant onlyBankrollProvider(DEFAULT_ADMIN_ROLE, token) {
 uint256 balance = getBalance(token);
 if (balance != 0 && amount != 0) {
 if (!tokens[token].paused) {
 revert TokenNotPaused();
 }

 uint256 roleMemberCount = getRoleMemberCount(GAME_ROLE);
 for (uint256 i; i < roleMemberCount; ) {
 if (
 IGameBank(getRoleMember(GAME_ROLE, i)).hasPendingBets(token)
 ) {
 revert TokenHasPendingBets();
 }
 unchecked {
 ++i;
 }
 }

 if (amount > balance) {
 amount = balance;
 }
 _safeTransfer(msg.sender, token, amount);
 emit Withdraw(token, amount, msg.sender);
 }
 }

 /// @notice Sets the new token balance risk.
 /// @param token Address of the token.
 /// @param balanceRisk Risk rate.
 function setBalanceRisk(
 address token,
 uint16 balanceRisk
 ) external nonReentrant onlyBankrollProvider(DEFAULT_ADMIN_ROLE, token) {
 uint16 oldBalanceRisk = tokens[token].balanceRisk;
 tokens[token].balanceRisk = balanceRisk;
 emit SetBalanceRisk(token, oldBalanceRisk, balanceRisk);
 }

 /// @notice Adds or removes a token that'll be visible for the games' betting.
 /// @param token Address of the token.
 /// @param added Whether the token must be added or removed.
 function addToken(
 address token,
 bool added
 ) external onlyRole(DEFAULT_ADMIN_ROLE) {
 if (added) {
 if (!_tokensList.add(token)) revert TokenExists();
 } else {
 setAllowedToken(token, false);
 if (!_tokensList.remove(token)) revert TokenNotExists();
 }

 emit AddToken(token, added);
 }

 /// @notice Changes the token's bet permission.
 /// @param token Address of the token.
 /// @param allowed Whether the token is enabled for bets.
 function setAllowedToken(
 address token,
 bool allowed
 ) public nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
 if (!_tokensList.contains(token)) {
 revert TokenNotExists();
 }
 tokens[token].allowed = allowed;
 emit SetAllowedToken(token, allowed);
 }

 /// @notice Changes the token's paused status.
 /// @param token Address of the token.
 /// @param paused Whether the token is paused.
 function setPausedToken(
 address token,
 bool paused
 ) external nonReentrant onlyBankrollProvider(DEFAULT_ADMIN_ROLE, token) {
 if (!_tokensList.contains(token)) {
 revert TokenNotExists();
 }
 tokens[token].paused = paused;
 emit SetPausedToken(token, paused);
 }

 /// @notice Sets the token's house edge allocations for bet payout.
 /// @param token Address of the token.
 /// @param bank Rate to be allocated to the bank, on bet payout.
 /// @param dividend Rate to be allocated as staking rewards, on bet payout.
 /// @param affiliate Rate to be allocated to the affiliate, on bet payout.
 /// @param treasury Rate to be allocated to the treasury, on bet payout.
 /// @param team Rate to be allocated to the team, on bet payout.
 /// @dev `bank`, `dividend`, `_treasury` and `team` rates sum must equals 10000.
 function setHouseEdgeSplit(
 address token,
 uint16 bank,
 uint16 dividend,
 uint16 affiliate,
 uint16 treasury,
 uint16 team
 ) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
 uint16 splitSum = bank + dividend + team + affiliate + treasury;
 if (splitSum != BP_VALUE) {
 revert WrongHouseEdgeSplit(splitSum);
 }

 HouseEdgeSplitAndAllocation storage tokenHouseEdge = tokens[token]
 .houseEdgeSplitAndAllocation;
 tokenHouseEdge.bank = bank;
 tokenHouseEdge.dividend = dividend;
 tokenHouseEdge.affiliate = affiliate;
 tokenHouseEdge.treasury = treasury;
 tokenHouseEdge.team = team;

 emit SetTokenHouseEdgeSplit(
 token,
 bank,
 dividend,
 affiliate,
 treasury,
 team
 );
 }

 /// @notice Withdraws token dividends.
 /// @param tokenAddress Address of the token.
 function withdrawDividend(
 address tokenAddress
 ) public nonReentrant onlyRole(DIVIDEND_MANAGER_ROLE) {
 Token storage token = tokens[tokenAddress];
 uint256 dividendAmount = token
 .houseEdgeSplitAndAllocation
 .dividendAmount;
 if (dividendAmount != 0) {
 /* Set to 0 and not deleted to avoid to re-init the amount in _allocateHouseEdge each time
 after the dividends have been withdrawn. */
 token.houseEdgeSplitAndAllocation.dividendAmount = 0;
 _safeTransfer(msg.sender, tokenAddress, dividendAmount);
 emit WithdrawDividend(tokenAddress, dividendAmount);
 }
 }

 /// @notice Withdraws all tokens dividends.
 function withdrawDividends() external onlyRole(DIVIDEND_MANAGER_ROLE) {
 uint256 tokensCount = _tokensList.length();
 for (uint256 i; i < tokensCount; ) {
 withdrawDividend(_tokensList.at(i));
 unchecked {
 ++i;
 }
 }
 }

 /// @notice Splits the house edge fees and allocates them as dividends, the bank, the treasury, the team and the affiliate.
 /// @param token Address of the token.
 /// @param fees Bet amount and bet profit fees amount.
 /// @param affiliate Address of the affiliate
 function _allocateHouseEdge(
 address token,
 uint256 fees,
 address affiliate
 ) private {
 HouseEdgeSplitAndAllocation storage tokenHouseEdge = tokens[token]
 .houseEdgeSplitAndAllocation;
 uint256 affiliateAmount;
 uint16 affiliateSplit = tokenHouseEdge.affiliate;
 if (affiliateSplit != 0) {
 affiliateAmount = ((fees * affiliateSplit) / BP_VALUE);
 tokenHouseEdge.affiliateAmount += affiliateAmount;
 affiliateAmounts[affiliate][token] += affiliateAmount;
 }

 uint256 dividendAmount = (fees * tokenHouseEdge.dividend) / BP_VALUE;
 tokenHouseEdge.dividendAmount += dividendAmount;

 uint256 treasuryAmount = (fees * tokenHouseEdge.treasury) / BP_VALUE;
 tokenHouseEdge.treasuryAmount += treasuryAmount;

 uint256 teamAmount = (fees * tokenHouseEdge.team) / BP_VALUE;
 tokenHouseEdge.teamAmount += teamAmount;

 emit AllocateHouseEdgeAmount(
 token,
 // The bank also get allocated a share of the house edge.
 fees -
 affiliateAmount -
 dividendAmount -
 treasuryAmount -
 teamAmount,
 dividendAmount,
 treasuryAmount,
 teamAmount,
 affiliateAmount,
 affiliate
 );
 }

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
 ) external payable onlyRole(GAME_ROLE) {
 _allocateHouseEdge(token, fees, affiliate);

 // Pay the user
 if (profit != 0) _safeTransfer(user, token, profit);
 emit Payout(token, getBalance(token), profit);
 }

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
 ) external payable onlyRole(GAME_ROLE) {
 if (fees != 0) {
 _allocateHouseEdge(tokenAddress, fees, affiliate);
 }

 emit CashIn(tokenAddress, getBalance(tokenAddress), amount);
 }

 /// @dev For the front-end
 function getTokens() external view returns (TokenMetadata[] memory) {
 uint256 tokensCount = _tokensList.length();
 TokenMetadata[] memory _tokens = new TokenMetadata[](tokensCount);
 for (uint256 i; i < tokensCount; ) {
 address tokenAddress = _tokensList.at(i);
 Token memory token = tokens[tokenAddress];
 if (_isGasToken(tokenAddress)) {
 _tokens[i] = TokenMetadata({
 decimals: 18,
 tokenAddress: tokenAddress,
 name: "ETH",
 symbol: "ETH",
 token: token
 });
 } else {
 IERC20Metadata erc20Metadata = IERC20Metadata(tokenAddress);
 _tokens[i] = TokenMetadata({
 decimals: erc20Metadata.decimals(),
 tokenAddress: tokenAddress,
 name: erc20Metadata.name(),
 symbol: erc20Metadata.symbol(),
 token: token
 });
 }
 unchecked {
 ++i;
 }
 }
 return _tokens;
 }

 /// @notice Calculates the max bet amount based on the token balance, the balance risk, and the game multiplier.
 /// @param token Address of the token.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @return Maximum bet amount for the token.
 /// @dev The multiplier must be at least 10000.
 function getMaxBetAmount(
 address token,
 uint256 multiplier
 ) public view returns (uint256) {
 if (multiplier < BP_VALUE) revert InvalidParam();
 return (getBalance(token) * tokens[token].balanceRisk) / multiplier;
 }

 /// @notice Calculates the max bet count based the balance risk, and the game multiplier.
 /// The formula has been designed so that the player cannot win more than the entire bankroll
 /// in the case all their bets are won.
 /// @param token Address of the token.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @return Maximum bet count for the token/multiplier.
 /// @dev The multiplier must be at least 10000.
 function getMaxBetCount(
 address token,
 uint256 multiplier
 ) public view returns (uint256) {
 return
 (BP_VALUE * multiplier) /
 ((multiplier - BP_VALUE) * tokens[token].balanceRisk);
 }

 /// @notice Calculates the max bet amount based on the token balance, the balance risk, and the game multiplier.
 /// @param tokenAddress Address of the token.
 /// @param multiplier The bet amount leverage determines the user's profit amount. 10000 = 100% = no profit.
 /// @notice Gets the token's min bet amount.
 /// @return isAllowedToken Whether the token is enabled for bets.
 /// @return maxBetAmount Maximum bet amount for the token.
 /// @return maxBetCount Maximum bet count for the token/multiplier.
 /// @dev The multiplier must be at least 10000.
 function getBetRequirements(
 address tokenAddress,
 uint256 multiplier
 )
 external
 view
 returns (bool isAllowedToken, uint256 maxBetAmount, uint256 maxBetCount)
 {
 // More gas efficent to not store tokens[tokenAddress] in memory.
 isAllowedToken =
 tokens[tokenAddress].allowed &&
 !tokens[tokenAddress].paused;

 maxBetAmount = getMaxBetAmount(tokenAddress, multiplier);
 maxBetCount = getMaxBetCount(tokenAddress, multiplier);
 }

 /// @notice Gets the token's bankrollProvider.
 /// @param token Address of the token.
 /// @return Address of the bankrollProvider.
 function getBankrollProvider(
 address token
 ) external view returns (address) {
 address bankrollProvider = tokens[token].bankrollProvider;
 if (bankrollProvider == address(0)) {
 return getRoleMember(DEFAULT_ADMIN_ROLE, 0);
 } else {
 return bankrollProvider;
 }
 }

 /// @notice Sets the new team wallet.
 /// @param teamWallet_ The team wallet address.
 function setTeamWallet(
 address teamWallet_
 ) public nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
 if (teamWallet_ == address(0)) {
 revert InvalidAddress();
 }
 address oldTeamWallet = teamWallet;
 teamWallet = teamWallet_;
 emit SetTeamWallet(oldTeamWallet, teamWallet);
 }

 /// @notice Sets the new max call gas value.
 /// @param maxCallGas_ The max call gas value.
 function setMaxCallGas(
 uint256 maxCallGas_
 ) public nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
 if (maxCallGas_ == 0) {
 revert InvalidParam();
 }
 uint256 oldMaxCallGas = maxCallGas;
 maxCallGas = maxCallGas_;
 emit SetMaxCallGas(oldMaxCallGas, maxCallGas_);
 }

 /// @notice Distributes the token's treasury and team allocations amounts.
 /// @param tokenAddress Address of the token.
 function withdrawProtocolRevenues(
 address tokenAddress
 ) external nonReentrant onlyRole(DEFAULT_ADMIN_ROLE) {
 HouseEdgeSplitAndAllocation storage tokenHouseEdge = tokens[
 tokenAddress
 ].houseEdgeSplitAndAllocation;
 uint256 treasuryAmount = tokenHouseEdge.treasuryAmount;
 if (treasuryAmount != 0) {
 /* Set to 0 and not deleted to avoid to re-init the amount in _allocateHouseEdge each time
 after the protocol revenues have been withdrawn. */ tokenHouseEdge
 .treasuryAmount = 0;
 _safeTransfer(TREASURY_WALLET, tokenAddress, treasuryAmount);
 }
 uint256 teamAmount = tokenHouseEdge.teamAmount;
 if (teamAmount != 0) {
 /* Set to 0 and not deleted to avoid to re-init the amount in _allocateHouseEdge each time
 after the protocol revenues have been withdrawn. */
 tokenHouseEdge.teamAmount = 0;
 _safeTransfer(teamWallet, tokenAddress, teamAmount);
 }
 if (treasuryAmount != 0 || teamAmount != 0) {
 emit ProtocolRevenuesDistribution(
 tokenAddress,
 treasuryAmount,
 teamAmount
 );
 }
 }

 /// @notice Distributes the token's affiliate allocation amount.
 /// @param tokenAddress Address of the token.
 /// @param to Address on which to send the tokens.
 function withdrawAffiliateRevenues(
 address tokenAddress,
 address to
 ) external nonReentrant {
 if (to == address(0)) revert InvalidAddress();
 Token storage token = tokens[tokenAddress];
 address affiliate = msg.sender;
 uint256 affiliateAmount = affiliateAmounts[affiliate][tokenAddress];
 if (affiliateAmount != 0) {
 /* Set to 0 and not deleted to avoid to re-init the amount in _allocateHouseEdge each time
 after the affiliate revenues have been withdrawn. */
 affiliateAmounts[affiliate][tokenAddress] = 0;
 token
 .houseEdgeSplitAndAllocation
 .affiliateAmount -= affiliateAmount;
 _safeTransfer(to, tokenAddress, affiliateAmount);

 emit AffiliateRevenuesDistribution(
 tokenAddress,
 affiliate,
 affiliateAmount
 );
 }
 }

 /// @notice Gets the token's balance.
 /// The token's house edge allocation amounts are subtracted from the balance.
 /// @param token Address of the token.
 /// @return The amount of token available for profits.
 function getBalance(address token) public view returns (uint256) {
 uint256 balance;
 if (_isGasToken(token)) {
 balance = address(this).balance;
 } else {
 balance = IERC20(token).balanceOf(address(this));
 }
 // More gas efficent to not store tokens[token].houseEdgeSplitAndAllocation in memory.
 return
 balance -
 tokens[token].houseEdgeSplitAndAllocation.dividendAmount -
 tokens[token].houseEdgeSplitAndAllocation.treasuryAmount -
 tokens[token].houseEdgeSplitAndAllocation.teamAmount -
 tokens[token].houseEdgeSplitAndAllocation.affiliateAmount;
 }

 /// @notice Starts a token's bankroll manager transfer
 /// @param token address to tranfer
 /// @param to sets the new bankroll manager
 function setTokenBankrollProviderTransfer(
 address token,
 address to
 ) external nonReentrant onlyBankrollProvider(DEFAULT_ADMIN_ROLE, token) {
 tokens[token].pendingBankrollProvider = to;
 emit TokenBankrollProviderTransferStarted(token, to);
 }

 /// @notice Accepts a token's bankrollProvider transfer
 /// @param token address to tranfer
 function acceptTokenBankrollProviderTransfer(
 address token
 ) external nonReentrant {
 if (msg.sender != tokens[token].pendingBankrollProvider)
 revert AccessDenied();
 address oldBankrollProvider = tokens[token].bankrollProvider;
 tokens[token].bankrollProvider = tokens[token].pendingBankrollProvider;
 delete tokens[token].pendingBankrollProvider;

 emit TokenBankrollProviderTransferAccepted(
 token,
 oldBankrollProvider,
 tokens[token].bankrollProvider
 );
 }
}
