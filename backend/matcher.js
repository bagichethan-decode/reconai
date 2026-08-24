const pool = require("./db");
const stringSimilarity = require("string-similarity");

// ============================================================
// ReconAI - Multi-Source Payment Reconciliation Engine
// ============================================================

const DATE_TOLERANCE_DAYS = 3;
const FUZZY_DATE_TOLERANCE_DAYS = 7;

const AMOUNT_TOLERANCE = 1.00;
const ROUNDING_TOLERANCE = 0.50;

const FUZZY_THRESHOLD = 0.70;

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------

function normalizeReference(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function normalizeAmount(value) {
    return Number(Number(value).toFixed(2));
}

function amountDifference(a, b) {
    return Math.abs(
        normalizeAmount(a) -
        normalizeAmount(b)
    );
}

function amountsMatch(
    a,
    b,
    tolerance = AMOUNT_TOLERANCE
) {
    return amountDifference(a, b) <= tolerance;
}

function daysBetween(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);

    const millisecondsPerDay =
        24 * 60 * 60 * 1000;

    return Math.abs(
        Math.round(
            (b - a) /
            millisecondsPerDay
        )
    );
}

// ------------------------------------------------------------
// Reference similarity
// ------------------------------------------------------------

function referenceSimilarity(orderId, settlementRef) {
    const orderRef =
        normalizeReference(orderId);

    const settlementReference =
        normalizeReference(settlementRef);

    if (
        !orderRef ||
        !settlementReference
    ) {
        return 0;
    }

    return stringSimilarity.compareTwoStrings(
        orderRef,
        settlementReference
    );
}

// Extract numeric part.
//
// ORD-1150      -> 1150
// ORDX-1150     -> 1150
// ORD-1150-X    -> 1150
// ORD-1150_X    -> 1150
//
function referenceNumber(value) {
    const match =
        String(value || "").match(
            /(\d{4})/
        );

    return match
        ? match[1]
        : null;
}

function isControlledTypoReference(
    orderId,
    settlementRef
) {
    const orderNumber =
        referenceNumber(orderId);

    const settlementNumber =
        referenceNumber(settlementRef);

    if (
        !orderNumber ||
        !settlementNumber
    ) {
        return false;
    }

    return (
        orderNumber ===
        settlementNumber &&
        normalizeReference(orderId) !==
        normalizeReference(settlementRef)
    );
}

// ------------------------------------------------------------
// Load database data
// ------------------------------------------------------------

async function loadData(connection) {
    const [orders] =
        await connection.query(`
            SELECT
                order_id,
                customer_name,
                amount,
                order_date,
                status
            FROM orders
            ORDER BY order_id
        `);

    const [settlements] =
        await connection.query(`
            SELECT
                settlement_id,
                payment_id,
                order_ref,
                gross_amount,
                fee,
                settled_amount,
                settlement_date
            FROM settlements
            ORDER BY settlement_id
        `);

    const [bankEntries] =
        await connection.query(`
            SELECT
                utr,
                amount,
                value_date,
                narration
            FROM bank_statement
            ORDER BY value_date, utr
        `);

    return {
        orders,
        settlements,
        bankEntries
    };
}

// ------------------------------------------------------------
// Find exact reference settlements
// ------------------------------------------------------------

function findExactReferenceSettlements(
    order,
    settlements
) {
    const orderRef =
        normalizeReference(
            order.order_id
        );

    return settlements.filter(
        settlement =>
            normalizeReference(
                settlement.order_ref
            ) === orderRef
    );
}

// ------------------------------------------------------------
// PASS 1
//
// Exact reference + amount + normal date
// ------------------------------------------------------------

function findExactSettlement(
    order,
    settlements,
    usedSettlementIds
) {
    const orderRef =
        normalizeReference(
            order.order_id
        );

    return settlements.find(
        settlement => {

            if (
                usedSettlementIds.has(
                    settlement.settlement_id
                )
            ) {
                return false;
            }

            const settlementRef =
                normalizeReference(
                    settlement.order_ref
                );

            const sameReference =
                settlementRef ===
                orderRef;

            const sameAmount =
                amountsMatch(
                    order.amount,
                    settlement.gross_amount
                );

            const validDate =
                daysBetween(
                    order.order_date,
                    settlement.settlement_date
                ) <= DATE_TOLERANCE_DAYS;

            return (
                sameReference &&
                sameAmount &&
                validDate
            );
        }
    );
}

