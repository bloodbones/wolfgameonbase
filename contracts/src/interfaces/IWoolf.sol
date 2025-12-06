// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IWoolf Interface
 * @notice Interface for the main Wolf Game NFT contract
 * @dev Used by Barn.sol to read token traits
 */
interface IWoolf {

    /// @notice Struct storing all traits for a Sheep or Wolf
    /// @dev Packed into a single storage slot where possible
    struct SheepWolf {
        bool isSheep;       // true = sheep, false = wolf
        uint8 fur;          // Fur color/pattern (index into trait array)
        uint8 head;         // Head type
        uint8 ears;         // Ears type
        uint8 eyes;         // Eyes type
        uint8 nose;         // Nose type
        uint8 mouth;        // Mouth type
        uint8 neck;         // Neck accessory (sheep) or unused (wolf)
        uint8 feet;         // Feet type
        uint8 alphaIndex;   // 0 for sheep, 0-3 for wolves (0=strongest, 3=weakest)
    }

    /// @notice Get the number of tokens that can be minted with ETH (Gen 0)
    function getPaidTokens() external view returns (uint256);

    /// @notice Get the traits for a specific token
    /// @param tokenId The token to query
    /// @return The SheepWolf struct containing all traits
    function getTokenTraits(uint256 tokenId) external view returns (SheepWolf memory);
}
