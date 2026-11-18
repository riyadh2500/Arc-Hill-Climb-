// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ArcClimbGarage
 * @notice Persistent, wallet-bound bike ownership and upgrades for Arc Climb.
 * @dev Assumes standard, non-rebasing, non-fee-on-transfer USDC with 6 decimals.
 * All amounts are raw token units (1 USDC = 1e6); decimals are not verified.
 * Payments move directly from the buyer to TREASURY, never through this contract.
 * If TREASURY is USDC-blacklisted, purchases and upgrades revert atomically.
 * There is no owner, admin, upgradeability, pause, withdrawal, or rescue function.
 * Unsolicited ERC-20 transfers cannot be prevented or recovered. Native currency
 * is not accepted through any payable entry point; forced native transfers cannot
 * be prevented. Ownership is nontransferable and follows the wallet address.
 */
contract ArcClimbGarage is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Token used for all payments; expected to be standard 6-decimal USDC.
    IERC20 public immutable USDC;

    /// @notice Immutable direct recipient of all purchase and upgrade payments.
    address public immutable TREASURY;

    /// @notice Maximum upgrade level for every bike.
    uint8 public constant MAX_LEVEL = 3;

    /// @notice Number of bikes in the immutable catalogue, including starter bike 0.
    uint256 public immutable bikeCount;

    uint256[] private _prices;
    uint256[] private _upgradeSteps;

    // Zero means unowned; otherwise the stored value equals level + 1.
    // Bike 0 is implicitly owned at level 0 when its stored value is zero.
    mapping(address => mapping(uint256 => uint8)) private _garage;

    /// @notice A required constructor address is zero.
    error ZeroAddress();
    /// @notice The treasury cannot be this contract.
    error InvalidTreasury();
    /// @notice The catalogue arrays have different lengths.
    error CatalogueLengthMismatch();
    /// @notice A catalogue must contain between 1 and 16 bikes.
    error InvalidBikeCount();
    /// @notice Starter bike 0 must have a zero purchase price.
    error StarterBikeNotFree();
    /// @notice The bike ID is outside the catalogue.
    error InvalidBikeId(uint256 bikeId);
    /// @notice Starter bike 0 is already free and cannot be purchased.
    error StarterBikeCannotBePurchased();
    /// @notice The caller already owns the bike.
    error BikeAlreadyOwned(uint256 bikeId);
    /// @notice The caller does not own the bike.
    error BikeNotOwned(uint256 bikeId);
    /// @notice The bike has reached the maximum upgrade level.
    error MaxLevelReached(uint256 bikeId);
    /// @notice The configured step times the next level cannot fit in uint256.
    error UpgradeCostOverflow(uint256 bikeId);

    /**
     * @notice A player purchased a bike at level 0.
     * @param player Buyer and permanent owner.
     * @param bikeId Purchased catalogue ID.
     * @param price Amount sent directly to TREASURY, in raw USDC units.
     */
    event BikePurchased(address indexed player, uint256 indexed bikeId, uint256 price);

    /**
     * @notice A player upgraded an owned bike.
     * @param player Buyer of the upgrade and owner of the bike.
     * @param bikeId Upgraded catalogue ID.
     * @param newLevel Level after the upgrade.
     * @param cost Amount sent directly to TREASURY, in raw USDC units.
     */
    event BikeUpgraded(address indexed player, uint256 indexed bikeId, uint8 newLevel, uint256 cost);

    /**
     * @notice Configure the permanent token, treasury, and bike catalogue.
     * @param usdc Nonzero address of standard 6-decimal USDC.
     * @param treasury Nonzero payment recipient, other than this contract.
     * @param prices Purchase prices in raw USDC units; index 0 must be zero.
     * @param upgradeSteps Per-bike upgrade steps in raw USDC units.
     */
    constructor(address usdc, address treasury, uint256[] memory prices, uint256[] memory upgradeSteps) {
        if (usdc == address(0) || treasury == address(0)) revert ZeroAddress();
        if (treasury == address(this)) revert InvalidTreasury();
        if (prices.length != upgradeSteps.length) revert CatalogueLengthMismatch();
        if (prices.length == 0 || prices.length > 16) revert InvalidBikeCount();
        if (prices[0] != 0) revert StarterBikeNotFree();

        USDC = IERC20(usdc);
        TREASURY = treasury;
        bikeCount = prices.length;
        _prices = prices;
        _upgradeSteps = upgradeSteps;
    }

    /**
     * @notice Buy a non-starter bike permanently for the caller at level 0.
     * @dev Requires sufficient USDC balance and allowance. State is recorded before
     * transfer; a failed payment rolls back ownership. Zero-price payments still
     * call safeTransferFrom and follow the token's transfer restrictions.
     * @param bikeId Catalogue ID from 1 through bikeCount - 1.
     */
    function buyBike(uint256 bikeId) external nonReentrant {
        _checkBikeId(bikeId);
        if (bikeId == 0) revert StarterBikeCannotBePurchased();
        if (_garage[msg.sender][bikeId] != 0) revert BikeAlreadyOwned(bikeId);

        uint256 price = _prices[bikeId];
        _garage[msg.sender][bikeId] = 1;
        USDC.safeTransferFrom(msg.sender, TREASURY, price);
        emit BikePurchased(msg.sender, bikeId, price);
    }

    /**
     * @notice Upgrade an owned bike by one level, including the free starter bike.
     * @dev Cost is upgradeStep * (currentLevel + 1). State is updated before
     * payment; a failed transfer rolls back the upgrade. Requires USDC allowance.
     * @param bikeId Valid catalogue ID owned by the caller.
     */
    function upgradeBike(uint256 bikeId) external nonReentrant {
        _checkBikeId(bikeId);
        uint8 encoded = _encodedOwnership(msg.sender, bikeId);
        if (encoded == 0) revert BikeNotOwned(bikeId);
        uint8 currentLevel = encoded - 1;
        if (currentLevel >= MAX_LEVEL) revert MaxLevelReached(bikeId);

        uint8 newLevel = currentLevel + 1;
        uint256 cost = _upgradeCost(bikeId, newLevel);
        _garage[msg.sender][bikeId] = newLevel + 1;
        USDC.safeTransferFrom(msg.sender, TREASURY, cost);
        emit BikeUpgraded(msg.sender, bikeId, newLevel, cost);
    }

    /**
     * @notice Read a bike's purchase price in raw USDC units.
     * @param bikeId Valid catalogue ID; invalid IDs revert.
     * @return The permanent purchase price (zero for starter bike 0).
     */
    function priceOf(uint256 bikeId) external view returns (uint256) {
        _checkBikeId(bikeId);
        return _prices[bikeId];
    }

    /**
     * @notice Read a bike's upgrade price step in raw USDC units.
     * @param bikeId Valid catalogue ID; invalid IDs revert.
     * @return The permanent upgrade step.
     */
    function upgradeStepOf(uint256 bikeId) external view returns (uint256) {
        _checkBikeId(bikeId);
        return _upgradeSteps[bikeId];
    }

    /**
     * @notice Check ownership; bike 0 is owned by every wallet without registration.
     * @param player Wallet whose garage is queried.
     * @param bikeId Valid catalogue ID; invalid IDs revert.
     * @return Whether the player owns the bike.
     */
    function isOwned(address player, uint256 bikeId) external view returns (bool) {
        _checkBikeId(bikeId);
        return _encodedOwnership(player, bikeId) != 0;
    }

    /**
     * @notice Read a bike's upgrade level, returning zero for an unowned bike.
     * @dev Use isOwned to distinguish an unowned bike from an owned level-0 bike.
     * @param player Wallet whose garage is queried.
     * @param bikeId Valid catalogue ID; invalid IDs revert.
     * @return Level from 0 through MAX_LEVEL, or zero when unowned.
     */
    function levelOf(address player, uint256 bikeId) external view returns (uint8) {
        _checkBikeId(bikeId);
        uint8 encoded = _encodedOwnership(player, bikeId);
        return encoded == 0 ? 0 : encoded - 1;
    }

    /**
     * @notice Quote the next upgrade in raw USDC units, or zero if unowned/maxed.
     * @dev A zero-cost configured upgrade also returns zero. Reverts with
     * UpgradeCostOverflow if the configured next price cannot fit in uint256.
     * @param player Wallet whose garage is queried.
     * @param bikeId Valid catalogue ID; invalid IDs revert.
     * @return Next upgrade cost, or zero when unowned or at MAX_LEVEL.
     */
    function upgradeCostOf(address player, uint256 bikeId) external view returns (uint256) {
        _checkBikeId(bikeId);
        uint8 encoded = _encodedOwnership(player, bikeId);
        if (encoded == 0 || encoded > MAX_LEVEL) return 0;
        return _upgradeCost(bikeId, encoded);
    }

    /**
     * @notice Read ownership and upgrade levels for the entire catalogue at once.
     * @param player Wallet whose persistent garage is queried.
     * @return owned Ownership flags indexed by bike ID; starter bike 0 is true.
     * @return levels Upgrade levels indexed by bike ID; unowned bikes return zero.
     */
    function garageOf(address player) external view returns (bool[] memory owned, uint8[] memory levels) {
        uint256 count = bikeCount;
        owned = new bool[](count);
        levels = new uint8[](count);
        for (uint256 i = 0; i < count; ++i) {
            uint8 encoded = _encodedOwnership(player, i);
            owned[i] = encoded != 0;
            levels[i] = encoded == 0 ? 0 : encoded - 1;
        }
    }

    /// @dev Enforce catalogue bounds consistently for every bike-specific call.
    function _checkBikeId(uint256 bikeId) private view {
        if (bikeId >= bikeCount) revert InvalidBikeId(bikeId);
    }

    /// @dev Resolve implicit starter ownership using the same encoding as storage.
    function _encodedOwnership(address player, uint256 bikeId) private view returns (uint8) {
        uint8 encoded = _garage[player][bikeId];
        return bikeId == 0 && encoded == 0 ? 1 : encoded;
    }

    /// @dev Calculate a next-level cost with an explicit custom overflow error.
    function _upgradeCost(uint256 bikeId, uint8 nextLevel) private view returns (uint256) {
        uint256 step = _upgradeSteps[bikeId];
        if (step > type(uint256).max / uint256(nextLevel)) revert UpgradeCostOverflow(bikeId);
        return step * uint256(nextLevel);
    }
}
