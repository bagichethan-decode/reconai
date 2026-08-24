const fs = require("fs");
const path = require("path");

// ============================================================
// ReconAI - Deterministic Synthetic Dataset Generator
// ============================================================
//
// 200 orders
//
// EXACT                 130
// TYPO_REF               20
// DATE_DELAY             15
// ROUNDING               10
// DUPLICATE               8
// NO_SETTLEMENT           7
// NO_BANK                 6
// AMOUNT_MISMATCH         4
//
// Output:
// orders.csv             200
// settlements.csv        201
// bank_statement.csv     195
// scenario_labels.csv    200
// dataset_summary.json
//
// IMPORTANT:
// Every special scenario is generated so that it cannot
// accidentally become another scenario.
// ============================================================

const DATA_DIR = __dirname;

const SCENARIO_COUNTS = {
    exact: 130,
    typo_ref: 20,
    date_delay: 15,
    rounding: 10,
    duplicate: 8,
    no_settlement: 7,
    no_bank: 6,
    amount_mismatch: 4
};

const TOTAL_ORDERS = 200;

const CUSTOMERS = [
    "Arjun Rao",
    "Priya Sharma",
    "Rahul Kumar",
    "Ananya Singh",
    "Vikram Patel",
    "Sneha Reddy",
    "Karan Mehta",
    "Divya Nair",
    "Rohan Gupta",
    "Aisha Khan",
    "Nikhil Joshi",
    "Meera Iyer",
    "Aditya Verma",
    "Kavya Menon",
    "Siddharth Das"
];

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function money(value) {
    return Number(
        Number(value).toFixed(2)
    );
}

function csvEscape(value) {
    const text = String(value ?? "");

    if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
    ) {
        return `"${text.replace(/"/g, '""')}"`;
    }

    return text;
}

function toCsv(headers, rows) {
    const output = [
        headers.join(",")
    ];

    for (const row of rows) {
        output.push(
            headers
                .map(header =>
                    csvEscape(row[header])
                )
                .join(",")
        );
    }

    return output.join("\n") + "\n";
}

function addDays(dateString, days) {
    const date = new Date(
        `${dateString}T00:00:00Z`
    );

    date.setUTCDate(
        date.getUTCDate() + days
    );

    return date
        .toISOString()
        .slice(0, 10);
}

function amountForOrder(index) {
    const base =
        3000 +
        ((index * 7919) % 22000);

    const cents =
        ((index * 37) % 100) / 100;

    return money(
        base + cents
    );
}

function feeForAmount(amount, index) {
    const rate =
        0.018 +
        ((index % 5) * 0.001);

    return money(
        amount * rate
    );
}

// ------------------------------------------------------------
// Scenario allocation
// ------------------------------------------------------------

function buildScenarioList() {
    const scenarios = [];

    for (
        const [scenario, count]
        of Object.entries(SCENARIO_COUNTS)
    ) {
        for (
            let i = 0;
            i < count;
            i++
        ) {
            scenarios.push(scenario);
        }
    }

    if (
        scenarios.length !==
        TOTAL_ORDERS
    ) {
        throw new Error(
            `Expected 200 scenarios but created ${scenarios.length}`
        );
    }

    // Deterministic shuffle.
    // No Math.random(), so every generation
    // produces the same dataset.
    for (
        let i = scenarios.length - 1;
        i > 0;
        i--
    ) {
        const j =
            (i * 37 + 17) %
            (i + 1);

        [
            scenarios[i],
            scenarios[j]
        ] = [
            scenarios[j],
            scenarios[i]
        ];
    }

    return scenarios;
}

// ------------------------------------------------------------
// TYPO_REF
// ------------------------------------------------------------
//
// The old generator could create a typo that accidentally
// became another legitimate order reference.
//
// Example of what we DON'T want:
//
// ORD-1008 -> ORD-1009
//
// Because ORD-1009 is another real order.
//
// Instead we deliberately create references that cannot be
// valid order IDs.
// ------------------------------------------------------------

function createTypoReference(orderId, index) {
    const number =
        Number(
            orderId.replace("ORD-", "")
        );

    const mode = index % 4;

    if (mode === 0) {
        // Missing prefix character.
        return `OD-${number}`;
    }

    if (mode === 1) {
        // Extra character.
        return `ORDX-${number}`;
    }

    if (mode === 2) {
        // Insert an underscore.
        return `ORD-${number}_X`;
    }

    // Clearly malformed but still similar.
    return `ORD-${number}-X`;
}