// ------------------------------------------------------------
// PASS 2
//
// Settlement net amount -> bank statement
// ------------------------------------------------------------

function findBankEntry(
    settlement,
    bankEntries,
    usedBankUtrs
) {
    return bankEntries.find(
        bank => {

            if (
                usedBankUtrs.has(
                    bank.utr
                )
            ) {
                return false;
            }

            return (
                amountDifference(
                    settlement.settled_amount,
                    bank.amount
                ) <=
                ROUNDING_TOLERANCE
            );
        }
    );
}

// ------------------------------------------------------------
// PASS 3
//
// Fuzzy reference matching.
//
// IMPORTANT:
// - Same numeric order number is a strong signal.
// - Amount must match.
// - Settlement date must be reasonable.
// - Exact references are preferred elsewhere.
// ------------------------------------------------------------

function findFuzzySettlement(
    order,
    settlements,
    usedSettlementIds
) {
    const candidates = [];

    for (
        const settlement
        of settlements
    ) {
        if (
            usedSettlementIds.has(
                settlement.settlement_id
            )
        ) {
            continue;
        }

        const exactReference =
            normalizeReference(
                settlement.order_ref
            ) ===
            normalizeReference(
                order.order_id
            );

        if (exactReference) {
            continue;
        }

        const similarity =
            referenceSimilarity(
                order.order_id,
                settlement.order_ref
            );

        const controlledTypo =
            isControlledTypoReference(
                order.order_id,
                settlement.order_ref
            );

        const amountMatches =
            amountsMatch(
                order.amount,
                settlement.gross_amount
            );

        if (!amountMatches) {
            continue;
        }

        const dateDifference =
            daysBetween(
                order.order_date,
                settlement.settlement_date
            );

        if (
            dateDifference >
            FUZZY_DATE_TOLERANCE_DAYS
        ) {
            continue;
        }

        if (
            controlledTypo ||
            similarity >= FUZZY_THRESHOLD
        ) {
            candidates.push({
                settlement,
                similarity:
                    controlledTypo
                        ? Math.max(
                            similarity,
                            0.95
                        )
                        : similarity,
                dateDifference
            });
        }
    }

    candidates.sort(
        (a, b) => {

            if (
                b.similarity !==
                a.similarity
            ) {
                return (
                    b.similarity -
                    a.similarity
                );
            }

            return (
                a.dateDifference -
                b.dateDifference
            );
        }
    );

    return candidates.length > 0
        ? candidates[0]
        : null;
}

// ------------------------------------------------------------
// AMOUNT MISMATCH
//
// IMPORTANT:
//
// We look for an exact reference FIRST,
// regardless of amount.
//
// This is the key fix.
// ------------------------------------------------------------

function findAmountMismatchSettlement(
    order,
    settlements,
    usedSettlementIds
) {
    const exactMatches =
        findExactReferenceSettlements(
            order,
            settlements
        );

    const available =
        exactMatches.filter(
            settlement =>
                !usedSettlementIds.has(
                    settlement.settlement_id
                )
        );

    if (
        available.length === 0
    ) {
        return null;
    }

    const mismatch =
        available.find(
            settlement =>
                amountDifference(
                    order.amount,
                    settlement.gross_amount
                ) >
                AMOUNT_TOLERANCE
        );

    return mismatch || null;
}

// ------------------------------------------------------------
// Classify unmatched order
// ------------------------------------------------------------

function classifyUnmatchedOrder(
    order,
    settlements
) {
    const exactReferenceMatches =
        findExactReferenceSettlements(
            order,
            settlements
        );

    // No exact reference.
    if (
        exactReferenceMatches.length === 0
    ) {
        return {
            category:
                "NO_SETTLEMENT",

            confidence:
                "HIGH",

            reason:
                "No settlement record was found for this order."
        };
    }

    // Exact reference exists but amount differs.
    const amountMismatch =
        exactReferenceMatches.some(
            settlement =>
                amountDifference(
                    order.amount,
                    settlement.gross_amount
                ) >
                AMOUNT_TOLERANCE
        );

    if (amountMismatch) {
        return {
            category:
                "AMOUNT_MISMATCH",

            confidence:
                "HIGH",

            reason:
                "A settlement exists for this order reference, but its gross amount differs beyond the allowed tolerance."
        };
    }

    return {
        category:
            "UNRESOLVED",

        confidence:
            "MEDIUM",

        reason:
            "A settlement appears related to the order but could not be safely matched."
    };
}

