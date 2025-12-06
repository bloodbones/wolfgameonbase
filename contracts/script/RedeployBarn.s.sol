// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Wool.sol";
import "../src/Barn.sol";

/**
 * @title Redeploy Barn Contract
 * @notice Redeploys Barn with staked token tracking
 */
contract RedeployBarn is Script {
    // Existing deployed contracts (Security-fixed deployment - Nov 28, 2025)
    address constant WOOL_ADDRESS = 0xe3DbA8DB9BD0794067E6f8069f489A6ca23Ea492;
    address constant WOOLF_ADDRESS = 0x916A56f76EC06565E0EB55720b9DAE85aE033937;

    // Base Sepolia VRF Configuration
    address constant VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    uint256 constant SUBSCRIPTION_ID = 4575999402920596535752346196544795076338835071088402032750243681588020164899;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Redeploying Barn contract with staked token tracking");
        console.log("Deployer:", deployer);
        console.log("Woolf:", WOOLF_ADDRESS);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new Barn
        Barn barn = new Barn(
            WOOLF_ADDRESS,
            WOOL_ADDRESS,
            VRF_COORDINATOR,
            SUBSCRIPTION_ID
        );
        console.log("New Barn deployed at:", address(barn));

        // Add new Barn as Wool controller
        Wool wool = Wool(WOOL_ADDRESS);
        wool.setController(address(barn), true);
        console.log("Wool: added new Barn as controller");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("BARN REDEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("");
        console.log("New Barn Address:", address(barn));
        console.log("");
        console.log("IMPORTANT:");
        console.log("1. Add new Barn as VRF consumer at vrf.chain.link");
        console.log("2. Update Woolf contract to point to new Barn:");
        console.log("   cast send", WOOLF_ADDRESS);
        console.log("   \"setBarn(address)\" <NEW_BARN_ADDRESS>");
        console.log("3. Update frontend with new Barn address");
    }
}
