const test = require("node:test");
const assert = require("node:assert/strict");

const BASE_URL = "http://localhost:3000";

async function getJson(path) {
    const response = await fetch(
        `${BASE_URL}${path}`
    );

    const body = await response.json();

    return {
        status: response.status,
        body
    };
}

test("GET /api/health returns connected status", async () => {
    const result =
        await getJson("/api/health");

    assert.equal(
        result.status,
        200
    );

    assert.equal(
        result.body.success,
        true
    );

    assert.equal(
        result.body.database,
        "connected"
    );
});

test("GET /api/reconciliation/summary returns reconciliation metrics", async () => {
    const result =
        await getJson(
            "/api/reconciliation/summary"
        );

    assert.equal(
        result.status,
        200
    );

    assert.equal(
        result.body.success,
        true
    );

    assert.equal(
        typeof result.body.summary.orders,
        "number"
    );

    assert.equal(
        typeof result.body.summary.settlements,
        "number"
    );

    assert.equal(
        typeof result.body.summary.exceptions,
        "number"
    );

    assert.equal(
        typeof result.body.summary.match_rate,
        "number"
    );
});

test("GET /api/reconciliation/exceptions returns exceptions", async () => {
    const result =
        await getJson(
            "/api/reconciliation/exceptions"
        );

    assert.equal(
        result.status,
        200
    );

    assert.equal(
        result.body.success,
        true
    );

    assert.equal(
        Array.isArray(
            result.body.data
        ),
        true
    );
});

test("GET /api/reconciliation/exceptions rejects invalid category", async () => {
    const result =
        await getJson(
            "/api/reconciliation/exceptions?category=INVALID"
        );

    assert.equal(
        result.status,
        400
    );

    assert.equal(
        result.body.success,
        false
    );

    assert.match(
        result.body.error,
        /Invalid category/
    );
});

test("GET /api/reconciliation/orders/ORD-1005 returns order details", async () => {
    const result =
        await getJson(
            "/api/reconciliation/orders/ORD-1005"
        );

    assert.equal(
        result.status,
        200
    );

    assert.equal(
        result.body.success,
        true
    );

    assert.equal(
        result.body.order.order_id,
        "ORD-1005"
    );

    assert.equal(
        result.body.reconciliation.category,
        "AMOUNT_MISMATCH"
    );

    assert.equal(
        result.body.reconciliation.difference_amount,
        150
    );
});

test("GET /api/reconciliation/orders/INVALID rejects invalid order ID", async () => {
    const result =
        await getJson(
            "/api/reconciliation/orders/INVALID"
        );

    assert.equal(
        result.status,
        400
    );

    assert.equal(
        result.body.success,
        false
    );

    assert.match(
        result.body.error,
        /Invalid order ID/
    );
});

test("GET /api/reconciliation/orders/ORD-9999 returns 404", async () => {
    const result =
        await getJson(
            "/api/reconciliation/orders/ORD-9999"
        );

    assert.equal(
        result.status,
        404
    );

    assert.equal(
        result.body.success,
        false
    );

    assert.equal(
        result.body.error,
        "Order not found."
    );
});

test("GET unknown route returns 404", async () => {
    const result =
        await getJson(
            "/api/does-not-exist"
        );

    assert.equal(
        result.status,
        404
    );

    assert.equal(
        result.body.success,
        false
    );

    assert.match(
        result.body.error,
        /Route not found/
    );
});

console.log(
    "ReconAI API integration tests loaded."
);