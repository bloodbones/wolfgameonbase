// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Wool.sol";
import "../src/Woolf.sol";
import "../src/Barn.sol";
import "../src/Traits.sol";

/**
 * @title Deploy Security-Fixed Contracts
 * @notice Redeploys Wool, Woolf, and Barn with security fixes
 * @dev Traits contract is unchanged and can be reused
 *
 * Security fixes included:
 * - CRIT-1: Wool burn() approval check
 * - CRIT-2: Barn rescue mechanism for stuck VRF
 * - CRIT-3: Barn reentrancy protection (ReentrancyGuard + CEI)
 * - HIGH-1: Integer overflow fix in earnings
 * - HIGH-2: VRF subscription setter
 * - HIGH-4: Pack array self-swap bug
 * - HIGH-5: randomWolfOwner edge case
 * - MED-1: Slippage protection on mints
 * - MED-5: Admin events
 * - MED-6: Low-level call return handling
 * - LOW-1/2: Zero-address checks
 */
contract DeploySecurityFixes is Script {
    // Existing Traits contract (unchanged, can reuse)
    address constant TRAITS_ADDRESS = 0x6CB7Ac725369023079b89beb753e1afe05C9bced;

    // Base Sepolia VRF Configuration
    address constant VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    uint256 constant SUBSCRIPTION_ID = 4575999402920596535752346196544795076338835071088402032750243681588020164899;

    // Game Configuration
    uint256 constant MAX_TOKENS = 50000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying Security-Fixed Wolf Game Contracts");
        console.log("Deployer:", deployer);
        console.log("Reusing Traits at:", TRAITS_ADDRESS);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy new Wool (with burn approval fix)
        Wool wool = new Wool();
        console.log("Wool deployed at:", address(wool));

        // 2. Deploy new Woolf (with slippage protection, VRF setter, etc.)
        Woolf woolf = new Woolf(
            address(wool),
            TRAITS_ADDRESS,
            MAX_TOKENS,
            VRF_COORDINATOR,
            SUBSCRIPTION_ID
        );
        console.log("Woolf deployed at:", address(woolf));

        // 3. Deploy new Barn (with reentrancy protection, rescue mechanism, etc.)
        Barn barn = new Barn(
            address(woolf),
            address(wool),
            VRF_COORDINATOR,
            SUBSCRIPTION_ID
        );
        console.log("Barn deployed at:", address(barn));

        // 4. Configure contracts

        // Wool: Set Woolf and Barn as controllers
        wool.setController(address(woolf), true);
        wool.setController(address(barn), true);
        console.log("Wool: controllers set (Woolf + Barn)");

        // Woolf: Set Barn reference
        woolf.setBarn(address(barn));
        console.log("Woolf: Barn reference set");

        // Traits: Update to point to new Woolf
        Traits traits = Traits(TRAITS_ADDRESS);
        traits.setWoolf(address(woolf));
        console.log("Traits: updated to new Woolf");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("SECURITY FIXES DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("");
        console.log("New Contract Addresses:");
        console.log("  Wool:   ", address(wool));
        console.log("  Woolf:  ", address(woolf));
        console.log("  Barn:   ", address(barn));
        console.log("  Traits: ", TRAITS_ADDRESS, "(unchanged)");
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Add Woolf and Barn as VRF consumers at vrf.chain.link");
        console.log("   Subscription ID:", SUBSCRIPTION_ID);
        console.log("   - Woolf:", address(woolf));
        console.log("   - Barn: ", address(barn));
        console.log("");
        console.log("2. Update frontend contracts.ts with new addresses");
        console.log("");
        console.log("3. Test minting:");
        console.log("   cast send", address(woolf), "\"mint(uint256,bool)\" 1 false --value 0.001ether");
    }
}
