// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/Wool.sol";
import "../src/Woolf.sol";
import "../src/Barn.sol";
import "../src/Traits.sol";

/**
 * @title Redeploy Woolf Contract
 * @notice Redeploys just the Woolf contract and reconfigures all connections
 */
contract RedeployWoolf is Script {
    // Existing deployed contracts
    address constant WOOL_ADDRESS = 0x8062741f9634B83BD35976Ff07B6238eFc01503B;
    address constant TRAITS_ADDRESS = 0x6CB7Ac725369023079b89beb753e1afe05C9bced;
    address constant BARN_ADDRESS = 0xE8DeE5A2106F25f6C7fE3fA28F9a89Ea935f18D8;

    // Base Sepolia VRF Configuration
    address constant VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;
    uint256 constant SUBSCRIPTION_ID = 4575999402920596535752346196544795076338835071088402032750243681588020164899;

    // Game Configuration
    uint256 constant MAX_TOKENS = 50000;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Redeploying Woolf contract");
        console.log("Deployer:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new Woolf
        Woolf woolf = new Woolf(
            WOOL_ADDRESS,
            TRAITS_ADDRESS,
            MAX_TOKENS,
            VRF_COORDINATOR,
            SUBSCRIPTION_ID
        );
        console.log("New Woolf deployed at:", address(woolf));

        // Reconfigure Wool - add new Woolf as controller
        Wool wool = Wool(WOOL_ADDRESS);
        wool.setController(address(woolf), true);
        console.log("Wool: added new Woolf as controller");

        // Reconfigure Traits - set new Woolf
        Traits traits = Traits(TRAITS_ADDRESS);
        traits.setWoolf(address(woolf));
        console.log("Traits: set new Woolf");

        // Configure Woolf - set Barn
        woolf.setBarn(BARN_ADDRESS);
        console.log("Woolf: set Barn reference");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("REDEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("");
        console.log("New Woolf Address:", address(woolf));
        console.log("");
        console.log("IMPORTANT: Add new Woolf as VRF consumer at vrf.chain.link");
        console.log("Subscription ID:", SUBSCRIPTION_ID);
    }
}
