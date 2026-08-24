const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const pool = require("./db");

const AMOUNT_TOLERANCE = 1.00;
const ROUNDING_TOLERANCE = 0.50;
const DATE_TOLERANCE_DAYS = 3;
const FUZZY_DATE_TOLERANCE_DAYS = 7;

function readCsv(filename) {
    const filePath = path.join(
        __dirname,
        "..",
        "data",
        filename
    );

    const content = fs.readFileSync(
        filePath,
        "utf8"
    );

    return parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
}

function normalizeReference(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function normalizeScenario(value) {
    if (!value) {
        return "";
    }

    const scenario = String(value)
        .trim()
        .toUpperCase()
        .replace(/[\s-]+/g, "_");

    const aliases = {
        DATE_DELAY: "DELAYED_SETTLEMENT",
        ROUNDING: "ROUNDING_DRIFT",
        TYPO: "TYPO_REF",
        TYPO_REFERENCE: "TYPO_REF",
        MISSING_SETTLEMENT: "NO_SETTLEMENT",
        MISSING_BANK: "NO_BANK"
    };

    return aliases[scenario] || scenario;
}

function amountDifference(a, b) {
    return Math.abs(
        Number(Number(a).toFixed(2)) -
        Number(Number(b).toFixed(2))
    );
}

function daysBetween(dateA, dateB) {
    const a = new Date(dateA);
    const b = new Date(dateB);

    return Math.abs(
        Math.round(
            (b - a) /
            (24 * 60 * 60 * 1000)
        )
    );
}

// ------------------------------------------------------------
// Controlled typo detection
// ------------------------------------------------------------

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
        orderNumber === settlementNumber &&
        normalizeReference(orderId) !==
            normalizeReference(settlementRef)
    );
}

// ------------------------------------------------------------
// Similarity
// ------------------------------------------------------------

function simpleSimilarity(a, b) {
    if (a === b) {
        return 1;
    }

    if (!a || !b) {
        return 0;
    }

    const maxLength =
        Math.max(
            a.length,
            b.length
        );

    let samePositions = 0;

    for (
        let i = 0;
        i < Math.min(
            a.length,
            b.length
        );
        i++
    ) {
        if (a[i] === b[i]) {
            samePositions++;
        }
    }

    return (
        samePositions /
        maxLength
    );
}

// ------------------------------------------------------------
// Load data
// ------------------------------------------------------------

