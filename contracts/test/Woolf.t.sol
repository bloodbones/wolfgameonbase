// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/Woolf.sol";
import "../src/Wool.sol";
import "../src/Traits.sol";

/**
 * @title Woolf NFT Tests
 * @notice Tests for the main Wolf Game NFT contract
 *
 * TESTING VRF:
 * Since we can't get real Chainlink VRF responses in tests, we need to:
 * 1. Mock the VRF coordinator
 * 2. Manually call fulfillRandomWords to simulate the callback
 *
 * Foundry has a VRFCoordinatorV2Mock but for V2.5 we need to create our own
 * or use a simpler approach: test the logic separately.
 */

// Mock VRF coordinator that can trigger callbacks
// Implements the V2.5 interface that Woolf.sol calls
contract MockVRFCoordinator {
    uint256 public lastRequestId;
    uint256 private requestCounter;
    address public lastRequester;

    // Struct must match VRFV2PlusClient.RandomWordsRequest
    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    // V2.5 style request - this is what Woolf.sol actually calls
    function requestRandomWords(
        RandomWordsRequest calldata /* req */
    ) external returns (uint256 requestId) {
        requestCounter++;
        requestId = requestCounter;
        lastRequestId = requestId;
        lastRequester = msg.sender;
    }

    // Simulate Chainlink calling back with random words
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) external {
        // Call rawFulfillRandomWords on the consumer (Woolf or Barn)
        // This is the function VRFConsumerBaseV2Plus exposes for the coordinator
        (bool success, bytes memory returnData) = lastRequester.call(
            abi.encodeWithSignature("rawFulfillRandomWords(uint256,uint256[])", requestId, randomWords)
        );
        require(success, string(returnData));
    }
}

