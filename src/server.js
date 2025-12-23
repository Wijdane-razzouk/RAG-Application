import express from "express";
import cors from "cors";
import apiRoutes from "./routes/api_pdf.routes.js";
import htmlRoutes from "./routes/pdf.routes.js";

export default class Server {
  constructor(port = 3000) {
    this.port = port;
    this.app = express();
    this.config();
    this.routes();
  }

  config() {
    this.app.use(express.json({ limit: "2mb" }));
    this.app.use(express.static("public"));
    this.app.use(cors());
  }

  routes() {
    this.app.use("/", htmlRoutes);
    this.app.use("/api", apiRoutes);
  }

  start() {
    try {
      this.server = this.app.listen(this.port, () =>
        console.log(`Server running on http://localhost:${this.port}`)
      );

      this.server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.error(`💥 Error: Port ${this.port} is already in use by another process.`);
          console.error(`👉 Try killing the process or using a different port.`);
        } else {
          console.error("💥 Server Error:", err.message);
        }
        process.exit(1);
      });
    } catch (err) {
      console.error("💥 Failed to start server:", err.message);
      process.exit(1);
    }
  }
}
