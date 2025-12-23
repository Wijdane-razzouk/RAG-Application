import "dotenv/config";
import Server from "./src/server.js";

// Global Error Handling to prevent silent exits
process.on("uncaughtException", (err) => {
    console.error("💥 CRITICAL: Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("💥 CRITICAL: Unhandled Rejection at:", promise, "reason:", reason);
});

function main() {
    let server = new Server();
    server.start();
}

main();