// ------------------------------------------------------------
// PASS 4
//
// Duplicate settlements.
// ------------------------------------------------------------

function findDuplicateSettlements(
    orders,
    settlements,
    primaryMatches
) {
    const duplicateResults = [];

    for (
        const order of orders
    ) {
        const exactMatches =
            findExactReferenceSettlements(
                order,
                settlements
            );

        if (
            exactMatches.length <= 1
        ) {
            continue;
        }

        const primaryMatch =
            primaryMatches.get(
                order.order_id
            );

        for (
            const settlement
            of exactMatches
        ) {
            if (
                primaryMatch &&
                primaryMatch.settlement_id ===
                settlement.settlement_id
            ) {
                continue;
            }

            duplicateResults.push({
                order_id:
                    order.order_id,

                payment_id:
                    settlement.payment_id,

                settlement_id:
                    settlement.settlement_id,

                status:
                    "EXCEPTION",

                pass:
                    "PASS_4_DUPLICATE",

                confidence:
                    "HIGH",

                category:
                    "DUPLICATE_SETTLEMENT",

                difference:
                    amountDifference(
                        order.amount,
                        settlement.gross_amount
                    ),

                reason:
                    "Multiple settlement records use the same order reference; this settlement is an additional occurrence."
            });
        }
    }

    return duplicateResults;
}

// ------------------------------------------------------------
// MAIN RECONCILIATION
// ------------------------------------------------------------

