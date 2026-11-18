// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HillClimbPot
 * @notice Permissionless USDC prize pool for a browser-based hill-climb moto game.
 * @dev Scores are self-reported by the game client and only bounded by a speed
 * plausibility cap. This is a known trust assumption suitable for a testnet/demo:
 * a production version would need a server-signed or provable score.
 * The configured token must be standard, non-rebasing, non-fee-on-transfer USDC
 * with 6 decimals. Entry fees and prizes are raw token units (1 USDC = 1e6).
 * There is no owner, admin, upgrade mechanism, protocol fee, or rescue function.
 * Only entry fees enter prize accounting; unsolicited token transfers are not
 * credited and cannot be rescued. Native currency is not accepted voluntarily.
 */
contract HillClimbPot is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The USDC token used for entry fees and prize payments.
    IERC20 public immutable USDC;

    /// @notice Entry fee per run in raw, 6-decimal USDC units.
    uint256 public immutable ENTRY_FEE;

    /// @notice Duration in seconds of each newly opened round.
    uint256 public immutable ROUND_DURATION;

    /// @notice Maximum accepted distance per elapsed second, in meters.
    uint256 public constant MAX_SPEED_MPS = 30;

    /// @notice Maximum elapsed time in seconds for an accepted run.
    uint256 public constant MAX_RUN_SECONDS = 900;

    /**
     * @notice Round timing, prize pot, and highest submitted distance.
     * @param endTime Exclusive deadline for score submissions.
     * @param pot Prize in raw USDC units; retained as historical data after rollover.
     * @param bestScore Best distance in meters; only a strictly higher score wins.
     * @param leader Leading player, or zero if no positive score was submitted.
     */
    struct Round {
        uint64 endTime;
        uint256 pot;
        uint32 bestScore;
        address leader;
    }

    /**
     * @notice The most recent unconsumed run for a player.
     * @param roundId Round in which the entry fee was paid.
     * @param startedAt Starting timestamp, or zero for no active run.
     */
    struct Run {
        uint64 roundId;
        uint64 startedAt;
    }

    /// @notice All rounds by ID, including historical rounds.
    mapping(uint256 => Round) public rounds;

    /// @notice Current round ID; starts at one and advances once per rollover.
    uint256 public currentRoundId;

    /// @notice Latest unconsumed run for each player; older runs may be stale.
    mapping(address => Run) public runs;

    /// @notice Unclaimed prizes in raw USDC units for each player.
    mapping(address => uint256) public winnings;

    /// @notice The configured USDC address is zero.
    error ZeroAddress();
    /// @notice The entry fee is zero.
    error ZeroEntryFee();
    /// @notice The round duration is zero.
    error ZeroRoundDuration();
    /// @notice A timestamp or round ID cannot be represented in uint64.
    error ValueOutOfRange();
    /// @notice The current round has not reached its deadline.
    error RoundNotEnded();
    /// @notice The player has no unconsumed run.
    error NoActiveRun();
    /// @notice The run belongs to another round or the current round has ended.
    error RunNotInCurrentRound();
    /// @notice The run exceeded the maximum permitted elapsed time.
    error RunExpired();
    /// @notice Distance exceeds the speed cap multiplied by elapsed seconds.
    error ImplausibleScore();
    /// @notice The player has no unclaimed prize.
    error NothingToClaim();

    /**
     * @notice A player paid for and started a run.
     * @param player Player who paid the entry fee.
     * @param roundId Round in which the run started.
     * @param startedAt Run start timestamp.
     */
    event RunStarted(address indexed player, uint256 indexed roundId, uint64 startedAt);

    /**
     * @notice A winning round's prize was credited for later withdrawal.
     * @param roundId Finalized round ID.
     * @param leader Winning player.
     * @param bestScore Winning distance in meters.
     * @param pot Prize credited in raw USDC units.
     */
    event RoundFinalized(uint256 indexed roundId, address indexed leader, uint32 bestScore, uint256 pot);

    /**
     * @notice A valid score consumed a run.
     * @param player Submitting player.
     * @param roundId Round receiving the score.
     * @param distanceMeters Submitted distance in meters.
     * @param becameLeader Whether this score strictly exceeded the previous best.
     */
    event ScoreSubmitted(
        address indexed player, uint256 indexed roundId, uint32 distanceMeters, bool becameLeader
    );

    /**
     * @notice A player withdrew accumulated winnings.
     * @param player Recipient of the USDC payment.
     * @param amount Amount paid in raw USDC units.
     */
    event Claimed(address indexed player, uint256 amount);

    /**
     * @notice Configure the prize pool and open round one.
     * @param usdc Nonzero address of the standard 6-decimal USDC token.
     * @param entryFee Nonzero fee in raw USDC units, with no decimal conversion.
     * @param roundDuration Nonzero round duration in seconds.
     */
    constructor(address usdc, uint256 entryFee, uint256 roundDuration) {
        if (usdc == address(0)) revert ZeroAddress();
        if (entryFee == 0) revert ZeroEntryFee();
        if (roundDuration == 0) revert ZeroRoundDuration();

        USDC = IERC20(usdc);
        ENTRY_FEE = entryFee;
        ROUND_DURATION = roundDuration;
        currentRoundId = 1;
        rounds[1].endTime = _nextEndTime();
    }

    /**
     * @notice Pay for a new run, rolling an ended round first.
     * @dev Requires USDC allowance of at least ENTRY_FEE. Replaces any unfinished
     * run without refund; its previous fee remains in its original round's pot.
     */
    function startRun() external nonReentrant {
        _rollRound();
        USDC.safeTransferFrom(msg.sender, address(this), ENTRY_FEE);
        uint256 id = currentRoundId;
        rounds[id].pot += ENTRY_FEE;
        uint64 startedAt = _asUint64(block.timestamp);
        runs[msg.sender] = Run({roundId: _asUint64(id), startedAt: startedAt});
        emit RunStarted(msg.sender, id, startedAt);
    }

    /**
     * @notice Finalize an ended round and open exactly one new round.
     * @dev Anyone may call. Reverts with RoundNotEnded before the deadline.
     * Prizes are credited for pull payment, never transferred during rollover.
     */
    function finalizeRound() external nonReentrant {
        if (block.timestamp < rounds[currentRoundId].endTime) revert RoundNotEnded();
        _rollRound();
    }

    /**
     * @notice Consume the caller's run and submit a plausible distance.
     * @dev Does not roll rounds. Ties keep the earlier leader; zero distance
     * consumes the run but cannot establish a leader. There are no external calls.
     * @param distanceMeters Self-reported distance traveled in whole meters.
     */
    function submitScore(uint32 distanceMeters) external {
        Run memory run = runs[msg.sender];
        if (run.startedAt == 0) revert NoActiveRun();

        uint256 id = currentRoundId;
        Round storage round = rounds[id];
        if (uint256(run.roundId) != id || block.timestamp >= round.endTime) {
            revert RunNotInCurrentRound();
        }

        uint256 elapsed = block.timestamp - uint256(run.startedAt);
        if (elapsed > MAX_RUN_SECONDS) revert RunExpired();
        if (uint256(distanceMeters) > elapsed * MAX_SPEED_MPS) revert ImplausibleScore();

        delete runs[msg.sender];
        bool becameLeader = distanceMeters > round.bestScore;
        if (becameLeader) {
            round.bestScore = distanceMeters;
            round.leader = msg.sender;
        }
        emit ScoreSubmitted(msg.sender, id, distanceMeters, becameLeader);
    }

    /// @notice Withdraw all of the caller's winnings using checks-effects-interactions.
    function claim() external nonReentrant {
        uint256 amount = winnings[msg.sender];
        if (amount == 0) revert NothingToClaim();
        winnings[msg.sender] = 0;
        USDC.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /**
     * @notice Read the current round without triggering rollover.
     * @return id Current round ID.
     * @return endTime Exclusive score deadline.
     * @return pot Current round's prize in raw USDC units.
     * @return bestScore Highest distance in meters.
     * @return leader Leading player, or zero if none.
     */
    function currentRound()
        external
        view
        returns (uint256 id, uint64 endTime, uint256 pot, uint32 bestScore, address leader)
    {
        id = currentRoundId;
        Round storage round = rounds[id];
        return (id, round.endTime, round.pot, round.bestScore, round.leader);
    }

    /**
     * @notice Read a round, including historical rounds.
     * @param id Round ID to query.
     * @return The round data; all zeroes for an unopened round.
     */
    function getRound(uint256 id) external view returns (Round memory) {
        return rounds[id];
    }

    /**
     * @notice Read a player's latest unconsumed run, which may be stale.
     * @param player Player to query.
     * @return The stored run, or zeroes if absent.
     */
    function runOf(address player) external view returns (Run memory) {
        return runs[player];
    }

    /**
     * @notice Read accumulated unclaimed prizes.
     * @param player Player to query.
     * @return Amount claimable in raw USDC units.
     */
    function winningsOf(address player) external view returns (uint256) {
        return winnings[player];
    }

    /**
     * @notice Read time remaining without triggering rollover.
     * @return Seconds until the current round ends, or zero if already ended.
     */
    function timeLeft() external view returns (uint256) {
        uint256 endTime = rounds[currentRoundId].endTime;
        return block.timestamp >= endTime ? 0 : endTime - block.timestamp;
    }

    /**
     * @dev Roll at most one round. Leaderless pots carry forward; winning pots
     * are credited exactly once. Historical round data is retained, not payable
     * again. A new round always begins from the timestamp of this call.
     */
    function _rollRound() internal {
        uint256 id = currentRoundId;
        Round storage round = rounds[id];
        if (block.timestamp < round.endTime) return;

        uint256 carry;
        if (round.leader != address(0)) {
            winnings[round.leader] += round.pot;
            emit RoundFinalized(id, round.leader, round.bestScore, round.pot);
        } else {
            carry = round.pot;
        }

        uint256 nextId = id + 1;
        _asUint64(nextId);
        uint64 endTime = _nextEndTime();
        currentRoundId = nextId;
        rounds[nextId] = Round({endTime: endTime, pot: carry, bestScore: 0, leader: address(0)});
    }

    /**
     * @dev Compute a representable deadline without truncation or addition overflow.
     * @return Exclusive end timestamp for a round opened now.
     */
    function _nextEndTime() internal view returns (uint64) {
        uint64 now64 = _asUint64(block.timestamp);
        if (ROUND_DURATION > uint256(type(uint64).max) - uint256(now64)) revert ValueOutOfRange();
        return uint64(uint256(now64) + ROUND_DURATION);
    }

    /**
     * @dev Reject values that would silently truncate when stored in a run or round.
     * @param value Unsigned value to narrow.
     * @return The unchanged value represented as uint64.
     */
    function _asUint64(uint256 value) internal pure returns (uint64) {
        if (value > type(uint64).max) revert ValueOutOfRange();
        return uint64(value);
    }
}
