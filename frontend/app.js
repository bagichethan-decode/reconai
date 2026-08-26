const API_BASE =
    "http://localhost:3000";

async function fetchJson(
    endpoint
) {
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

function setText(
    id,
    value
) {
    document.getElementById(id)
        .textContent = value;
}

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
                ${escapeHtml(item.category)}
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

async function loadExceptions() {
    const result =
        await fetchJson(
            "/api/reconciliation/exceptions"
        );

    const table =
        document.getElementById(
            "exceptionsTable"
        );

    table.innerHTML = "";

    for (
        const item
        of result.data
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
                <strong>
                    ${escapeHtml(item.order_id)}
                </strong>
            </td>

            <td>
                <span class="badge">
                    ${escapeHtml(item.category)}
                </span>
            </td>

            <td>
                ${escapeHtml(item.confidence)}
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

        table.appendChild(row);
    }

    if (
        result.data.length === 0
    ) {
        table.innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-state"
                >
                    No exceptions found.
                </td>
            </tr>
        `;
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}

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

refreshDashboard();