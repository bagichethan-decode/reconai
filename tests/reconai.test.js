const test = require("node:test");
const assert = require("node:assert/strict");

function normalizeReference(value) {
    if (!value) {
        return "";
    }

    return String(value)
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "");
}

function amountDifference(a, b) {
    return Math.abs(
        Number(a) - Number(b)
    );
}

function getSeverity(category) {
    const normalized =
        String(category || "").toUpperCase();

    if (
        normalized === "AMOUNT_MISMATCH" ||
        normalized === "MISSING_BANK"
    ) {
        return "HIGH";
    }

    if (
        normalized === "NO_SETTLEMENT" ||
        normalized === "UNRESOLVED"
    ) {
        return "MEDIUM";
    }

    if (normalized === "FUZZY_MATCH") {
        return "LOW";
    }

    return "MEDIUM";
}

test(
    "reference normalization removes spaces and uppercases values",
    () => {
        assert.equal(
            normalizeReference(" ord-1005 "),
            "ORD-1005"
        );

        assert.equal(
            normalizeReference("ord 1005"),
            "ORD1005"
        );
    }
);

test(
    "amount difference is calculated correctly",
    () => {
        assert.equal(
            amountDifference(
                1000,
                875
            ),
            125
        );
    }
);

test(
    "zero amount difference is detected",
    () => {
        assert.equal(
            amountDifference(
                500,
                500
            ),
            0
        );
    }
);

test(
    "AMOUNT_MISMATCH has HIGH severity",
    () => {
        assert.equal(
            getSeverity(
                "AMOUNT_MISMATCH"
            ),
            "HIGH"
        );
    }
);

test(
    "MISSING_BANK has HIGH severity",
    () => {
        assert.equal(
            getSeverity(
                "MISSING_BANK"
            ),
            "HIGH"
        );
    }
);

test(
    "NO_SETTLEMENT has MEDIUM severity",
    () => {
        assert.equal(
            getSeverity(
                "NO_SETTLEMENT"
            ),
            "MEDIUM"
        );
    }
);

test(
    "UNRESOLVED has MEDIUM severity",
    () => {
        assert.equal(
            getSeverity(
                "UNRESOLVED"
            ),
            "MEDIUM"
        );
    }
);

test(
    "FUZZY_MATCH has LOW severity",
    () => {
        assert.equal(
            getSeverity(
                "FUZZY_MATCH"
            ),
            "LOW"
        );
    }
);

console.log(
    "ReconAI unit tests loaded."
);