// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Wool.sol";

/**
 * @title Wool Token Tests
 * @notice Tests for the WOOL ERC20 token
 *
 * WOOL is simple - the main things to test:
 * 1. Only controllers can mint/burn
 * 2. Owner can add/remove controllers
 * 3. Standard ERC20 functions work
 */
contract WoolTest is Test {
    Wool public wool;

    address public owner = address(1);
    address public controller = address(2);  // Will be Barn in production
    address public user = address(3);
    address public attacker = address(4);

    function setUp() public {
        // Deploy as owner
        vm.prank(owner);
        wool = new Wool();
    }

    // ============================================
    // DEPLOYMENT TESTS
    // ============================================

    function test_InitialState() public view {
        assertEq(wool.name(), "WOOL");
        assertEq(wool.symbol(), "WOOL");
        assertEq(wool.totalSupply(), 0);
        assertEq(wool.owner(), owner);
    }

    // ============================================
    // CONTROLLER TESTS
    // ============================================

    function test_OwnerCanSetController() public {
        vm.prank(owner);
        wool.setController(controller, true);

        assertTrue(wool.controllers(controller));
    }

    function test_OwnerCanRemoveController() public {
        // Add then remove
        vm.startPrank(owner);
        wool.setController(controller, true);
        wool.setController(controller, false);
        vm.stopPrank();

        assertFalse(wool.controllers(controller));
    }

    function test_NonOwnerCannotSetController() public {
        vm.prank(attacker);
        vm.expectRevert();  // OwnableUnauthorizedAccount
        wool.setController(controller, true);
    }

    function test_SetControllerEmitsEvent() public {
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit Wool.ControllerSet(controller, true);
        wool.setController(controller, true);
    }

    // ============================================
    // MINTING TESTS
    // ============================================

    function test_ControllerCanMint() public {
        // Setup controller
        vm.prank(owner);
        wool.setController(controller, true);

        // Mint as controller
        vm.prank(controller);
        wool.mint(user, 1000 ether);

        assertEq(wool.balanceOf(user), 1000 ether);
        assertEq(wool.totalSupply(), 1000 ether);
    }

    function test_NonControllerCannotMint() public {
        vm.prank(attacker);
        vm.expectRevert("Wool: caller is not a controller");
        wool.mint(user, 1000 ether);
    }

    function test_OwnerCannotMintWithoutBeingController() public {
        // Owner is not automatically a controller
        vm.prank(owner);
        vm.expectRevert("Wool: caller is not a controller");
        wool.mint(user, 1000 ether);
    }

    // ============================================
    // BURNING TESTS
    // ============================================

    function test_ControllerCanBurn() public {
        // Setup: make controller and mint some tokens
        vm.startPrank(owner);
        wool.setController(controller, true);
        vm.stopPrank();

        vm.prank(controller);
        wool.mint(user, 1000 ether);

        // SECURITY FIX (CRIT-1): User must approve controller to burn from their address
        vm.prank(user);
        wool.approve(controller, 400 ether);

        // Burn
        vm.prank(controller);
        wool.burn(user, 400 ether);

        assertEq(wool.balanceOf(user), 600 ether);
    }

    function test_NonControllerCannotBurn() public {
        // Setup: mint some tokens first
        vm.prank(owner);
        wool.setController(controller, true);

        vm.prank(controller);
        wool.mint(user, 1000 ether);

        // Try to burn as attacker
        vm.prank(attacker);
        vm.expectRevert("Wool: caller is not a controller");
        wool.burn(user, 400 ether);
    }

    function test_CannotBurnMoreThanBalance() public {
        vm.prank(owner);
        wool.setController(controller, true);

        vm.prank(controller);
        wool.mint(user, 1000 ether);

        // Try to burn more than balance
        vm.prank(controller);
        vm.expectRevert();  // ERC20InsufficientBalance
        wool.burn(user, 2000 ether);
    }

    // ============================================
    // ERC20 STANDARD TESTS
    // ============================================

    function test_Transfer() public {
        // Setup
        vm.prank(owner);
        wool.setController(controller, true);

        vm.prank(controller);
        wool.mint(user, 1000 ether);

        // Transfer
        vm.prank(user);
        wool.transfer(attacker, 300 ether);

        assertEq(wool.balanceOf(user), 700 ether);
        assertEq(wool.balanceOf(attacker), 300 ether);
    }

    function test_Approve_TransferFrom() public {
        // Setup
        vm.prank(owner);
        wool.setController(controller, true);

        vm.prank(controller);
        wool.mint(user, 1000 ether);

        // Approve
        vm.prank(user);
        wool.approve(attacker, 500 ether);

        assertEq(wool.allowance(user, attacker), 500 ether);

        // TransferFrom
        vm.prank(attacker);
        wool.transferFrom(user, attacker, 300 ether);

        assertEq(wool.balanceOf(user), 700 ether);
        assertEq(wool.balanceOf(attacker), 300 ether);
        assertEq(wool.allowance(user, attacker), 200 ether);
    }

    // ============================================
    // FUZZ TESTS
    // ============================================

    function testFuzz_MintBurn(uint256 mintAmount, uint256 burnAmount) public {
        // Bound to reasonable amounts
        mintAmount = bound(mintAmount, 1, 1e30);
        burnAmount = bound(burnAmount, 0, mintAmount);

        vm.prank(owner);
        wool.setController(controller, true);

        vm.prank(controller);
        wool.mint(user, mintAmount);

        // SECURITY FIX (CRIT-1): User must approve controller to burn from their address
        vm.prank(user);
        wool.approve(controller, burnAmount);

        vm.prank(controller);
        wool.burn(user, burnAmount);

        assertEq(wool.balanceOf(user), mintAmount - burnAmount);
    }
}
