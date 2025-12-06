// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITraits Interface
 * @notice Interface for the on-chain SVG/metadata generation contract
 * @dev Woolf.sol delegates tokenURI() calls to this contract
 *      This allows upgrading the art without redeploying the NFT contract
 */
interface ITraits {

    /// @notice Generate the full tokenURI (metadata + image) for a token
    /// @param tokenId The token to generate URI for
    /// @return A base64-encoded data URI containing JSON metadata with embedded SVG
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
