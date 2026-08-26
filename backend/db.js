const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.join(
        __dirname,
        "..",
        ".env"
    )
});

const requiredVariables = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME"
];

for (const variable of requiredVariables) {
    if (
        process.env[variable] === undefined
    ) {
        throw new Error(
            `Missing environment variable: ${variable}`
        );
    }
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,

    decimalNumbers: true
});

module.exports = pool;