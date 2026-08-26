const API_BASE =
    "http://localhost:3000";

const PAGE_SIZE = 10;

let allExceptions = [];
let currentPage = 1;

// ============================================================
// API
// ============================================================

async function fetchJson(endpoint) {
    const response =
        await fetch(
            `${API_BASE}${endpoint}`
        );

    if (!response.ok) {
        throw new Error(
            `API request failed: ${response.status}`
        );
    }

    return response.json();
}

// ============================================================
// UTILITIES
// ============================================================

function setText(id, value) {
    const element =
        document.getElementById(id);

    if (element) {
        element.textContent = value;
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatAmount(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "-";
    }

    return Number(value).toFixed(2);
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Date(value)
        .toLocaleDateString();
}

// ============================================================
// SUMMARY
// ============================================================

async function loadSummary() {
    const result =
        await fetchJson(
            "/api/reconciliation/summary"
        );

    const summary =
        result.summary;

    setText(
        "ordersCount",
        summary.orders
    );

    setText(
        "settlementsCount",
        summary.settlements
    );

    setText(
        "bankCount",
        summary.bank_entries
    );

    setText(
        "exceptionsCount",
        summary.exceptions
    );

    setText(
        "matchRate",
        `${summary.match_rate}%`
    );

    const categoryList =
        document.getElementById(
            "categoryList"
        );

    categoryList.innerHTML = "";

    for (
        const item
        of result.categories
    ) {
        const element =
            document.createElement(
                "div"
            );

        element.className =
            "category-item";

        element.innerHTML = `
            <div class="category-name">
                ${escapeHtml(
                    item.category
                )}
            </div>

            <div class="category-count">
                ${item.count}
            </div>
        `;

        categoryList.appendChild(
            element
        );
    }
}

// ============================================================
// LOAD EXCEPTIONS
// ============================================================

async function loadExceptions() {
    const result =
        await fetchJson(
            "/api/reconciliation/exceptions"
        );

    allExceptions =
        Array.isArray(result.data)
            ? result.data
            : [];

    currentPage = 1;

    applyFilters();
}

// ============================================================
// FILTERING
// ============================================================

function getFilteredExceptions() {
    const searchValue =
        document
            .getElementById(
                "searchInput"
            )
            .value
            .trim()
            .toUpperCase();

    const selectedCategory =
        document
            .getElementById(
                "categoryFilter"
            )
            .value
            .trim()
            .toUpperCase();

    return allExceptions.filter(
        item => {

            const orderId =
                String(
                    item.order_id || ""
                )
                    .trim()
                    .toUpperCase();

            const category =
                String(
                    item.category || ""
                )
                    .trim()
                    .toUpperCase();

            const orderMatches =
                searchValue === "" ||
                orderId.includes(
                    searchValue
                );

            const categoryMatches =
                selectedCategory === "ALL" ||
                category ===
                selectedCategory;

            return (
                orderMatches &&
                categoryMatches
            );
        }
    );
}

function applyFilters() {
    const filtered =
        getFilteredExceptions();

    const totalPages =
        Math.max(
            1,
            Math.ceil(
                filtered.length /
                PAGE_SIZE
            )
        );

    if (
        currentPage >
        totalPages
    ) {
        currentPage =
            totalPages;
    }

    renderExceptions(
        filtered
    );

    updateFilterSummary(
        filtered.length
    );

    updatePagination(
        filtered.length
    );
}

function updateFilterSummary(
    filteredCount
) {
    const summary =
        document.getElementById(
            "filterSummary"
        );

    if (
        allExceptions.length === 0
    ) {
        summary.textContent =
            "No exceptions loaded.";

        return;
    }

    summary.textContent =
        `Showing ${filteredCount} of ${allExceptions.length} exceptions`;
}

// ============================================================
// PAGINATION
// ============================================================

function updatePagination(
    totalItems
) {
    const pagination =
        document.getElementById(
            "pagination"
        );

    const previousButton =
        document.getElementById(
            "previousPageButton"
        );

    const nextButton =
        document.getElementById(
            "nextPageButton"
        );

    const pageInfo =
        document.getElementById(
            "pageInfo"
        );

    if (
        totalItems <= PAGE_SIZE
    ) {
        pagination.classList.add(
            "hidden"
        );

        return;
    }

    const totalPages =
        Math.ceil(
            totalItems /
            PAGE_SIZE
        );

    pagination.classList.remove(
        "hidden"
    );

    pageInfo.textContent =
        `Page ${currentPage} of ${totalPages}`;

    previousButton.disabled =
        currentPage === 1;

    nextButton.disabled =
        currentPage === totalPages;
}

// ============================================================
// RENDER EXCEPTIONS
// ============================================================

function renderExceptions(
    filteredRows
) {
    const table =
        document.getElementById(
            "exceptionsTable"
        );

    table.innerHTML = "";

    if (
        filteredRows.length === 0
    ) {
        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-state"
                >
                    No exceptions match the current filters.
                </td>
            </tr>
        `;

        return;
    }

    const startIndex =
        (
            currentPage - 1
        ) *
        PAGE_SIZE;

    const endIndex =
        startIndex +
        PAGE_SIZE;

    const pageRows =
        filteredRows.slice(
            startIndex,
            endIndex
        );

    for (
        const item
        of pageRows
    ) {
        const row =
            document.createElement(
                "tr"
            );

        const difference =
            item.difference_amount ===
            null
                ? "-"
                :
                Number(
                    item.difference_amount
                ).toFixed(2);

        row.innerHTML = `
            <td>
                <button
                    type="button"
                    class="order-link"
                    data-order-id="${escapeHtml(
                        item.order_id
                    )}"
                >
                    ${escapeHtml(
                        item.order_id
                    )}
                </button>
            </td>

            <td>
                <span class="badge">
                    ${escapeHtml(
                        item.category
                    )}
                </span>
            </td>

            <td>
                ${escapeHtml(
                    item.confidence
                )}
            </td>

            <td>
                ${difference}
            </td>

            <td class="action-text">
                ${escapeHtml(
                    item.suggested_action ||
                    "-"
                )}
            </td>
        `;

        table.appendChild(
            row
        );
    }

    document
        .querySelectorAll(
            ".order-link"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    loadOrderDetails(
                        button.dataset.orderId
                    );

                }
            );

        });
}

// ============================================================
// ORDER DETAILS
// ============================================================

async function loadOrderDetails(
    orderId
) {
    const panel =
        document.getElementById(
            "orderDetailsPanel"
        );

    const details =
        document.getElementById(
            "orderDetails"
        );

    const subtitle =
        document.getElementById(
            "detailsSubtitle"
        );

    panel.classList.remove(
        "hidden"
    );

    details.innerHTML = `
        <div class="loading">
            Loading ${escapeHtml(orderId)}...
        </div>
    `;

    subtitle.textContent =
        `Reconciliation details for ${orderId}`;

    try {
        const result =
            await fetchJson(
                `/api/reconciliation/orders/${encodeURIComponent(
                    orderId
                )}`
            );

        const order =
            result.order;

        const settlements =
            result.settlements || [];

        const reconciliation =
            result.reconciliation;

        const settlementHtml =
            settlements.length === 0
                ? `
                    <div class="detail-empty">
                        No settlement records found.
                    </div>
                  `
                :
                settlements
                    .map(
                        settlement => `
                            <div class="settlement-card">

                                <div>
                                    <span>
                                        Payment ID
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            settlement.payment_id
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Order Reference
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            settlement.order_ref
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Gross Amount
                                    </span>

                                    <strong>
                                        ${formatAmount(
                                            settlement.gross_amount
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Fee
                                    </span>

                                    <strong>
                                        ${formatAmount(
                                            settlement.fee
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Settled Amount
                                    </span>

                                    <strong>
                                        ${formatAmount(
                                            settlement.settled_amount
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>
                                        Settlement Date
                                    </span>

                                    <strong>
                                        ${formatDate(
                                            settlement.settlement_date
                                        )}
                                    </strong>
                                </div>

                            </div>
                        `
                    )
                    .join("");

        details.innerHTML = `

            <div class="detail-grid">

                <div class="detail-card">
                    <span class="detail-label">
                        Order ID
                    </span>

                    <strong>
                        ${escapeHtml(
                            order.order_id
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span class="detail-label">
                        Customer
                    </span>

                    <strong>
                        ${escapeHtml(
                            order.customer_name
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span class="detail-label">
                        Order Amount
                    </span>

                    <strong>
                        ${formatAmount(
                            order.amount
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span class="detail-label">
                        Order Date
                    </span>

                    <strong>
                        ${formatDate(
                            order.order_date
                        )}
                    </strong>
                </div>

                <div class="detail-card">
                    <span class="detail-label">
                        Status
                    </span>

                    <strong>
                        ${escapeHtml(
                            order.status
                        )}
                    </strong>
                </div>

                ${
                    reconciliation
                        ? `
                            <div class="detail-card">

                                <span class="detail-label">
                                    Category
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        reconciliation.category
                                    )}
                                </strong>

                            </div>

                            <div class="detail-card">

                                <span class="detail-label">
                                    Confidence
                                </span>

                                <strong>
                                    ${escapeHtml(
                                        reconciliation.confidence
                                    )}
                                </strong>

                            </div>

                            <div class="detail-card">

                                <span class="detail-label">
                                    Difference
                                </span>

                                <strong>
                                    ${
                                        reconciliation.difference_amount === null
                                            ? "-"
                                            :
                                            formatAmount(
                                                reconciliation.difference_amount
                                            )
                                    }
                                </strong>

                            </div>
                          `
                        : ""
                }

            </div>

            <div class="details-section">

                <h4>
                    Settlement Records
                </h4>

                ${settlementHtml}

            </div>

            ${
                reconciliation
                    ? `
                        <div class="details-section">

                            <h4>
                                Reconciliation Decision
                            </h4>

                            <div class="decision-card">

                                <div class="decision-row">
                                    <span>
                                        Match Status
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            reconciliation.match_status
                                        )}
                                    </strong>
                                </div>

                                <div class="decision-row">
                                    <span>
                                        Match Pass
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            reconciliation.match_pass
                                        )}
                                    </strong>
                                </div>

                                <div class="decision-row">
                                    <span>
                                        Category
                                    </span>

                                    <strong>
                                        ${escapeHtml(
                                            reconciliation.category
                                        )}
                                    </strong>
                                </div>

                                <div class="decision-row">
                                    <span>
                                        Raw Reason
                                    </span>

                                    <p>
                                        ${escapeHtml(
                                            reconciliation.raw_reason
                                        )}
                                    </p>
                                </div>

                            </div>

                        </div>

                        <div class="details-section">

                            <h4>
                                Explanation
                            </h4>

                            <div class="explanation-card">

                                <p>
                                    ${escapeHtml(
                                        reconciliation.ai_explanation ||
                                        "No explanation available."
                                    )}
                                </p>

                            </div>

                        </div>

                        <div class="details-section">

                            <h4>
                                Suggested Action
                            </h4>

                            <div class="action-card">

                                <p>
                                    ${escapeHtml(
                                        reconciliation.suggested_action ||
                                        "No suggested action available."
                                    )}
                                </p>

                            </div>

                        </div>
                    `
                    : ""
            }
        `;

        panel.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        console.error(error);

        details.innerHTML = `
            <div class="error-box">
                Failed to load order details.
            </div>
        `;
    }
}

// ============================================================
// REFRESH
// ============================================================

async function refreshDashboard() {
    try {
        await loadSummary();

        console.log(
            "✅ Dashboard summary loaded."
        );

    } catch (error) {
        console.error(error);

        alert(
            "Could not connect to the ReconAI API. Make sure server.js is running."
        );
    }
}

// ============================================================
// EVENTS
// ============================================================

document
    .getElementById(
        "refreshButton"
    )
    .addEventListener(
        "click",
        refreshDashboard
    );

document
    .getElementById(
        "loadExceptionsButton"
    )
    .addEventListener(
        "click",
        async () => {

            try {
                await loadExceptions();

            } catch (error) {
                console.error(error);

                alert(
                    "Could not load exceptions."
                );
            }

        }
    );

document
    .getElementById(
        "searchInput"
    )
    .addEventListener(
        "input",
        () => {

            currentPage = 1;

            applyFilters();

        }
    );

document
    .getElementById(
        "categoryFilter"
    )
    .addEventListener(
        "change",
        () => {

            currentPage = 1;

            applyFilters();

        }
    );

document
    .getElementById(
        "clearFiltersButton"
    )
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "searchInput"
                )
                .value = "";

            document
                .getElementById(
                    "categoryFilter"
                )
                .value = "ALL";

            currentPage = 1;

            applyFilters();

        }
    );

document
    .getElementById(
        "previousPageButton"
    )
    .addEventListener(
        "click",
        () => {

            if (
                currentPage > 1
            ) {
                currentPage--;

                applyFilters();
            }

        }
    );

document
    .getElementById(
        "nextPageButton"
    )
    .addEventListener(
        "click",
        () => {

            const filtered =
                getFilteredExceptions();

            const totalPages =
                Math.ceil(
                    filtered.length /
                    PAGE_SIZE
                );

            if (
                currentPage <
                totalPages
            ) {
                currentPage++;

                applyFilters();
            }

        }
    );

document
    .getElementById(
        "closeDetailsButton"
    )
    .addEventListener(
        "click",
        () => {

            document
                .getElementById(
                    "orderDetailsPanel"
                )
                .classList.add(
                    "hidden"
                );

        }
    );

// ============================================================
// START
// ============================================================

refreshDashboard();