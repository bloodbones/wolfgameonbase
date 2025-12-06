// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBarn Interface
 * @notice Interface for the staking/barn contract
 * @dev Used by Woolf.sol to:
 *      1. Stake newly minted tokens directly (mint + stake in one tx)
 *      2. Select random wolf owner for the "steal" mechanic
 */
interface IBarn {

    /// @notice Add multiple tokens to staking (called by Woolf during mint+stake)
    /// @param account The owner of the tokens
    /// @param tokenIds Array of token IDs to stake
    function addManyToBarnAndPack(address account, uint16[] calldata tokenIds) external;

    /// @notice Get a random staked wolf's owner (for steal mechanic)
    /// @param seed Random seed to select wolf
    /// @return The address of a random wolf owner, or address(0) if no wolves staked
    function randomWolfOwner(uint256 seed) external view returns (address);
}