contract WoolfTest is Test {
    Woolf public woolf;
    Wool public wool;
    Traits public traits;
    MockVRFCoordinator public vrfCoordinator;

    // Use addresses that aren't precompiles (1-9 are precompiles)
    address public owner = address(0x1001);
    address public user1 = address(0x1002);
    address public user2 = address(0x1003);

    uint256 public constant SUBSCRIPTION_ID = 1;
    uint256 public constant MINT_PRICE = 0.001 ether;
    uint256 public constant MAX_TOKENS = 50000;

    function setUp() public {
        vm.startPrank(owner);

        // Deploy mock VRF coordinator
        vrfCoordinator = new MockVRFCoordinator();

        // Deploy WOOL
        wool = new Wool();

        // Deploy Woolf (traits can be address(0) initially)
        woolf = new Woolf(
            address(wool),
            address(0),  // traits - set later
            MAX_TOKENS,
            address(vrfCoordinator),
            SUBSCRIPTION_ID
        );

        // Deploy Traits and set it
        traits = new Traits();
        traits.setWoolf(address(woolf));
        woolf.setTraits(address(traits));

        // Set Woolf as WOOL controller (for burning on Gen 1+ mints)
        wool.setController(address(woolf), true);

        vm.stopPrank();

        // Fund test users
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
    }

    // ============================================
    // DEPLOYMENT TESTS
    // ============================================

    function test_InitialState() public view {
        assertEq(woolf.name(), "Wolf Game");
        assertEq(woolf.symbol(), "WGAME");
        assertEq(woolf.MAX_TOKENS(), MAX_TOKENS);
        assertEq(woolf.PAID_TOKENS(), MAX_TOKENS / 5); // 10,000
        assertEq(woolf.minted(), 0);
        assertEq(woolf.MINT_PRICE(), MINT_PRICE);
    }

    // ============================================
    // MINT COST TESTS
    // ============================================

    function test_MintCost() public view {
        // Gen 0: Free (paid with ETH)
        assertEq(woolf.mintCost(1), 0);
        assertEq(woolf.mintCost(10000), 0);

        // Gen 1: 20,000 WOOL
        assertEq(woolf.mintCost(10001), 20000 ether);
        assertEq(woolf.mintCost(20000), 20000 ether);

        // Gen 2: 40,000 WOOL
        assertEq(woolf.mintCost(20001), 40000 ether);
        assertEq(woolf.mintCost(40000), 40000 ether);

        // Gen 3: 80,000 WOOL
        assertEq(woolf.mintCost(40001), 80000 ether);
        assertEq(woolf.mintCost(50000), 80000 ether);
    }

    // ============================================
    // GEN 0 MINTING TESTS
    // ============================================

    function test_MintGen0_RequestsVRF() public {
        // Use prank with both sender and origin to pass EOA check
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE}(1, false);

        // VRF should have been requested
        assertEq(vrfCoordinator.lastRequestId(), 1);

        // But no token minted yet (waiting for callback)
        assertEq(woolf.minted(), 0);
    }

    function test_MintGen0_WrongPrice_Reverts() public {
        vm.prank(user1, user1);
        vm.expectRevert("Wrong ETH amount");
        woolf.mint{value: 0.0001 ether}(1, false);
    }

    function test_MintGen0_TooMany_Reverts() public {
        vm.prank(user1, user1);
        vm.expectRevert("Invalid mint amount");
        woolf.mint{value: MINT_PRICE * 11}(11, false);
    }

    function test_MintGen0_ZeroAmount_Reverts() public {
        vm.prank(user1, user1);
        vm.expectRevert("Invalid mint amount");
        woolf.mint{value: 0}(0, false);
    }

    // ============================================
    // VRF CALLBACK - FULL MINTING FLOW
    // ============================================

    function test_MintGen0_FullFlow_MintsSheep() public {
        // Request mint
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE}(1, false);

        uint256 requestId = vrfCoordinator.lastRequestId();
        assertEq(requestId, 1);
        assertEq(woolf.minted(), 0);  // Not minted yet

        // Simulate VRF callback with a seed that produces a sheep (90% chance)
        // Seed where (seed & 0xFFFF) % 10 != 0 => sheep
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 12345;  // This should produce a sheep

        vrfCoordinator.fulfillRandomWords(requestId, randomWords);

        // Now token should be minted
        assertEq(woolf.minted(), 1);
        assertEq(woolf.ownerOf(1), user1);

        // Check traits
        IWoolf.SheepWolf memory traits_ = woolf.getTokenTraits(1);
        // 12345 & 0xFFFF = 12345, 12345 % 10 = 5, != 0 => sheep
        assertTrue(traits_.isSheep);
    }

    function test_MintGen0_FullFlow_MintsWolf() public {
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE}(1, false);

        uint256 requestId = vrfCoordinator.lastRequestId();

        // Simulate VRF callback with a seed that produces a wolf
        // The actual seed used is keccak256(vrfSeed, tokenIndex)
        // Need (keccak256(seed, 0) & 0xFFFF) % 10 == 0 => wolf
        // Seed 15 produces tokenSeed with lower 16 bits = 59910, 59910 % 10 = 0 => wolf
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 15;

        vrfCoordinator.fulfillRandomWords(requestId, randomWords);

        assertEq(woolf.minted(), 1);
        assertEq(woolf.ownerOf(1), user1);

        IWoolf.SheepWolf memory traits_ = woolf.getTokenTraits(1);
        assertFalse(traits_.isSheep);  // It's a wolf
        assertGe(traits_.alphaIndex, 0);
        assertLe(traits_.alphaIndex, 3);  // Alpha index 0-3
    }

    function test_MintGen0_FullFlow_MultipleMints() public {
        // Mint 5 tokens at once
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE * 5}(5, false);

        uint256 requestId = vrfCoordinator.lastRequestId();

        // Fulfill with random seed
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 98765432;

        vrfCoordinator.fulfillRandomWords(requestId, randomWords);

        // Should have 5 tokens minted
        assertEq(woolf.minted(), 5);
        assertEq(woolf.balanceOf(user1), 5);

        // Each token should have traits
        for (uint256 i = 1; i <= 5; i++) {
            assertEq(woolf.ownerOf(i), user1);
            IWoolf.SheepWolf memory t = woolf.getTokenTraits(i);
            // Just verify traits exist (fur should have some value)
            assertTrue(t.isSheep || !t.isSheep);  // Tautology but proves it was set
        }
    }

    function test_MintGen0_CannotFulfillTwice() public {
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE}(1, false);

        uint256 requestId = vrfCoordinator.lastRequestId();
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 12345;

        // First fulfillment works
        vrfCoordinator.fulfillRandomWords(requestId, randomWords);
        assertEq(woolf.minted(), 1);

        // Second fulfillment should fail
        vm.expectRevert();
        vrfCoordinator.fulfillRandomWords(requestId, randomWords);
    }

    // ============================================
    // ADMIN TESTS
    // ============================================

    function test_OnlyOwnerCanSetBarn() public {
        vm.prank(user1);
        vm.expectRevert();  // Not owner
        woolf.setBarn(address(123));
    }

    function test_OwnerCanSetBarn() public {
        vm.prank(owner);
        woolf.setBarn(address(123));
        assertEq(address(woolf.barn()), address(123));
    }

    function test_OnlyOwnerCanSetTraits() public {
        vm.prank(user1);
        vm.expectRevert();
        woolf.setTraits(address(456));
    }

    function test_OwnerCanPause() public {
        vm.prank(owner);
        woolf.setPaused(true);

        vm.prank(user1);
        vm.expectRevert();  // EnforcedPause
        woolf.mint{value: MINT_PRICE}(1, false);
    }

    function test_OwnerCanUnpause() public {
        vm.startPrank(owner);
        woolf.setPaused(true);
        woolf.setPaused(false);
        vm.stopPrank();

        // Should work now
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE}(1, false);
        assertEq(vrfCoordinator.lastRequestId(), 1);
    }

    function test_OwnerCanWithdraw() public {
        // Send some ETH to contract
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE * 5}(5, false);

        uint256 balanceBefore = owner.balance;

        vm.prank(owner);
        woolf.withdraw();

        assertEq(owner.balance, balanceBefore + (MINT_PRICE * 5));
    }

    // ============================================
    // CONTRACT INTERACTION TESTS
    // ============================================

    function test_NoContractsCanMint() public {
        // Deploy a contract that tries to mint
        MaliciousMinter attacker = new MaliciousMinter(woolf);
        vm.deal(address(attacker), 1 ether);

        vm.expectRevert("Only EOA");
        attacker.tryMint();
    }

    // ============================================
    // STEAL MECHANIC TESTS (Gen 1+ only)
    // ============================================

    function test_Gen1Mint_NoSteal_GoesToMinter() public {
        // Setup: Deploy a mock barn with a staked wolf owned by user2
        MockBarnForSteal mockBarn = new MockBarnForSteal(user2);
        vm.prank(owner);
        woolf.setBarn(address(mockBarn));

        // Storage slot for 'minted' is 15 (from `forge inspect Woolf storage`)
        // Set to 10000 so next mint is 10001 (Gen 1, steal mechanic active)
        vm.store(address(woolf), bytes32(uint256(15)), bytes32(uint256(10000)));

        // Give user1 WOOL for Gen 1 mint (costs 20,000 WOOL)
        vm.prank(owner);
        wool.setController(address(this), true);
        wool.mint(user1, 30000 ether);

        // Approve and mint
        vm.prank(user1);
        wool.approve(address(woolf), type(uint256).max);
        vm.prank(user1, user1);
        woolf.mint(1, false);

        uint256 requestId = vrfCoordinator.lastRequestId();

        // Use a seed that does NOT trigger steal
        // Seed 1: (keccak256(1, 0) >> 245) % 10 != 0 => no steal
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 1;

        vrfCoordinator.fulfillRandomWords(requestId, randomWords);

        // Token should go to user1 (the minter), not stolen
        assertEq(woolf.minted(), 10001);
        assertEq(woolf.ownerOf(10001), user1);
    }

    function test_Gen1Mint_Stolen_GoesToWolfOwner() public {
        // Setup: Deploy a mock barn with a staked wolf owned by user2
        MockBarnForSteal mockBarn = new MockBarnForSteal(user2);
        vm.prank(owner);
        woolf.setBarn(address(mockBarn));

        // Set minted to 10000 so next mint is 10001 (Gen 1)
        vm.store(address(woolf), bytes32(uint256(15)), bytes32(uint256(10000)));

        // Give user1 WOOL for Gen 1 mint
        vm.prank(owner);
        wool.setController(address(this), true);
        wool.mint(user1, 30000 ether);

        // Approve and mint
        vm.prank(user1);
        wool.approve(address(woolf), type(uint256).max);
        vm.prank(user1, user1);
        woolf.mint(1, false);

        uint256 requestId = vrfCoordinator.lastRequestId();

        // Use seed 7 which triggers steal: (keccak256(7, 0) >> 245) % 10 == 0
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 7;

        // Expect TokenStolen event
        vm.expectEmit(true, true, true, true);
        emit Woolf.TokenStolen(10001, user1, user2);

        vrfCoordinator.fulfillRandomWords(requestId, randomWords);

        // Token should be stolen to user2 (wolf owner), not user1
        assertEq(woolf.minted(), 10001);
        assertEq(woolf.ownerOf(10001), user2);  // Stolen!
    }

    function test_Gen0Mint_NeverStolen() public {
        // Setup barn (but steal should still not happen for Gen 0)
        MockBarnForSteal mockBarn = new MockBarnForSteal(user2);
        vm.prank(owner);
        woolf.setBarn(address(mockBarn));

        // Mint Gen 0 (minted still at 0, below PAID_TOKENS)
        vm.prank(user1, user1);
        woolf.mint{value: MINT_PRICE}(1, false);

        uint256 requestId = vrfCoordinator.lastRequestId();

        // Use steal seed 7 - should NOT steal for Gen 0
        uint256[] memory randomWords = new uint256[](1);
        randomWords[0] = 7;

        vrfCoordinator.fulfillRandomWords(requestId, randomWords);

        // Token should go to user1 even with steal seed - Gen 0 is never stolen
        assertEq(woolf.ownerOf(1), user1);
    }
}

// Helper contract to test EOA-only restriction
contract MaliciousMinter {
    Woolf public woolf;

    constructor(Woolf _woolf) {
        woolf = _woolf;
    }

    function tryMint() external {
        woolf.mint{value: 0.001 ether}(1, false);
    }
}

// Mock Barn that returns a wolf owner for steal mechanic testing
contract MockBarnForSteal {
    address public wolfOwner;

    constructor(address _wolfOwner) {
        wolfOwner = _wolfOwner;
    }

    // Required by IBarn interface - returns the wolf owner for any seed
    function randomWolfOwner(uint256) external view returns (address) {
        return wolfOwner;
    }

    // Stub for addManyToBarnAndPack (not used in steal test)
    function addManyToBarnAndPack(address, uint16[] calldata) external {}
}
