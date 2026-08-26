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

app.use(cors());
app.use(express.json());

// ============================================================
// HEALTH
// ============================================================

app.get("/api/health", async (req, res) => {
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
        res.status(500).json({
            success: false,
            error:
                "Database connection failed."
        });
    }
});

// ============================================================
// SUMMARY
// ============================================================

app.get(
    "/api/reconciliation/summary",
    async (req, res) => {
        try {
            const [
                ordersRows
            ] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM orders
            `);

            const [
                settlementsRows
            ] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM settlements
            `);

            const [
                bankRows
            ] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM bank_statement
            `);

            const [
                auditRows
            ] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM reconciliation_log
            `);

            const [
                matchedRows
            ] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM reconciliation_log
                WHERE match_status = 'MATCHED'
            `);

            const [
                exceptionRows
            ] = await pool.query(`
                SELECT COUNT(*) AS total
                FROM reconciliation_log
                WHERE match_status = 'EXCEPTION'
            `);

            const [
                categoryRows
            ] = await pool.query(`
                SELECT
                    category,
                    COUNT(*) AS count
                FROM reconciliation_log
                GROUP BY category
                ORDER BY count DESC
            `);

            const totalOrders =
                ordersRows[0].total;

            const matched =
                matchedRows[0].total;

            const matchRate =
                totalOrders === 0
                    ? 0
                    :
                    Number(
                        (
                            matched /
                            totalOrders
                        ) *
                        100
                    ).toFixed(2);

            res.json({
                success: true,
                summary: {
                    orders:
                        ordersRows[0].total,

                    settlements:
                        settlementsRows[0].total,

                    bank_entries:
                        bankRows[0].total,

                    audit_records:
                        auditRows[0].total,

                    matched:
                        matched,

                    exceptions:
                        exceptionRows[0].total,

                    match_rate:
                        Number(matchRate)
                },

                categories:
                    categoryRows
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                error:
                    "Failed to load reconciliation summary."
            });
        }
    }
);

// ============================================================
// ALL RECONCILIATION RESULTS
// ============================================================

app.get(
    "/api/reconciliation/orders",
    async (req, res) => {
        try {
            const limit =
                Math.min(
                    Math.max(
                        Number(
                            req.query.limit
                        ) || 50,
                        1
                    ),
                    200
                );

            const offset =
                Math.max(
                    Number(
                        req.query.offset
                    ) || 0,
                    0
                );

            const [
                rows
            ] = await pool.query(
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
            console.error(error);

            res.status(500).json({
                success: false,
                error:
                    "Failed to load reconciliation results."
            });
        }
    }
);

// ============================================================
// EXCEPTIONS ONLY
// ============================================================

app.get(
    "/api/reconciliation/exceptions",
    async (req, res) => {
        try {
            const category =
                req.query.category;

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
                    String(category)
                        .trim()
                        .toUpperCase()
                );
            }

            query +=
                " ORDER BY log_id DESC";

            const [
                rows
            ] = await pool.query(
                query,
                params
            );

            res.json({
                success: true,
                count: rows.length,
                data: rows
            });

        } catch (error) {
            console.error(error);

            res.status(500).json({
                success: false,
                error:
                    "Failed to load exceptions."
            });
        }
    }
);

// ============================================================
// SINGLE ORDER
// ============================================================

app.get(
    "/api/reconciliation/orders/:orderId",
    async (req, res) => {
        try {
            const orderId =
                req.params.orderId;

            const [
                orderRows
            ] = await pool.query(
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

            if (
                orderRows.length === 0
            ) {
                return res.status(404).json({
                    success: false,
                    error:
                        "Order not found."
                });
            }

            const [
                settlementRows
            ] = await pool.query(
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

            const [
                auditRows
            ] = await pool.query(
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
            console.error(error);

            res.status(500).json({
                success: false,
                error:
                    "Failed to load order details."
            });
        }
    }
);

// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {
    res.json({
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
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
    (err, req, res, next) => {
        console.error(err);

        res.status(500).json({
            success: false,
            error:
                "Internal server error."
        });
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