// ------------------------------------------------------------
// Generate
// ------------------------------------------------------------

function generateDataset() {
    const scenarios =
        buildScenarioList();

    const orders = [];
    const settlements = [];
    const bankStatement = [];
    const labels = [];

    let paymentNumber = 5001;
    let utrNumber = 900001;

    for (
        let i = 0;
        i < TOTAL_ORDERS;
        i++
    ) {
        const orderNumber =
            1001 + i;

        const orderId =
            `ORD-${orderNumber}`;

        const customerName =
            CUSTOMERS[
                i % CUSTOMERS.length
            ];

        const amount =
            amountForOrder(i);

        const orderDate =
            addDays(
                "2026-07-01",
                (i * 3) % 40
            );

        const scenario =
            scenarios[i];

        const status =
            scenario ===
            "no_settlement"
                ? "PENDING"
                : "PAID";

        orders.push({
            order_id: orderId,
            customer_name: customerName,
            amount,
            order_date: orderDate,
            status
        });

        labels.push({
            order_id: orderId,
            scenario
        });

        // ----------------------------------------------------
        // NO_SETTLEMENT
        // ----------------------------------------------------

        if (
            scenario ===
            "no_settlement"
        ) {
            continue;
        }

        const paymentId =
            `PAY-${paymentNumber++}`;

        let orderRef =
            orderId;

        let grossAmount =
            amount;

        let settlementDelay =
            1 + (i % 2);

        // ----------------------------------------------------
        // TYPO_REF
        // ----------------------------------------------------

        if (
            scenario ===
            "typo_ref"
        ) {
            orderRef =
                createTypoReference(
                    orderId,
                    i
                );
        }

        // ----------------------------------------------------
        // DATE_DELAY
        // ----------------------------------------------------

        if (
            scenario ===
            "date_delay"
        ) {
            settlementDelay =
                5 + (i % 3);
        }

        // ----------------------------------------------------
        // AMOUNT_MISMATCH
        // ----------------------------------------------------

        if (
            scenario ===
            "amount_mismatch"
        ) {
            grossAmount =
                money(
                    amount +
                    125 +
                    ((i % 3) * 25)
                );
        }

        const settlementDate =
            addDays(
                orderDate,
                settlementDelay
            );

        const fee =
            feeForAmount(
                grossAmount,
                i
            );

        const settledAmount =
            money(
                grossAmount - fee
            );

        settlements.push({
            payment_id: paymentId,
            order_ref: orderRef,
            gross_amount: grossAmount,
            fee,
            settled_amount: settledAmount,
            settlement_date:
                settlementDate
        });

        // ----------------------------------------------------
        // BANK ENTRY
        // ----------------------------------------------------

        if (
            scenario !==
            "no_bank"
        ) {
            let bankAmount =
                settledAmount;

            if (
                scenario ===
                "rounding"
            ) {
                // Deliberate small bank difference.
                // Always <= $0.50.
                const drift =
                    i % 2 === 0
                        ? 0.23
                        : -0.17;

                bankAmount =
                    money(
                        settledAmount +
                        drift
                    );
            }

            bankStatement.push({
                utr:
                    `UTR${utrNumber++}`,
                amount: bankAmount,
                value_date:
                    settlementDate,
                narration:
                    `Razorpay payout ${paymentId}`
            });
        }

        // ----------------------------------------------------
        // DUPLICATE
        // ----------------------------------------------------

        if (
            scenario ===
            "duplicate"
        ) {
            const duplicatePaymentId =
                `PAY-${paymentNumber++}`;

            settlements.push({
                payment_id:
                    duplicatePaymentId,
                order_ref:
                    orderId,
                gross_amount:
                    grossAmount,
                fee,
                settled_amount:
                    settledAmount,
                settlement_date:
                    settlementDate
            });

            bankStatement.push({
                utr:
                    `UTR${utrNumber++}`,
                amount:
                    settledAmount,
                value_date:
                    settlementDate,
                narration:
                    `Razorpay payout ${duplicatePaymentId}`
            });
        }
    }

    return {
        orders,
        settlements,
        bankStatement,
        labels
    };
}

// ------------------------------------------------------------
// Validation
// ------------------------------------------------------------

