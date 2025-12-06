// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Wool.sol";
import "../src/Woolf.sol";
import "../src/Barn.sol";
import "../src/Traits.sol";

/**
 * @title Deploy Wolf Game to Base Sepolia
 * @notice Deploys all Wolf Game contracts
 * @dev Run with:
 *   forge script script/Deploy.s.sol --rpc-url base-sepolia --broadcast --verify
 *
 * BEFORE RUNNING:
 * 1. Create VRF subscription at vrf.chain.link
 * 2. Fund subscription with LINK
 * 3. Set PRIVATE_KEY environment variable
 *
 * AFTER RUNNING:
 * 1. Add Woolf and Barn addresses as VRF consumers
 * 2. Upload traits using: bash script/upload-commands.sh
 */
contract Deploy is Script {
    // Base Sepolia VRF Configuration
    address constant VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    uint256 constant SUBSCRIPTION_ID = 4575999402920596535752346196544795076338835071088402032750243681588020164899;

    // Game Configuration
    uint256 constant MAX_TOKENS = 50000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying Wolf Game to Base Sepolia");
        console.log("Deployer:", deployer);
        console.log("VRF Coordinator:", VRF_COORDINATOR);
        console.log("Subscription ID:", SUBSCRIPTION_ID);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Wool (ERC20 token)
        Wool wool = new Wool();
        console.log("Wool deployed at:", address(wool));

        // 2. Deploy Traits (SVG generation)
        Traits traits = new Traits();
        console.log("Traits deployed at:", address(traits));

        // 3. Deploy Woolf (NFT)
        Woolf woolf = new Woolf(
            address(wool),
            address(traits),
            MAX_TOKENS,
            VRF_COORDINATOR,
            SUBSCRIPTION_ID
        );
        console.log("Woolf deployed at:", address(woolf));

        // 4. Deploy Barn (Staking)
        Barn barn = new Barn(
            address(woolf),
            address(wool),
            VRF_COORDINATOR,
            SUBSCRIPTION_ID
        );
        console.log("Barn deployed at:", address(barn));

        // 5. Configure contracts

        // Wool: Set Woolf and Barn as controllers (can mint/burn)
        wool.setController(address(woolf), true);
        wool.setController(address(barn), true);
        console.log("Wool controllers set");

        // Woolf: Set Barn reference
        woolf.setBarn(address(barn));
        console.log("Woolf barn set");

        // Traits: Set Woolf reference
        traits.setWoolf(address(woolf));
        console.log("Traits woolf set");

        // Barn: Set Woolf reference (already set in constructor, but verify)
        // barn.setWoolf(address(woolf)); // Not needed - set in constructor

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  Wool:   ", address(wool));
        console.log("  Traits: ", address(traits));
        console.log("  Woolf:  ", address(woolf));
        console.log("  Barn:   ", address(barn));
        console.log("");
        console.log("NEXT STEPS:");
        console.log("1. Add Woolf and Barn as VRF consumers at vrf.chain.link");
        console.log("   - Woolf: ", address(woolf));
        console.log("   - Barn:  ", address(barn));
        console.log("");
        console.log("2. Upload traits:");
        console.log("   Edit script/upload-commands.sh with TRAITS_ADDRESS=", address(traits));
        console.log("   Then run: PRIVATE_KEY=0x... bash script/upload-commands.sh");
        console.log("");
        console.log("3. Test minting:");
        console.log("   cast send", address(woolf), "\"mint(uint256,bool)\" 1 false --value 0.001ether --private-key $PRIVATE_KEY --rpc-url base-sepolia");
    }
}
