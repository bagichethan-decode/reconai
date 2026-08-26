/**
 * ReconAI Local Exception Explanation Engine
 *
 * This module provides deterministic explanations and
 * suggested actions for reconciliation exceptions.
 *
 * It does not change reconciliation decisions.
 * The matcher remains the source of truth.
 */

const EXPLANATIONS = {
    AMOUNT_MISMATCH: {
        explanation:
            "The settlement gross amount differs from the order amount beyond the configured tolerance.",

        suggested_action:
            "Review the order and settlement records and verify the payment gateway transaction."
    },

    NO_SETTLEMENT: {
        explanation:
            "No settlement record could be associated with the order.",

        suggested_action:
            "Check the payment gateway settlement report and verify whether the order was successfully captured."
    },

    MISSING_BANK: {
        explanation:
            "A settlement was found, but no corresponding bank credit was identified for the settled amount.",

        suggested_action:
            "Verify the bank statement and search for the settlement using the payment reference or UTR."
    },

    DUPLICATE_SETTLEMENT: {
        explanation:
            "Multiple settlement records are associated with the same order reference.",

        suggested_action:
            "Review the duplicate settlement records and determine whether one represents a duplicate payment or adjustment."
    },

    FUZZY_MATCH: {
        explanation:
            "The settlement reference differs from the order reference but is sufficiently similar to be considered a probable match.",

        suggested_action:
            "Review the reference manually and confirm that the settlement belongs to the order."
    },

    EXACT_MATCH: {
        explanation:
            "The order and settlement matched using the expected reference, amount and settlement timing.",

        suggested_action:
            "No manual action is required unless additional verification is needed."
    },

    FEE_ADJUSTED_MATCH: {
        explanation:
            "The settlement amount reconciles with the bank credit after accounting for the applicable settlement fee.",

        suggested_action:
            "No manual action is required; retain the reconciliation record for audit purposes."
    },

    UNRESOLVED: {
        explanation:
            "A potentially related settlement was found, but the available evidence was not strong enough for a safe automatic match.",

        suggested_action:
            "Review the order, settlement and bank records manually before approving the reconciliation."
    }
};

function explainException(result) {
    if (!result) {
        throw new Error(
            "A reconciliation result is required."
        );
    }

    const category =
        String(
            result.category || ""
        ).toUpperCase();

    const explanation =
        EXPLANATIONS[category];

    if (explanation) {
        return {
            explanation:
                explanation.explanation,

            suggested_action:
                explanation.suggested_action
        };
    }

    return {
        explanation:
            result.reason ||
            "The reconciliation engine identified an exception requiring review.",

        suggested_action:
            "Review the order, settlement and bank records before completing the reconciliation."
    };
}

module.exports = {
    explainException
};