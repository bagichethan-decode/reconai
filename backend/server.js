require("dotenv").config({
    path: require("path").join(
        __dirname,
        "..",
        ".env"
    )
});

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();

const PORT =
    Number(process.env.PORT) || 3000;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(cors());
app.use(express.json());

// ============================================================
// HELPERS
// ============================================================

function sendError(res, status, message) {
    return res.status(status).json({
        success: false,
        error: message
    });
}

function isValidOrderId(orderId) {
    return /^ORD-\d+$/.test(orderId);
}

function parseLimit(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return 50;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }

    return Math.min(parsed, 200);
}

function parseOffset(value) {
    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return 0;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }

    return parsed;
}

const VALID_CATEGORIES = new Set([
    "AMOUNT_MISMATCH",
    "MISSING_BANK",
    "NO_SETTLEMENT",
    "UNRESOLVED",
    "FUZZY_MATCH",
    "DUPLICATE_SETTLEMENT"
]);

// ============================================================
// HEALTH
// ============================================================

app.get(
    "/api/health",
    async (req, res) => {
        try {
            const [rows] =
                await pool.query(
                    "SELECT 1 AS connected"
                );

            res.json({
                success: true,
                service: "ReconAI API",
                database:
                    rows[0].connected === 1
                        ? "connected"
                        : "unknown"
            });

        } catch (error) {
            console.error(
                "Health check failed:",
                error
            );

            sendError(
                res,
                500,
                "Database connection failed."
            );
        }
    }
);

// ============================================================
// SUMMARY
// ============================================================

