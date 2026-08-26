require("dotenv").config();

const {
    explainException
} = require("./ai-explainer");

async function main() {
    console.log("==============================================");
    console.log("        ReconAI AI Explanation Test");
    console.log("==============================================");

    const testResult = {
        order_id: "ORD-1005",
        payment_id: "PAY-5005",
        utr: null,

        status: "EXCEPTION",

        pass: "PASS_3_AMOUNT_CHECK",

        confidence: "HIGH",

        category: "AMOUNT_MISMATCH",

        difference: 125.50,

        reason:
            "A settlement exists for the exact order reference, but its gross amount differs beyond the allowed tolerance."
    };

    console.log("\nSending exception to AI...");

    const result =
        await explainException(testResult);

    console.log(
        "\n--------------- AI EXPLANATION -----------"
    );

    console.log(
        `Explanation: ${result.explanation}`
    );

    console.log(
        `Suggested action: ${result.suggested_action}`
    );

    console.log(
        "\n=============================================="
    );

    console.log(
        "AI explanation test completed."
    );

    console.log(
        "=============================================="
    );
}

main().catch(error => {
    console.error("\n❌ AI test failed.");
    console.error(error.message);

    process.exitCode = 1;
});