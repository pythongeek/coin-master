// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/CryptoFlipEscrow.sol";

contract CryptoFlipEscrowTest is Test {
    CryptoFlipEscrow public escrow;

    address public admin = address(0x1);
    address public operator = address(0x2);
    address public user = address(0x3);
    address public user2 = address(0x4);
    address public houseTreasury = address(0xfe6AE2a8897F262017D1B2fff6224613df1B71E2);

    function setUp() public {
        vm.startPrank(admin);
        escrow = new CryptoFlipEscrow(admin, operator, houseTreasury);
        vm.stopPrank();

        // Fund user with ETH
        vm.deal(user, 100 ether);
        vm.deal(user2, 100 ether);
        vm.deal(address(escrow), 1000 ether); // Initial contract balance
    }

    // ─── DEPOSIT TESTS ────────────────────────────────────

    function test_Deposit() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        assertEq(escrow.balances(user), 10 ether);
        assertEq(escrow.getContractBalance(), 1010 ether);
    }

    function test_RevertDepositZero() public {
        vm.prank(user);
        vm.expectRevert("CE: Zero deposit");
        escrow.deposit{value: 0}();
    }

    function test_ReceiveFallback() public {
        vm.prank(user);
        (bool success,) = address(escrow).call{value: 5 ether}("");
        assertTrue(success);
        assertEq(escrow.balances(user), 5 ether);
    }

    // ─── WITHDRAWAL TESTS ─────────────────────────────────

    function test_Withdraw() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        uint256 beforeBalance = user.balance;

        vm.prank(user);
        escrow.withdraw(5 ether);

        assertEq(escrow.balances(user), 5 ether);
        assertEq(user.balance, beforeBalance + 5 ether);
    }

    function test_RevertWithdrawZero() public {
        vm.prank(user);
        vm.expectRevert("CE: Zero withdrawal");
        escrow.withdraw(0);
    }

    function test_RevertWithdrawInsufficientBalance() public {
        vm.prank(user);
        vm.expectRevert("CE: Insufficient balance");
        escrow.withdraw(1 ether);
    }

    function test_RevertWithdrawLocked() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        vm.prank(operator);
        escrow.lockBet(user, 5 ether, keccak256("bet1"));

        vm.prank(user);
        vm.expectRevert("CE: Active bets locked");
        escrow.withdraw(1 ether);
    }

    function test_RevertWithdrawExceedsMaxPerTx() public {
        vm.prank(user);
        escrow.deposit{value: 200 ether}();

        vm.prank(user);
        vm.expectRevert("CE: Exceeds max per tx");
        escrow.withdraw(101 ether);
    }

    // ─── BET LOCK / SETTLE TESTS ──────────────────────────

    function test_LockBet() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        bytes32 betId = keccak256("bet1");

        vm.prank(operator);
        escrow.lockBet(user, 5 ether, betId);

        assertEq(escrow.balances(user), 5 ether);
        assertEq(escrow.lockedBalances(user), 5 ether);
    }

    function test_SettleBet_Win() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        bytes32 betId = keccak256("bet1");
        uint256 betAmount = 1 ether;
        uint256 payout = 1.98 ether;
        uint256 houseFee = 0.02 ether;

        vm.prank(operator);
        escrow.lockBet(user, payout, betId);

        uint256 houseBefore = escrow.houseBalance();

        vm.prank(operator);
        escrow.settleBet(user, betId, true, payout, houseFee);

        assertEq(escrow.balances(user), 10 ether - payout + payout); // Back to original
        assertEq(escrow.lockedBalances(user), 0);
        assertEq(escrow.houseBalance(), houseBefore + houseFee);
    }

    function test_SettleBet_Loss() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        bytes32 betId = keccak256("bet1");
        uint256 betAmount = 1 ether;
        uint256 payout = 1 ether;
        uint256 houseFee = 0.02 ether;

        vm.prank(operator);
        escrow.lockBet(user, payout + houseFee, betId);

        uint256 houseBefore = escrow.houseBalance();

        vm.prank(operator);
        escrow.settleBet(user, betId, false, payout + houseFee, houseFee);

        assertEq(escrow.balances(user), 10 ether - payout - houseFee);
        assertEq(escrow.lockedBalances(user), 0);
        assertEq(escrow.houseBalance(), houseBefore + payout + houseFee);
    }

    function test_RevertLockBetInsufficientBalance() public {
        bytes32 betId = keccak256("bet1");

        vm.prank(operator);
        vm.expectRevert("CE: Insufficient balance");
        escrow.lockBet(user, 1 ether, betId);
    }

    function test_UnlockBet() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        bytes32 betId = keccak256("bet1");

        vm.prank(operator);
        escrow.lockBet(user, 5 ether, betId);

        vm.prank(operator);
        escrow.unlockBet(user, 5 ether);

        assertEq(escrow.balances(user), 10 ether);
        assertEq(escrow.lockedBalances(user), 0);
    }

    // ─── HOUSE KEEPER TESTS ───────────────────────────────

    function test_WithdrawHouse() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        bytes32 betId = keccak256("bet1");
        vm.prank(operator);
        escrow.lockBet(user, 1 ether, betId);
        vm.prank(operator);
        escrow.settleBet(user, betId, false, 1 ether, 0.02 ether);

        uint256 houseBefore = escrow.houseBalance();
        vm.prank(admin);
        escrow.withdrawHouse(houseBefore);

        assertEq(escrow.houseBalance(), 0);
        assertEq(houseTreasury.balance, houseBefore);
    }

    function test_RevertWithdrawHouseNonKeeper() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")), user, escrow.HOUSE_KEEPER_ROLE()
            )
        );
        escrow.withdrawHouse(1 ether);
    }

    function test_RevertConstructorInvalidTreasury() public {
        vm.expectRevert("CE: Invalid treasury");
        new CryptoFlipEscrow(admin, operator, address(0));
    }

    // ─── PAUSE TESTS ──────────────────────────────────────

    function test_Pause() public {
        vm.prank(admin);
        escrow.pause();

        assertTrue(escrow.paused());

        vm.prank(user);
        vm.expectRevert("Pausable: paused");
        escrow.deposit{value: 1 ether}();
    }

    function test_Unpause() public {
        vm.prank(admin);
        escrow.pause();

        vm.prank(admin);
        escrow.unpause();

        assertFalse(escrow.paused());

        vm.prank(user);
        escrow.deposit{value: 1 ether}();
        assertEq(escrow.balances(user), 1 ether);
    }

    function test_RevertPauseNonAdmin() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")),
                user,
                escrow.DEFAULT_ADMIN_ROLE()
            )
        );
        escrow.pause();
    }

    // ─── FUZZ TESTS ───────────────────────────────────────

    function testFuzz_DepositAndWithdraw(uint96 amount) public {
        vm.assume(amount > 0 && amount <= 100 ether);

        vm.prank(user);
        escrow.deposit{value: amount}();

        assertEq(escrow.balances(user), amount);

        vm.prank(user);
        escrow.withdraw(amount);

        assertEq(escrow.balances(user), 0);
    }

    function testFuzz_LockAndSettle(uint96 depositAmount, uint96 betAmount) public {
        vm.assume(depositAmount > 0 && depositAmount <= 100 ether);
        vm.assume(betAmount > 0 && betAmount <= depositAmount);

        vm.prank(user);
        escrow.deposit{value: depositAmount}();

        bytes32 betId = keccak256(abi.encodePacked(block.timestamp, user));

        vm.prank(operator);
        escrow.lockBet(user, betAmount, betId);

        assertEq(escrow.lockedBalances(user), betAmount);

        vm.prank(operator);
        escrow.settleBet(user, betId, true, betAmount, 0);

        assertEq(escrow.lockedBalances(user), 0);
    }

    // ─── ACCESS CONTROL TESTS ─────────────────────────────

    function test_RevertSettleBetNonOperator() public {
        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("AccessControlUnauthorizedAccount(address,bytes32)")), user, escrow.OPERATOR_ROLE()
            )
        );
        escrow.settleBet(user, keccak256("bet"), true, 1 ether, 0);
    }

    // ─── VIEW FUNCTIONS ───────────────────────────────────

    function test_GetUserAvailableBalance() public {
        vm.prank(user);
        escrow.deposit{value: 10 ether}();

        vm.prank(operator);
        escrow.lockBet(user, 3 ether, keccak256("bet"));

        assertEq(escrow.getUserAvailableBalance(user), 7 ether);
        assertEq(escrow.getUserBalance(user), 7 ether); // balances excludes locked
        assertEq(escrow.getUserLockedBalance(user), 3 ether);
    }
}
