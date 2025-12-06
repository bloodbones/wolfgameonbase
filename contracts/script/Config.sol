// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title Deployment Configuration
 * @notice Network-specific configuration for Wolf Game deployment
 * @dev Update these values based on your target network
 *
 * BASE SEPOLIA VRF V2.5 SETUP:
 * 1. Go to https://vrf.chain.link and connect to Base Sepolia
 * 2. Create a new subscription
 * 3. Fund it with LINK tokens (get from faucet)
 * 4. Note your subscription ID
 * 5. After deploying, add Woolf and Barn as consumers
 *
 * LINK FAUCET: https://faucets.chain.link/base-sepolia
 */
library Config {

    // ============================================
    // BASE SEPOLIA CONFIGURATION
    // ============================================

    /// @notice Chain ID for Base Sepolia
    uint256 constant BASE_SEPOLIA_CHAIN_ID = 84532;

    /// @notice VRF Coordinator address for Base Sepolia
    /// @dev From https://docs.chain.link/vrf/v2-5/supported-networks#base-sepolia-testnet
    address constant BASE_SEPOLIA_VRF_COORDINATOR = 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE;

    /// @notice Key hash for Base Sepolia (determines gas price lane)
    /// @dev 30 gwei key hash for Base Sepolia
    bytes32 constant BASE_SEPOLIA_KEY_HASH = 0x9e1344a1247c8a1785d0a4681a27152bffdb43666ae5bf7d14d24a5efd44bf71;

    /// @notice LINK token address on Base Sepolia
    address constant BASE_SEPOLIA_LINK = 0xE4aB69C077896252FAFBD49EFD26B5D171A32410;

    // ============================================
    // BASE MAINNET CONFIGURATION (for future use)
    // ============================================

    /// @notice Chain ID for Base Mainnet
    uint256 constant BASE_MAINNET_CHAIN_ID = 8453;

    /// @notice VRF Coordinator address for Base Mainnet
    /// @dev From https://docs.chain.link/vrf/v2-5/supported-networks#base-mainnet
    address constant BASE_MAINNET_VRF_COORDINATOR = 0xd5D517aBE5cF79B7e95eC98dB0f0277788aFF634;

    /// @notice Key hash for Base Mainnet
    bytes32 constant BASE_MAINNET_KEY_HASH = 0x00b81bcd0fac929e50f896c6a634ef817ac2ef1188aec88d9fce4c64c5c1c3c2;

    /// @notice LINK token address on Base Mainnet
    address constant BASE_MAINNET_LINK = 0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196;

    // ============================================
    // GAME CONFIGURATION
    // ============================================

    /// @notice Maximum total NFTs
    uint256 constant MAX_TOKENS = 50000;

    /// @notice VRF callback gas limit
    uint32 constant CALLBACK_GAS_LIMIT = 2500000;

    /// @notice VRF request confirmations
    uint16 constant REQUEST_CONFIRMATIONS = 3;

    // ============================================
    // HELPER FUNCTIONS
    // ============================================

    function getVRFCoordinator(uint256 chainId) internal pure returns (address) {
        if (chainId == BASE_SEPOLIA_CHAIN_ID) {
            return BASE_SEPOLIA_VRF_COORDINATOR;
        } else if (chainId == BASE_MAINNET_CHAIN_ID) {
            return BASE_MAINNET_VRF_COORDINATOR;
        } else {
            revert("Unsupported chain");
        }
    }

    function getKeyHash(uint256 chainId) internal pure returns (bytes32) {
        if (chainId == BASE_SEPOLIA_CHAIN_ID) {
            return BASE_SEPOLIA_KEY_HASH;
        } else if (chainId == BASE_MAINNET_CHAIN_ID) {
            return BASE_MAINNET_KEY_HASH;
        } else {
            revert("Unsupported chain");
        }
    }

    function getLinkToken(uint256 chainId) internal pure returns (address) {
        if (chainId == BASE_SEPOLIA_CHAIN_ID) {
            return BASE_SEPOLIA_LINK;
        } else if (chainId == BASE_MAINNET_CHAIN_ID) {
            return BASE_MAINNET_LINK;
        } else {
            revert("Unsupported chain");
        }
    }
}