async function loadData(connection) {
    const [orders] =
        await connection.query(`
            SELECT
                order_id,
                amount,
                order_date
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
// Find settlement by exact reference
// AMOUNT IS NOT REQUIRED HERE.
// This is critical for AMOUNT_MISMATCH.
// ------------------------------------------------------------

function exactReferenceSettlement(
    order,
    settlements,
    usedSettlementIds
) {
    const orderKey =
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

            return (
                normalizeReference(
                    settlement.order_ref
                ) === orderKey
            );
        }
    );
}

// ------------------------------------------------------------
// Find fuzzy/typo settlement
// ------------------------------------------------------------

function fuzzyReferenceSettlement(
    order,
    settlements,
    usedSettlementIds
) {
    const orderKey =
        normalizeReference(
            order.order_id
        );

    let best = null;

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

        const settlementKey =
            normalizeReference(
                settlement.order_ref
            );

        if (
            settlementKey === orderKey
        ) {
            continue;
        }

        const controlledTypo =
            isControlledTypoReference(
                order.order_id,
                settlement.order_ref
            );

        const similarity =
            simpleSimilarity(
                orderKey,
                settlementKey
            );

        const amountMatches =
            amountDifference(
                order.amount,
                settlement.gross_amount
            ) <= AMOUNT_TOLERANCE;

        const dateDifference =
            daysBetween(
                order.order_date,
                settlement.settlement_date
            );

        if (
            !amountMatches
        ) {
            continue;
        }

        if (
            dateDifference >
            FUZZY_DATE_TOLERANCE_DAYS
        ) {
            continue;
        }

        if (
            controlledTypo ||
            similarity >= 0.70
        ) {
            const score =
                controlledTypo
                    ? 1
                    : similarity;

            if (
                !best ||
                score >
                    best.score
            ) {
                best = {
                    settlement,
                    score
                };
            }
        }
    }

    return best
        ? best.settlement
        : null;
}

// ------------------------------------------------------------
// Bank lookup
// ------------------------------------------------------------

function findBank(
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
                ) <= ROUNDING_TOLERANCE
            );
        }
    );
}

// ------------------------------------------------------------
// Determine expected scenario from actual records
// ------------------------------------------------------------

function determineScenario(
    order,
    settlement,
    bank,
    duplicate,
    matchMethod
) {
    // Duplicate has highest priority.
    if (duplicate) {
        return "DUPLICATE";
    }

    // No settlement.
    if (!settlement) {
        return "NO_SETTLEMENT";
    }

    // Gross amount mismatch.
    if (
        amountDifference(
            order.amount,
            settlement.gross_amount
        ) > AMOUNT_TOLERANCE
    ) {
        return "AMOUNT_MISMATCH";
    }

    // Delayed settlement.
    const settlementDelay =
        daysBetween(
            order.order_date,
            settlement.settlement_date
        );

    if (
        settlementDelay >
        DATE_TOLERANCE_DAYS
    ) {
        return "DELAYED_SETTLEMENT";
    }

    // Typo reference.
    if (
        matchMethod === "FUZZY"
    ) {
        return "TYPO_REF";
    }

    // Missing bank.
    if (!bank) {
        return "NO_BANK";
    }

    // Rounding drift.
    if (
        amountDifference(
            settlement.settled_amount,
            bank.amount
        ) > 0
    ) {
        return "ROUNDING_DRIFT";
    }

    return "EXACT";
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function main() {
    let connection;

    try {
        connection =
            await pool.getConnection();

        console.log(
            "=============================================="
        );

        console.log(
            "        ReconAI Matcher Evaluation"
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

        const labels =
            readCsv(
                "scenario_labels.csv"
            );

        console.log(
            `Orders: ${orders.length}`
        );

        console.log(
            `Settlements: ${settlements.length}`
        );

        console.log(
            `Bank entries: ${bankEntries.length}`
        );

        console.log(
            `Ground-truth labels: ${labels.length}\n`
        );

        // ----------------------------------------------------
        // Ground truth
        // ----------------------------------------------------

        const truthMap =
            new Map();

        for (
            const row of labels
        ) {
            truthMap.set(
                normalizeReference(
                    row.order_id
                ),
                normalizeScenario(
                    row.scenario
                )
            );
        }

        const usedSettlementIds =
            new Set();

        const usedBankUtrs =
            new Set();

        const evaluations = [];

        // ----------------------------------------------------
        // Evaluate every order
        // ----------------------------------------------------

        for (
            const order of orders
        ) {
            const orderKey =
                normalizeReference(
                    order.order_id
                );

            const expected =
                truthMap.get(
                    orderKey
                ) || "UNKNOWN";

            // Exact-reference records,
            // INCLUDING amount mismatches.
            const exactReferenceMatches =
                settlements.filter(
                    settlement =>
                        normalizeReference(
                            settlement.order_ref
                        ) === orderKey
                );

            const isDuplicate =
                exactReferenceMatches.length >
                1;

            let settlement =
                exactReferenceSettlement(
                    order,
                    settlements,
                    usedSettlementIds
                );

            let matchMethod =
                settlement
                    ? "EXACT"
                    : null;

            // If exact reference wasn't found,
            // look for controlled typo.
            if (!settlement) {
                settlement =
                    fuzzyReferenceSettlement(
                        order,
                        settlements,
                        usedSettlementIds
                    );

                if (settlement) {
                    matchMethod =
                        "FUZZY";
                }
            }

            // ------------------------------------------------
            // Important:
            // If exact settlement exists but amount differs,
            // we still use it for classification.
            // ------------------------------------------------

            if (
                !settlement &&
                exactReferenceMatches.length > 0
            ) {
                const available =
                    exactReferenceMatches.filter(
                        item =>
                            !usedSettlementIds.has(
                                item.settlement_id
                            )
                    );

                if (
                    available.length > 0
                ) {
                    settlement =
                        available[0];

                    matchMethod =
                        "EXACT";
                }
            }

            let bank = null;

            if (settlement) {
                bank =
                    findBank(
                        settlement,
                        bankEntries,
                        usedBankUtrs
                    );
            }

            const detected =
                determineScenario(
                    order,
                    settlement,
                    bank,
                    isDuplicate,
                    matchMethod
                );

            // Consume settlement only after
            // classification.
            if (
                settlement
            ) {
                usedSettlementIds.add(
                    settlement.settlement_id
                );
            }

            if (
                bank
            ) {
                usedBankUtrs.add(
                    bank.utr
                );
            }

            evaluations.push({
                order_id:
                    order.order_id,

                expected,

                detected,

                correct:
                    expected === detected
            });
        }

        // ----------------------------------------------------
        // Accuracy
        // ----------------------------------------------------

        const correct =
            evaluations.filter(
                item =>
                    item.correct
            ).length;

        const incorrect =
            evaluations.filter(
                item =>
                    !item.correct
            );

        const accuracy =
            (
                correct /
                evaluations.length
            ) * 100;

        console.log(
            "--------------- OVERALL ----------------"
        );

        console.log(
            `Records evaluated: ${evaluations.length}`
        );

        console.log(
            `Correct classifications: ${correct}`
        );

        console.log(
            `Incorrect classifications: ${incorrect.length}`
        );

        console.log(
            `Accuracy: ${accuracy.toFixed(2)}%`
        );

        console.log("");

        // ----------------------------------------------------
        // Scenario accuracy
        // ----------------------------------------------------

        const scenarios = [
            "EXACT",
            "TYPO_REF",
            "DELAYED_SETTLEMENT",
            "ROUNDING_DRIFT",
            "DUPLICATE",
            "NO_SETTLEMENT",
            "NO_BANK",
            "AMOUNT_MISMATCH"
        ];

        console.log(
            "--------------- SCENARIO ACCURACY -------"
        );

        for (
            const scenario
            of scenarios
        ) {
            const rows =
                evaluations.filter(
                    item =>
                        item.expected ===
                        scenario
                );

            const right =
                rows.filter(
                    item =>
                        item.correct
                ).length;

            const percentage =
                rows.length === 0
                    ? 0
                    : (
                        right /
                        rows.length
                    ) * 100;

            console.log(
                `${scenario.padEnd(22)} ` +
                `${right}/${rows.length} ` +
                `(${percentage.toFixed(2)}%)`
            );
        }

        console.log("");

        // ----------------------------------------------------
        // Incorrect
        // ----------------------------------------------------

        console.log(
            "--------------- INCORRECT ---------------"
        );

        if (
            incorrect.length === 0
        ) {
            console.log(
                "🎉 No incorrect classifications."
            );
        } else {
            for (
                const item
                of incorrect
            ) {
                console.log(
                    `${item.order_id} | ` +
                    `Expected: ${item.expected} | ` +
                    `Detected: ${item.detected}`
                );
            }
        }

        console.log("");

        console.log(
            "=============================================="
        );

        console.log(
            "Evaluation completed."
        );

        console.log(
            "=============================================="
        );

    } catch (error) {
        console.error(
            "\n❌ Evaluation failed."
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

main();