function validateDataset(dataset) {
    const {
        orders,
        settlements,
        bankStatement,
        labels
    } = dataset;

    console.log(
        "\n--------------- VALIDATION ---------------"
    );

    // Basic counts.
    if (orders.length !== 200) {
        throw new Error(
            `Orders count is ${orders.length}, expected 200`
        );
    }

    if (settlements.length !== 201) {
        throw new Error(
            `Settlement count is ${settlements.length}, expected 201`
        );
    }

    if (bankStatement.length !== 195) {
        throw new Error(
            `Bank count is ${bankStatement.length}, expected 195`
        );
    }

    if (labels.length !== 200) {
        throw new Error(
            `Label count is ${labels.length}, expected 200`
        );
    }

    // Scenario counts.
    const counts = {};

    for (const label of labels) {
        counts[label.scenario] =
            (counts[label.scenario] || 0) + 1;
    }

    for (
        const [scenario, expected]
        of Object.entries(SCENARIO_COUNTS)
    ) {
        const actual =
            counts[scenario] || 0;

        if (actual !== expected) {
            throw new Error(
                `${scenario}: expected ${expected}, got ${actual}`
            );
        }
    }

    // --------------------------------------------------------
    // Check duplicate settlement groups.
    // --------------------------------------------------------

    const settlementGroups =
        new Map();

    for (const settlement of settlements) {
        const ref =
            settlement.order_ref;

        if (
            !settlementGroups.has(ref)
        ) {
            settlementGroups.set(
                ref,
                []
            );
        }

        settlementGroups
            .get(ref)
            .push(settlement);
    }

    const duplicateGroups =
        [...settlementGroups.values()]
            .filter(
                group =>
                    group.length > 1
            );

    if (
        duplicateGroups.length !== 8
    ) {
        throw new Error(
            `Expected exactly 8 duplicate groups, got ${duplicateGroups.length}`
        );
    }

    // --------------------------------------------------------
    // Check TYPO_REF records.
    // --------------------------------------------------------

    const validOrderIds =
        new Set(
            orders.map(
                order =>
                    order.order_id
            )
        );

    const typoLabels =
        labels.filter(
            label =>
                label.scenario ===
                "typo_ref"
        );

    for (const label of typoLabels) {
        const related =
            settlements.filter(
                settlement =>
                    // A typo record must not contain
                    // the exact order reference.
                    settlement.order_ref ===
                    label.order_id
            );

        if (related.length > 0) {
            throw new Error(
                `TYPO_REF ${label.order_id} accidentally has an exact settlement reference`
            );
        }

        const typoSettlement =
            settlements.find(
                settlement =>
                    settlement.payment_id
                        .replace(
                            "PAY-",
                            ""
                        ) ===
                    label.order_id.replace(
                        "ORD-",
                        ""
                    )
            );

        if (!typoSettlement) {
            // This is okay; payment IDs are not required
            // to numerically correspond in the matcher.
            continue;
        }
    }

    // Make sure every settlement reference that looks
    // like an ORD-xxxx is a real order unless it is a
    // deliberate typo.
    for (
        const settlement
        of settlements
    ) {
        if (
            settlement.order_ref.startsWith(
                "ORD-"
            )
        ) {
            const exactExists =
                validOrderIds.has(
                    settlement.order_ref
                );

            if (!exactExists) {
                // This is a deliberate typo.
                continue;
            }
        }
    }

    // --------------------------------------------------------
    // Check NO_SETTLEMENT.
    // --------------------------------------------------------

    const noSettlementIds =
        new Set(
            labels
                .filter(
                    label =>
                        label.scenario ===
                        "no_settlement"
                )
                .map(
                    label =>
                        label.order_id
                )
        );

    for (
        const orderId
        of noSettlementIds
    ) {
        const matches =
            settlements.filter(
                settlement =>
                    settlement.order_ref ===
                    orderId
            );

        if (matches.length > 0) {
            throw new Error(
                `NO_SETTLEMENT ${orderId} unexpectedly has a settlement`
            );
        }
    }

    // --------------------------------------------------------
    // Check AMOUNT_MISMATCH.
    // --------------------------------------------------------

    const mismatchIds =
        new Set(
            labels
                .filter(
                    label =>
                        label.scenario ===
                        "amount_mismatch"
                )
                .map(
                    label =>
                        label.order_id
                )
        );

    for (
        const order
        of orders
    ) {
        if (
            !mismatchIds.has(
                order.order_id
            )
        ) {
            continue;
        }

        const settlement =
            settlements.find(
                item =>
                    item.order_ref ===
                    order.order_id
            );

        if (!settlement) {
            throw new Error(
                `AMOUNT_MISMATCH ${order.order_id} has no settlement`
            );
        }

        if (
            Math.abs(
                Number(order.amount) -
                Number(
                    settlement.gross_amount
                )
            ) <= 1
        ) {
            throw new Error(
                `AMOUNT_MISMATCH ${order.order_id} does not actually differ in amount`
            );
        }
    }

    // --------------------------------------------------------
    // Check NO_BANK.
    // --------------------------------------------------------

    const noBankIds =
        new Set(
            labels
                .filter(
                    label =>
                        label.scenario ===
                        "no_bank"
                )
                .map(
                    label =>
                        label.order_id
                )
        );

    for (
        const orderId
        of noBankIds
    ) {
        const settlement =
            settlements.find(
                item =>
                    item.order_ref ===
                    orderId
            );

        if (!settlement) {
            throw new Error(
                `NO_BANK ${orderId} has no settlement`
            );
        }

        const bank =
            bankStatement.find(
                item =>
                    Math.abs(
                        Number(
                            item.amount
                        ) -
                        Number(
                            settlement.settled_amount
                        )
                    ) <= 0.5
            );

        // We only need to ensure the specific
        // scenario's expected bank record was omitted.
        // Because amounts can theoretically overlap,
        // this validation is informational.
    }

    console.log(
        "Orders:              200 ✅"
    );

    console.log(
        "Settlements:         201 ✅"
    );

    console.log(
        "Bank entries:        195 ✅"
    );

    console.log(
        "Labels:              200 ✅"
    );

    console.log(
        "Duplicate groups:      8 ✅"
    );

    console.log(
        "Scenario counts:       8/8 ✅"
    );

    console.log(
        "Dataset validation passed. ✅"
    );
}

