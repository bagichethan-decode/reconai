const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const pool = require("./db");

function readCsv(filename) {
    const filePath = path.join(__dirname, "..", "data", filename);
    const fileContent = fs.readFileSync(filePath, "utf8");

    return parse(fileContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
    });
}

async function importOrders(connection) {
    const rows = readCsv("orders.csv");

    for (const row of rows) {
        await connection.execute(
            `INSERT INTO orders
            (order_id, customer_name, amount, order_date, status)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                customer_name = VALUES(customer_name),
                amount = VALUES(amount),
                order_date = VALUES(order_date),
                status = VALUES(status)`,
            [
                row.order_id,
                row.customer_name,
                Number(row.amount),
                row.order_date,
                row.status
            ]
        );
    }

    return rows.length;
}

async function importSettlements(connection) {
    const rows = readCsv("settlements.csv");

    for (const row of rows) {
        await connection.execute(
            `INSERT INTO settlements
            (payment_id, order_ref, gross_amount, fee, settled_amount, settlement_date)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                row.payment_id,
                row.order_ref,
                Number(row.gross_amount),
                Number(row.fee),
                Number(row.settled_amount),
                row.settlement_date
            ]
        );
    }

    return rows.length;
}

async function importBankStatement(connection) {
    const rows = readCsv("bank_statement.csv");

    for (const row of rows) {
        await connection.execute(
            `INSERT INTO bank_statement
            (utr, amount, value_date, narration)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                amount = VALUES(amount),
                value_date = VALUES(value_date),
                narration = VALUES(narration)`,
            [
                row.utr,
                Number(row.amount),
                row.value_date,
                row.narration
            ]
        );
    }

    return rows.length;
}

async function main() {
    let connection;

    try {
        connection = await pool.getConnection();

        console.log("🚀 Starting ReconAI data import...");
        console.log("Connected to MySQL database: reconai");

        await connection.beginTransaction();

        console.log("🧹 Clearing previous synthetic dataset...");

        await connection.execute("DELETE FROM reconciliation_log");
        await connection.execute("DELETE FROM bank_statement");
        await connection.execute("DELETE FROM settlements");
        await connection.execute("DELETE FROM orders");

        const ordersCount = await importOrders(connection);
        const settlementsCount = await importSettlements(connection);
        const bankCount = await importBankStatement(connection);

        await connection.commit();

        console.log("\n✅ Import completed successfully!");
        console.log(`Orders processed: ${ordersCount}`);
        console.log(`Settlements processed: ${settlementsCount}`);
        console.log(`Bank records processed: ${bankCount}`);

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }

        console.error("\n❌ Import failed.");
        console.error(error.message);

        process.exitCode = 1;

    } finally {
        if (connection) {
            connection.release();
        }

        await pool.end();
    }
}

main();