app.get(
    "/api/reconciliation/summary",
    async (req, res) => {
        try {
            const [ordersRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM orders
                `);

            const [settlementsRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM settlements
                `);

            const [bankRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM bank_statement
                `);

            const [auditRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM reconciliation_log
                `);

            const [matchedRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM reconciliation_log
                    WHERE match_status = 'MATCHED'
                `);

            const [exceptionRows] =
                await pool.query(`
                    SELECT COUNT(*) AS total
                    FROM reconciliation_log
                    WHERE match_status = 'EXCEPTION'
                `);

            const [categoryRows] =
                await pool.query(`
                    SELECT
                        category,
                        COUNT(*) AS count
                    FROM reconciliation_log
                    GROUP BY category
                    ORDER BY count DESC
                `);

            const totalOrders =
                Number(
                    ordersRows[0].total
                );

            const matched =
                Number(
                    matchedRows[0].total
                );

            const matchRate =
                totalOrders === 0
                    ? 0
                    : Number(
                        (
                            matched /
                            totalOrders
                        ) * 100
                    ).toFixed(2);

            res.json({
                success: true,

                summary: {
                    orders:
                        totalOrders,

                    settlements:
                        Number(
                            settlementsRows[0].total
                        ),

                    bank_entries:
                        Number(
                            bankRows[0].total
                        ),

                    audit_records:
                        Number(
                            auditRows[0].total
                        ),

                    matched,

                    exceptions:
                        Number(
                            exceptionRows[0].total
                        ),

                    match_rate:
                        Number(matchRate)
                },

                categories:
                    categoryRows
            });

        } catch (error) {
            console.error(
                "Summary error:",
                error
            );

            sendError(
                res,
                500,
                "Failed to load reconciliation summary."
            );
        }
    }
);

// ============================================================
// ALL RECONCILIATION RESULTS
// ============================================================

app.get(
    "/api/reconciliation/orders",
    async (req, res) => {

        const limit =
            parseLimit(
                req.query.limit
            );

        const offset =
            parseOffset(
                req.query.offset
            );

        if (limit === null) {
            return sendError(
                res,
                400,
                "Invalid limit. Use a positive integer."
            );
        }

        if (offset === null) {
            return sendError(
                res,
                400,
                "Invalid offset. Use a non-negative integer."
            );
        }

        try {
            const [rows] =
                await pool.query(
                    `
                    SELECT
                        log_id,
                        order_id,
                        payment_id,
                        utr,
                        match_status,
                        match_pass,
                        confidence,
                        category,
                        difference_amount,
                        raw_reason,
                        ai_explanation,
                        suggested_action,
                        created_at
                    FROM reconciliation_log
                    ORDER BY log_id DESC
                    LIMIT ? OFFSET ?
                    `,
                    [
                        limit,
                        offset
                    ]
                );

            res.json({
                success: true,
                count: rows.length,
                limit,
                offset,
                data: rows
            });

        } catch (error) {
            console.error(
                "Orders error:",
                error
            );

            sendError(
                res,
                500,
                "Failed to load reconciliation results."
            );
        }
    }
);

// ============================================================
// EXCEPTIONS ONLY
// ============================================================

app.get(
    "/api/reconciliation/exceptions",
    async (req, res) => {

        const category =
            req.query.category
                ? String(
                    req.query.category
                )
                    .trim()
                    .toUpperCase()
                : null;

        if (
            category &&
            !VALID_CATEGORIES.has(
                category
            )
        ) {
            return sendError(
                res,
                400,
                `Invalid category. Allowed values: ${[
                    ...VALID_CATEGORIES
                ].join(", ")}`
            );
        }

        try {
            let query = `
                SELECT
                    log_id,
                    order_id,
                    payment_id,
                    utr,
                    match_status,
                    match_pass,
                    confidence,
                    category,
                    difference_amount,
                    raw_reason,
                    ai_explanation,
                    suggested_action,
                    created_at
                FROM reconciliation_log
                WHERE match_status = 'EXCEPTION'
            `;

            const params = [];

            if (category) {
                query +=
                    " AND category = ?";

                params.push(
                    category
                );
            }

            query +=
                " ORDER BY log_id DESC";

            const [rows] =
                await pool.query(
                    query,
                    params
                );

            res.json({
                success: true,
                count: rows.length,
                data: rows
            });

        } catch (error) {
            console.error(
                "Exceptions error:",
                error
            );

            sendError(
                res,
                500,
                "Failed to load exceptions."
            );
        }
    }
);

// ============================================================
// SINGLE ORDER
// ============================================================

app.get(
    "/api/reconciliation/orders/:orderId",
    async (req, res) => {

        const orderId =
            String(
                req.params.orderId || ""
            )
                .trim()
                .toUpperCase();

        // Validate order ID format
        if (!isValidOrderId(orderId)) {
            return sendError(
                res,
                400,
                "Invalid order ID. Expected format: ORD-1005."
            );
        }

        try {
            const [orderRows] =
                await pool.query(
                    `
                    SELECT
                        order_id,
                        customer_name,
                        amount,
                        order_date,
                        status
                    FROM orders
                    WHERE order_id = ?
                    `,
                    [orderId]
                );

            // Valid format but order does not exist
            if (
                orderRows.length === 0
            ) {
                return sendError(
                    res,
                    404,
                    "Order not found."
                );
            }

            const [settlementRows] =
                await pool.query(
                    `
                    SELECT
                        settlement_id,
                        payment_id,
                        order_ref,
                        gross_amount,
                        fee,
                        settled_amount,
                        settlement_date
                    FROM settlements
                    WHERE order_ref = ?
                    ORDER BY settlement_id
                    `,
                    [orderId]
                );

            const [auditRows] =
                await pool.query(
                    `
                    SELECT
                        log_id,
                        order_id,
                        payment_id,
                        utr,
                        match_status,
                        match_pass,
                        confidence,
                        category,
                        difference_amount,
                        raw_reason,
                        ai_explanation,
                        suggested_action,
                        created_at
                    FROM reconciliation_log
                    WHERE order_id = ?
                    ORDER BY log_id DESC
                    `,
                    [orderId]
                );

            res.json({
                success: true,

                order:
                    orderRows[0],

                settlements:
                    settlementRows,

                reconciliation:
                    auditRows[0] || null
            });

        } catch (error) {
            console.error(
                "Order details error:",
                error
            );

            sendError(
                res,
                500,
                "Failed to load order details."
            );
        }
    }
);

// ============================================================
// ROOT
// ============================================================

app.get(
    "/",
    (req, res) => {
        res.json({
            success: true,
            service:
                "ReconAI Reconciliation API",
            version:
                "1.0.0",

            endpoints: [
                "GET /api/health",
                "GET /api/reconciliation/summary",
                "GET /api/reconciliation/orders",
                "GET /api/reconciliation/exceptions",
                "GET /api/reconciliation/orders/:orderId"
            ]
        });
    }
);

// ============================================================
// UNKNOWN ROUTE
// ============================================================

app.use(
    (req, res) => {
        sendError(
            res,
            404,
            `Route not found: ${req.method} ${req.originalUrl}`
        );
    }
);

// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (
        err,
        req,
        res,
        next
    ) => {

        console.error(
            "Unhandled error:",
            err
        );

        if (res.headersSent) {
            return next(err);
        }

        sendError(
            res,
            500,
            "Internal server error."
        );
    }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            "=============================================="
        );

        console.log(
            "          ReconAI REST API"
        );

        console.log(
            "=============================================="
        );

        console.log(
            `Server running on http://localhost:${PORT}`
        );

        console.log(
            "\nAvailable endpoints:"
        );

        console.log(
            `GET http://localhost:${PORT}/api/health`
        );

        console.log(
            `GET http://localhost:${PORT}/api/reconciliation/summary`
        );

        console.log(
            `GET http://localhost:${PORT}/api/reconciliation/orders`
        );

        console.log(
            `GET http://localhost:${PORT}/api/reconciliation/exceptions`
        );

        console.log(
            `GET http://localhost:${PORT}/api/reconciliation/orders/:orderId`
        );
    }
);