import "winston-daily-rotate-file";
import config from "@server/lib/config";
import * as winston from "winston";
import path from "path";
import { APP_PATH } from "./lib/consts";
import telemetryClient from "./lib/telemetry";

const hformat = winston.format.printf(
    ({ level, label, message, timestamp, stack, ...metadata }) => {
        let msg = `${timestamp} [${level}]${label ? `[${label}]` : ""}: ${message}`;
        if (stack) {
            msg += `\nStack: ${stack}`;
        }
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    }
);

const transports: any = [new winston.transports.Console({})];

if (config.getRawConfig().app.save_logs) {
    transports.push(
        new winston.transports.DailyRotateFile({
            filename: path.join(APP_PATH, "logs", "pangolin-%DATE%.log"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "7d",
            createSymlink: true,
            symlinkName: "pangolin.log"
        })
    );
    transports.push(
        new winston.transports.DailyRotateFile({
            filename: path.join(APP_PATH, "logs", ".machinelogs-%DATE%.json"),
            datePattern: "YYYY-MM-DD",
            zippedArchive: true,
            maxSize: "20m",
            maxFiles: "1d",
            createSymlink: true,
            symlinkName: ".machinelogs.json",
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.splat(),
                winston.format.json()
            )
        })
    );
}

const logger = winston.createLogger({
    level: config.getRawConfig().app.log_level.toLowerCase(),
    format: winston.format.combine(
        winston.format.errors({ stack: true }),
        winston.format.colorize(),
        winston.format.splat(),
        winston.format.timestamp(),
        hformat
    ),
    transports
});

process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", { error, stack: error.stack });
    process.exit(1);
});

process.on("unhandledRejection", (reason, _) => {
    logger.error("Unhandled Rejection:", { reason });
});

export default logger;
