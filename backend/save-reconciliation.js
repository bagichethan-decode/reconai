const pool = require("./db");

/**
 * Save one reconciliation result into reconciliation_log.
 */
async function saveReconciliationResult(connection, result) {
    await connection.execute(
        `
        INSERT INTO reconciliation_log
        (
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
            suggested_action
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            result.order_id || null,
            result.payment_id || null,
            result.utr || null,
            result.status || null,
            result.pass || null,
            result.confidence || null,
            result.category || null,
            result.difference ?? null,
            result.reason || null,
            result.ai_explanation || null,
            result.suggested_action || null
        ]
    );
}

/**
 * Save the complete reconciliation run.
 *
 * The audit table contains exactly one primary
 * reconciliation decision per order.
 */
async function saveReconciliationResults(results) {
    let connection;

    try {
        connection = await pool.getConnection();

        await connection.beginTransaction();

        console.log(
            "🧹 Clearing previous reconciliation log..."
        );

        await connection.execute(
            "DELETE FROM reconciliation_log"
        );

        for (const result of results) {
            await saveReconciliationResult(
                connection,
                result
            );
        }

        await connection.commit();

        console.log(
            `✅ Saved ${results.length} reconciliation results to audit log.`
        );

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error(
            "❌ Failed to save reconciliation results."
        );

        console.error(error.message);

        throw error;

    } finally {
        if (connection) {
            connection.release();
        }
    }
}

module.exports = {
    saveReconciliationResult,
    saveReconciliationResults
};