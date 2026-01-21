// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// @title Errors
// @notice Custom error definitions for gas-efficient reverts
// @dev All contracts use these errors for consistent error handling

// ============ BOUNTY REGISTRY ERRORS ============

error BountyRegistry__InvalidEscrowAmount();
error BountyRegistry__InvalidDeadline();
error BountyRegistry__InvalidMinRepRequirement();
error BountyRegistry__BountyNotFound();
error BountyRegistry__BountyNotOpen();
error BountyRegistry__InsufficientReputation(uint16 required, uint16 actual);
error BountyRegistry__CapacityLimitReached(uint256 current, uint256 max);
error BountyRegistry__BountyValueExceedsTierLimit(uint256 bountyValue, uint256 maxAllowed);
error BountyRegistry__BountyAlreadyClaimed();
error BountyRegistry__CannotCancelWithSubmissions();
error BountyRegistry__NotBountyClient();
error BountyRegistry__BountyNotExpired();
error BountyRegistry__InvalidStateTransition(uint8 current, uint8 next);
error BountyRegistry__EscrowNotReleased(uint256 bountyId);
error BountyRegistry__CancellationAlreadyPending();
error BountyRegistry__CancellationNotPending();
error BountyRegistry__CancellationNotFound();
error BountyRegistry__ReviewPeriodNotExpired();
error BountyRegistry__AlreadyProcessed();

// ============ SUBMISSION MANAGER ERRORS ============

error SubmissionManager__BountyNotAssignedToYou();
error SubmissionManager__SubmissionNotFound();
error SubmissionManager__NotBountyClient();
error SubmissionManager__SubmissionAlreadyUnderReview();
error SubmissionManager__SubmissionNotUnderReview();
error SubmissionManager__FeedbackRequired();
error SubmissionManager__MaxRevisionsExceeded();
error SubmissionManager__QualityScoreTooLowForResubmission(uint16 score);
error SubmissionManager__ReviewPeriodNotExpired();
error SubmissionManager__SubmissionNotPending();
error SubmissionManager__CannotEditAfterReviewStarted();
error SubmissionManager__SubmissionAlreadyExists();

// ============ REPUTATION ORACLE ERRORS ============

error ReputationOracle__UnauthorizedUpdater();
error ReputationOracle__InvalidSignature();
error ReputationOracle__UpdateTooFrequent(uint256 lastUpdate, uint256 minInterval);
error ReputationOracle__ScoreOutOfBounds(uint16 score);
error ReputationOracle__UnauthorizedCaller();
error ReputationOracle__AppealTooFrequent();
error ReputationOracle__InvalidAdjustmentRange();

// ============ PAYMENT ESCROW ERRORS ============

error PaymentEscrow__InsufficientBalance(uint256 required, uint256 available);
error PaymentEscrow__InsufficientEscrowBalance(uint256 bountyId);
error PaymentEscrow__WithdrawalTooFrequent(uint256 nextAllowedTime);
error PaymentEscrow__TransferFailed();
error PaymentEscrow__InvalidBountyId();
error PaymentEscrow__UnauthorizedCaller();
error PaymentEscrow__InvalidFeePercentage();
error PaymentEscrow__ZeroAmount();
error PaymentEscrow__AmountMismatch(uint256 expected, uint256 actual);
error PaymentEscrow__InvalidBountyState();
error PaymentEscrow__ReferencesAlreadySet();

// ============ DISPUTE RESOLVER ERRORS ============

error DisputeResolver__NotPartyToDispute();
error DisputeResolver__DisputeNotFound();
error DisputeResolver__DisputeWindowClosed();
error DisputeResolver__DisputeAlreadyExists();
error DisputeResolver__DisputeAbusePrevention(uint256 winRate);
error DisputeResolver__ProfessionalismScoreTooLow(uint16 score);
error DisputeResolver__NotAssignedArbitrator();
error DisputeResolver__DisputeNotResolved();
error DisputeResolver__AppealNotAllowed(uint256 bountyValue, uint256 threshold);
error DisputeResolver__InvalidPaymentPercentage();
error DisputeResolver__UnauthorizedArbitrator();
error DisputeResolver__InvalidEvidence();
error DisputeResolver__InvalidConfidence();

// ============ EVENT REGISTRY ERRORS ============

error EventRegistry__UnauthorizedEmitter();

// ============ EMERGENCY PAUSE ERRORS ============

error EmergencyPause__NotPauser();
error EmergencyPause__AlreadyPaused();
error EmergencyPause__NotPaused();
error EmergencyPause__MaxPauseDurationExceeded();

// ============ GENERAL ERRORS ============

error InvalidAddress();
error Unauthorized();
error InvalidState();
error ReentrancyDetected();
