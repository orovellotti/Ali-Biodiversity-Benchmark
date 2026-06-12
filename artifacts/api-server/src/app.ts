import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
// Most endpoints only need the default body size. The public translate endpoint
// accepts larger EN-translation batches (its handler caps input at 300k chars),
// which 413s under the 100kb default — so only that path gets the higher 1mb
// limit, keeping the smaller limit (less DoS surface) on every other route.
const defaultJson = express.json();
const translateJson = express.json({ limit: "1mb" });
app.use((req, res, next) => {
  if (req.path === "/api/benchmark/translate") {
    translateJson(req, res, next);
  } else {
    defaultJson(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
