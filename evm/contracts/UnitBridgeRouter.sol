// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import {WUNIT} from "./WUNIT.sol";
import {UnitUsdcStablePool} from "./UnitUsdcStablePool.sol";

contract UnitBridgeRouter is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20Metadata;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    WUNIT public immutable wunit;
    IERC20Metadata public immutable usdc;
    UnitUsdcStablePool public immutable pool;

    mapping(bytes32 => bool) public fulfilledIntentIds;
    mapping(bytes32 => bool) public processedReleaseIds;

    event BridgeFulfilled(
        bytes32 indexed intentId,
        address indexed recipient,
        uint256 wunitAmount,
        bool autoSwapRequested,
        bool autoSwapSucceeded,
        uint256 payoutAmount,
        address payoutToken
    );
    event AutoSwapFallback(bytes32 indexed intentId, uint256 wunitAmount, string reason);
    event RedemptionRequested(
        bytes32 indexed releaseId,
        address indexed requester,
        string destinationTaprootAddress,
        uint256 amount,
        address indexed sourceAsset
    );

    constructor(address admin, address wunit_, address usdc_, address pool_) {
        wunit = WUNIT(wunit_);
        usdc = IERC20Metadata(usdc_);
        pool = UnitUsdcStablePool(pool_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function fulfillBridge(
        bytes32 intentId,
        address recipient,
        uint256 amount,
        bool autoSwap,
        uint256 minUsdcOut
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused nonReentrant returns (uint256 payoutAmount, address payoutToken) {
        require(!fulfilledIntentIds[intentId], "intent fulfilled");
        require(recipient != address(0), "recipient=0");
        require(amount > 0, "amount=0");

        fulfilledIntentIds[intentId] = true;

        if (!autoSwap) {
            wunit.mint(recipient, amount);
            emit BridgeFulfilled(intentId, recipient, amount, false, false, amount, address(wunit));
            return (amount, address(wunit));
        }

        wunit.mint(address(this), amount);
        wunit.approve(address(pool), amount);

        try pool.swap(0, amount, minUsdcOut, recipient) returns (uint256 amountOut) {
            emit BridgeFulfilled(intentId, recipient, amount, true, true, amountOut, address(usdc));
            return (amountOut, address(usdc));
        } catch Error(string memory reason) {
            IERC20Metadata(address(wunit)).safeTransfer(recipient, amount);
            emit AutoSwapFallback(intentId, amount, reason);
            emit BridgeFulfilled(intentId, recipient, amount, true, false, amount, address(wunit));
            return (amount, address(wunit));
        } catch {
            IERC20Metadata(address(wunit)).safeTransfer(recipient, amount);
            emit AutoSwapFallback(intentId, amount, "unknown");
            emit BridgeFulfilled(intentId, recipient, amount, true, false, amount, address(wunit));
            return (amount, address(wunit));
        }
    }

    function requestRedemption(
        bytes32 releaseId,
        uint256 amount,
        string calldata destinationTaprootAddress
    ) external whenNotPaused nonReentrant {
        require(!processedReleaseIds[releaseId], "release exists");
        require(amount > 0, "amount=0");
        require(bytes(destinationTaprootAddress).length > 0, "taproot=0");

        processedReleaseIds[releaseId] = true;

        IERC20Metadata(address(wunit)).safeTransferFrom(msg.sender, address(this), amount);
        wunit.operatorBurn(address(this), amount);

        emit RedemptionRequested(releaseId, msg.sender, destinationTaprootAddress, amount, address(wunit));
    }

    function previewAutoSwap(uint256 amountIn) external view returns (uint256) {
        return pool.quoteSwap(0, amountIn);
    }
}
