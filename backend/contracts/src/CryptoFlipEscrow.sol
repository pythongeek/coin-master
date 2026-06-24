// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title CryptoFlipEscrow
 * @dev Provably fair crypto coin flip escrow contract
 *      Handles user deposits, bet locking, settlement, and withdrawals.
 *      House treasury is protected by multi-sig (HOUSE_KEEPER_ROLE).
 */
contract CryptoFlipEscrow is ReentrancyGuard, AccessControl, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant HOUSE_KEEPER_ROLE = keccak256("HOUSE_KEEPER_ROLE");

    // ─── STATE ─────────────────────────────────────────────

    mapping(address => uint256) public balances;
    mapping(address => uint256) public lockedBalances;

    // House treasury
    address public immutable houseTreasury;
    uint256 public houseBalance;
    uint256 public totalVolume;

    // Safety limits
    uint256 public maxWithdrawalPerTx = 100 ether;
    uint256 public maxDailyWithdrawalPerUser = 500 ether;
    mapping(address => uint256) public dailyWithdrawn;
    mapping(address => uint256) public lastWithdrawalDay;

    // Events
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event BetLocked(address indexed user, uint256 amount, bytes32 indexed betId);
    event BetSettled(address indexed user, bytes32 indexed betId, bool won, uint256 payout, uint256 houseFee);
    event HouseFeeCollected(uint256 amount);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);
    event HouseKeeperWithdrawal(address indexed to, uint256 amount);
    event LimitsUpdated(uint256 maxPerTx, uint256 maxDailyPerUser);

    // ─── CONSTRUCTOR ───────────────────────────────────────

    constructor(address admin, address operator, address _houseTreasury) {
        require(_houseTreasury != address(0), "CE: Invalid treasury");

        houseTreasury = _houseTreasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, operator);
        _grantRole(HOUSE_KEEPER_ROLE, admin);
    }

    // ─── USER FUNCTIONS ───────────────────────────────────

    /**
     * @notice Deposit ETH into the contract.
     */
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "CE: Zero deposit");

        balances[msg.sender] += msg.value;

        emit Deposited(msg.sender, msg.value, balances[msg.sender]);
    }

    /**
     * @notice Withdraw ETH from the contract.
     * @param amount The amount to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "CE: Zero withdrawal");
        require(balances[msg.sender] >= amount, "CE: Insufficient balance");
        require(lockedBalances[msg.sender] == 0, "CE: Active bets locked");

        // Safety limits
        require(amount <= maxWithdrawalPerTx, "CE: Exceeds max per tx");

        uint256 currentDay = block.timestamp / 1 days;
        if (currentDay > lastWithdrawalDay[msg.sender]) {
            dailyWithdrawn[msg.sender] = 0;
            lastWithdrawalDay[msg.sender] = currentDay;
        }
        require(dailyWithdrawn[msg.sender] + amount <= maxDailyWithdrawalPerUser, "CE: Exceeds daily limit");

        balances[msg.sender] -= amount;
        dailyWithdrawn[msg.sender] += amount;

        (bool success,) = payable(msg.sender).call{value: amount}("");
        require(success, "CE: Transfer failed");

        emit Withdrawn(msg.sender, amount, balances[msg.sender]);
    }

    // ─── OPERATOR FUNCTIONS ───────────────────────────────

    /**
     * @notice Lock bet amount from user balance.
     * @param user The user address.
     * @param amount The bet amount.
     * @param betId Unique bet identifier.
     */
    function lockBet(address user, uint256 amount, bytes32 betId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        require(balances[user] >= amount, "CE: Insufficient balance");
        require(lockedBalances[user] + amount <= balances[user], "CE: Lock exceeds balance");

        balances[user] -= amount;
        lockedBalances[user] += amount;

        emit BetLocked(user, amount, betId);
    }

    /**
     * @notice Settle a bet — credit winnings or keep house fee.
     * @param user The user address.
     * @param betId The bet identifier.
     * @param won Whether the user won.
     * @param payout The payout amount (including original bet if won).
     * @param houseFee The house fee deducted.
     */
    function settleBet(address user, bytes32 betId, bool won, uint256 payout, uint256 houseFee)
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
    {
        require(lockedBalances[user] >= payout, "CE: Insufficient locked balance");

        lockedBalances[user] -= payout;

        if (won) {
            balances[user] += payout;
        } else {
            houseBalance += payout; // House keeps the loss
        }

        houseBalance += houseFee;
        totalVolume += payout;

        emit BetSettled(user, betId, won, payout, houseFee);
        emit HouseFeeCollected(houseFee);
    }

    /**
     * @notice Unlock bet amount without settlement (e.g., bet cancelled).
     * @param user The user address.
     * @param amount The amount to unlock.
     */
    function unlockBet(address user, uint256 amount) external onlyRole(OPERATOR_ROLE) nonReentrant {
        require(lockedBalances[user] >= amount, "CE: Insufficient locked");

        lockedBalances[user] -= amount;
        balances[user] += amount;
    }

    // ─── HOUSE KEEPER FUNCTIONS ───────────────────────────

    /**
     * @notice Withdraw platform income to the fixed house treasury.
     * @param amount The amount to withdraw.
     */
    function withdrawHouse(uint256 amount) external onlyRole(HOUSE_KEEPER_ROLE) nonReentrant {
        require(amount <= houseBalance, "CE: Insufficient house balance");

        houseBalance -= amount;

        (bool success,) = payable(houseTreasury).call{value: amount}("");
        require(success, "CE: Transfer failed");

        emit HouseKeeperWithdrawal(houseTreasury, amount);
    }

    /**
     * @notice Update withdrawal safety limits.
     */
    function updateLimits(uint256 _maxPerTx, uint256 _maxDailyPerUser) external onlyRole(HOUSE_KEEPER_ROLE) {
        maxWithdrawalPerTx = _maxPerTx;
        maxDailyWithdrawalPerUser = _maxDailyPerUser;
        emit LimitsUpdated(_maxPerTx, _maxDailyPerUser);
    }

    // ─── EMERGENCY FUNCTIONS ───────────────────────────────

    /**
     * @notice Pause all user operations (deposits, withdrawals, bets).
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    /**
     * @notice Unpause the contract.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpaused(msg.sender);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────

    function getUserBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    function getUserLockedBalance(address user) external view returns (uint256) {
        return lockedBalances[user];
    }

    function getUserAvailableBalance(address user) external view returns (uint256) {
        return balances[user] - lockedBalances[user];
    }

    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // ─── RECEIVE / FALLBACK ─────────────────────────────────

    receive() external payable {
        deposit();
    }

    fallback() external payable {
        deposit();
    }
}
