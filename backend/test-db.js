const pool = require("./db");

async function testConnection() {
    try {
        const connection = await pool.getConnection();

        console.log("✅ Connected to ReconAI MySQL database!");

        const [rows] = await connection.query("SELECT DATABASE() AS database_name");

        console.log("Database:", rows[0].database_name);

        connection.release();
        await pool.end();
    } catch (error) {
        console.error("❌ Database connection failed.");
        console.error(error.message);
    }
}

testConnection();