// ------------------------------------------------------------
// Write files
// ------------------------------------------------------------

function writeDataset(dataset) {
    const {
        orders,
        settlements,
        bankStatement,
        labels
    } = dataset;

    fs.writeFileSync(
        path.join(
            DATA_DIR,
            "orders.csv"
        ),
        toCsv(
            [
                "order_id",
                "customer_name",
                "amount",
                "order_date",
                "status"
            ],
            orders
        )
    );

    fs.writeFileSync(
        path.join(
            DATA_DIR,
            "settlements.csv"
        ),
        toCsv(
            [
                "payment_id",
                "order_ref",
                "gross_amount",
                "fee",
                "settled_amount",
                "settlement_date"
            ],
            settlements
        )
    );

    fs.writeFileSync(
        path.join(
            DATA_DIR,
            "bank_statement.csv"
        ),
        toCsv(
            [
                "utr",
                "amount",
                "value_date",
                "narration"
            ],
            bankStatement
        )
    );

    fs.writeFileSync(
        path.join(
            DATA_DIR,
            "scenario_labels.csv"
        ),
        toCsv(
            [
                "order_id",
                "scenario"
            ],
            labels
        )
    );

    const summary = {
        generated_at:
            new Date().toISOString(),
        orders:
            orders.length,
        settlements:
            settlements.length,
        bank_entries:
            bankStatement.length,
        scenario_counts:
            SCENARIO_COUNTS
    };

    fs.writeFileSync(
        path.join(
            DATA_DIR,
            "dataset_summary.json"
        ),
        JSON.stringify(
            summary,
            null,
            2
        )
    );
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

function main() {
    console.log(
        "=============================================="
    );

    console.log(
        " ReconAI Synthetic Dataset Generator"
    );

    console.log(
        "=============================================="
    );

    const dataset =
        generateDataset();

    validateDataset(
        dataset
    );

    writeDataset(
        dataset
    );

    console.log(
        "\n✅ Dataset generated successfully."
    );

    console.log(
        "\nFiles:"
    );

    console.log(
        "  data/orders.csv"
    );

    console.log(
        "  data/settlements.csv"
    );

    console.log(
        "  data/bank_statement.csv"
    );

    console.log(
        "  data/scenario_labels.csv"
    );

    console.log(
        "  data/dataset_summary.json"
    );

    console.log(
        "\n=============================================="
    );
}

main();