async function runReconciliation() {
    let connection;

    try {
        connection =
            await pool.getConnection();

        console.log(
            "=============================================="
        );

        console.log(
            "        ReconAI Reconciliation Engine"
        );

        console.log(
            "==============================================\n"
        );

        const {
            orders,
            settlements,
            bankEntries
        } = await loadData(
            connection
        );

        console.log(
            `Orders loaded: ${orders.length}`
        );

        console.log(
            `Settlements loaded: ${settlements.length}`
        );

        console.log(
            `Bank entries loaded: ${bankEntries.length}\n`
        );

        const usedSettlementIds =
            new Set();

        const usedBankUtrs =
            new Set();

        const primaryResults =
            new Map();

        let pass1Count = 0;
        let pass2Count = 0;
        let pass3Count = 0;
        let pass5Count = 0;

        // ====================================================
        // PASS 1
        // Exact matching
        // ====================================================

        for (
            const order of orders
        ) {
            const settlement =
                findExactSettlement(
                    order,
                    settlements,
                    usedSettlementIds
                );

            if (!settlement) {
                continue;
            }

            usedSettlementIds.add(
                settlement.settlement_id
            );

            primaryResults.set(
                order.order_id,
                {
                    order_id:
                        order.order_id,

                    payment_id:
                        settlement.payment_id,

                    settlement_id:
                        settlement.settlement_id,

                    status:
                        "MATCHED",

                    pass:
                        "PASS_1_EXACT",

                    confidence:
                        "HIGH",

                    category:
                        "EXACT_MATCH",

                    difference:
                        amountDifference(
                            order.amount,
                            settlement.gross_amount
                        ),

                    reason:
                        "Order reference, amount and settlement timing matched."
                }
            );

            pass1Count++;
        }

        // ====================================================
        // PASS 2
        // Bank verification
        // ====================================================

        for (
            const [
                orderId,
                result
            ] of primaryResults
        ) {
            const settlement =
                settlements.find(
                    item =>
                        item.settlement_id ===
                        result.settlement_id
                );

            if (!settlement) {
                continue;
            }

            const bank =
                findBankEntry(
                    settlement,
                    bankEntries,
                    usedBankUtrs
                );

            if (!bank) {
                result.category =
                    "MISSING_BANK";

                result.pass =
                    "PASS_2_BANK_CHECK";

                result.confidence =
                    "HIGH";

                result.status =
                    "EXCEPTION";

                result.utr = null;

                result.reason =
                    "Settlement was found, but no corresponding bank credit was found for the settled amount.";

                continue;
            }

            usedBankUtrs.add(
                bank.utr
            );

            result.utr =
                bank.utr;

            result.bank_amount =
                normalizeAmount(
                    bank.amount
                );

            result.bank_difference =
                amountDifference(
                    settlement.settled_amount,
                    bank.amount
                );

            result.pass =
                "PASS_2_FEE_ADJUSTED";

            result.category =
                "FEE_ADJUSTED_MATCH";

            result.confidence =
                "HIGH";

            result.reason =
                "Settlement net amount matched the bank credit after gateway fee deduction.";

            pass2Count++;
        }

        // ====================================================
        // PASS 3A
        //
        // AMOUNT_MISMATCH must be checked BEFORE fuzzy
        // matching.
        // ====================================================

        for (
            const order of orders
        ) {
            if (
                primaryResults.has(
                    order.order_id
                )
            ) {
                continue;
            }

            const mismatch =
                findAmountMismatchSettlement(
                    order,
                    settlements,
                    usedSettlementIds
                );

            if (!mismatch) {
                continue;
            }

            usedSettlementIds.add(
                mismatch.settlement_id
            );

            primaryResults.set(
                order.order_id,
                {
                    order_id:
                        order.order_id,

                    payment_id:
                        mismatch.payment_id,

                    settlement_id:
                        mismatch.settlement_id,

                    status:
                        "EXCEPTION",

                    pass:
                        "PASS_3_AMOUNT_CHECK",

                    confidence:
                        "HIGH",

                    category:
                        "AMOUNT_MISMATCH",

                    difference:
                        amountDifference(
                            order.amount,
                            mismatch.gross_amount
                        ),

                    reason:
                        "A settlement exists for the exact order reference, but its gross amount differs beyond the allowed tolerance."
                }
            );
        }

        // ====================================================
        // PASS 3B
        // Fuzzy reference matching
        // ====================================================

        for (
            const order of orders
        ) {
            if (
                primaryResults.has(
                    order.order_id
                )
            ) {
                continue;
            }

            const fuzzyMatch =
                findFuzzySettlement(
                    order,
                    settlements,
                    usedSettlementIds
                );

            if (!fuzzyMatch) {
                continue;
            }

            const settlement =
                fuzzyMatch.settlement;

            usedSettlementIds.add(
                settlement.settlement_id
            );

            primaryResults.set(
                order.order_id,
                {
                    order_id:
                        order.order_id,

                    payment_id:
                        settlement.payment_id,

                    settlement_id:
                        settlement.settlement_id,

                    status:
                        "MATCHED_REVIEW",

                    pass:
                        "PASS_3_FUZZY",

                    confidence:
                        "MEDIUM",

                    category:
                        "FUZZY_MATCH",

                    similarity:
                        Number(
                            fuzzyMatch.similarity.toFixed(
                                3
                            )
                        ),

                    difference:
                        amountDifference(
                            order.amount,
                            settlement.gross_amount
                        ),

                    reason:
                        `Reference was fuzzy-matched with similarity ${fuzzyMatch.similarity.toFixed(3)}.`
                }
            );

            pass3Count++;
        }

        // ====================================================
        // PASS 5
        // Remaining exceptions
        // ====================================================

        for (
            const order of orders
        ) {
            if (
                primaryResults.has(
                    order.order_id
                )
            ) {
                continue;
            }

            const classification =
                classifyUnmatchedOrder(
                    order,
                    settlements
                );

            primaryResults.set(
                order.order_id,
                {
                    order_id:
                        order.order_id,

                    payment_id:
                        null,

                    settlement_id:
                        null,

                    status:
                        "EXCEPTION",

                    pass:
                        "PASS_5_EXCEPTION",

                    confidence:
                        classification.confidence,

                    category:
                        classification.category,

                    difference:
                        null,

                    reason:
                        classification.reason
                }
            );

            pass5Count++;
        }

        // ====================================================
        // PASS 4
        // Duplicate settlements
        // ====================================================

        const duplicateResults =
            findDuplicateSettlements(
                orders,
                settlements,
                primaryResults
            );

        // ====================================================
        // Results
        // ====================================================

        const primaryArray =
            Array.from(
                primaryResults.values()
            );

        const matchedPrimary =
            primaryArray.filter(
                result =>
                    result.status ===
                        "MATCHED" ||
                    result.status ===
                        "MATCHED_REVIEW"
            );

        const exceptionPrimary =
            primaryArray.filter(
                result =>
                    result.status ===
                    "EXCEPTION"
            );

        const matchRate =
            orders.length === 0
                ? 0
                :
                    (
                        matchedPrimary.length /
                        orders.length
                    ) *
                    100;

        // ====================================================
        // Category counts
        // ====================================================

        const categoryCounts = {};

        for (
            const result of primaryArray
        ) {
            categoryCounts[
                result.category
            ] =
                (
                    categoryCounts[
                        result.category
                    ] || 0
                ) + 1;
        }

        for (
            const result of duplicateResults
        ) {
            categoryCounts[
                result.category
            ] =
                (
                    categoryCounts[
                        result.category
                    ] || 0
                ) + 1;
        }

        // ====================================================
        // Summary
        // ====================================================

        console.log(
            "--------------- SUMMARY ----------------"
        );

        console.log(
            `Orders processed: ${orders.length}`
        );

        console.log(
            `Primary results: ${primaryArray.length}`
        );

        console.log(
            `Matched orders: ${matchedPrimary.length}`
        );

        console.log(
            `Primary exceptions: ${exceptionPrimary.length}`
        );

        console.log(
            `Duplicate settlements: ${duplicateResults.length}`
        );

        console.log(
            `Match rate: ${matchRate.toFixed(2)}%`
        );

        console.log("");

        console.log(
            "--------------- PASS BREAKDOWN ----------"
        );

        console.log(
            `Pass 1 - Exact: ${pass1Count}`
        );

        console.log(
            `Pass 2 - Fee-adjusted bank verification: ${pass2Count}`
        );

        console.log(
            `Pass 3 - Fuzzy: ${pass3Count}`
        );

        console.log(
            `Pass 5 - Exceptions: ${pass5Count}`
        );

        console.log("");

        // ====================================================
        // Duplicate output
        // ====================================================

        console.log(
            "--------------- DUPLICATES ---------------"
        );

        console.log(
            `Duplicate settlement records: ${duplicateResults.length}`
        );

        for (
            const result
            of duplicateResults
        ) {
            console.log(
                `${result.order_id} | ${result.payment_id} | ${result.category}`
            );
        }

        console.log("");

        // ====================================================
        // Exception output
        // ====================================================

        console.log(
            "--------------- EXCEPTIONS --------------"
        );

        for (
            const result
            of exceptionPrimary
        ) {
            console.log(
                `${result.order_id} | ${result.category} | ${result.reason}`
            );
        }

        console.log("");

        // ====================================================
        // Category counts
        // ====================================================

        console.log(
            "--------------- CATEGORY COUNTS ---------"
        );

        for (
            const [
                category,
                count
            ] of Object.entries(
                categoryCounts
            )
        ) {
            console.log(
                `${category}: ${count}`
            );
        }

        console.log("");

        // ====================================================
        // Integrity
        // ====================================================

        console.log(
            "--------------- INTEGRITY CHECK ----------"
        );

        console.log(
            `Expected primary results: ${orders.length}`
        );

        console.log(
            `Actual primary results: ${primaryArray.length}`
        );

        if (
            primaryArray.length ===
            orders.length
        ) {
            console.log(
                "✅ Exactly one primary result per order."
            );
        } else {
            console.log(
                "❌ Integrity check failed."
            );
        }

        console.log("");

        console.log(
            "=============================================="
        );

        console.log(
            "Reconciliation test completed."
        );

        console.log(
            "=============================================="
        );

    } catch (error) {
        console.error(
            "\n❌ Reconciliation failed."
        );

        console.error(
            error.message
        );

        console.error(
            error.stack
        );

        process.exitCode = 1;

    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
}

runReconciliation();