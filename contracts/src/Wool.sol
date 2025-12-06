// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title WOOL Token
 * @notice ERC20 token used as the in-game currency for Wolf Game Base
 * @dev Only authorized controllers (Barn contract) can mint tokens
 *
 * WOOL is earned by:
 * - Staking sheep in the Barn (10,000 WOOL per day)
 * - Wolves stealing from sheep claims and unstakes
 *
 * WOOL is spent on:
 * - Minting Gen 1+ NFTs (increasing price tiers)
 */
contract Wool is ERC20, Ownable {

    /// @notice Addresses allowed to mint/burn tokens (Barn contract)
    mapping(address => bool) public controllers;

    /// @notice Emitted when a controller is added or removed
    event ControllerSet(address indexed controller, bool allowed);

    constructor() ERC20("WOOL", "WOOL") Ownable(msg.sender) {}

    /**
     * @notice Add or remove a controller that can mint/burn tokens
     * @param controller Address to modify
     * @param allowed Whether the address can mint/burn
     */
    function setController(address controller, bool allowed) external onlyOwner {
        controllers[controller] = allowed;
        emit ControllerSet(controller, allowed);
    }

    /**
     * @notice Mint tokens to an address (only callable by controllers)
     * @param to Address to receive tokens
     * @param amount Amount to mint (in wei, so 1 WOOL = 1e18)
     */
    function mint(address to, uint256 amount) external {
        require(controllers[msg.sender], "Wool: caller is not a controller");
        _mint(to, amount);
    }

    /**
     * @notice Burn tokens from an address (only callable by controllers)
     * @param from Address to burn from
     * @param amount Amount to burn
     * @dev If burning from another address, requires approval (prevents arbitrary burns)
     */
    function burn(address from, uint256 amount) external {
        require(controllers[msg.sender], "Wool: caller is not a controller");
        // SECURITY FIX (CRIT-1): Require approval when burning from another address
        if (from != msg.sender) {
            _spendAllowance(from, msg.sender, amount);
        }
        _burn(from, amount);
    }
}
