/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2017 Esben Petersen
 *  Licensed under the MIT License.
 *  See https://github.com/prettier/prettier-vscode/blob/master/LICENSE for license information.
 *--------------------------------------------------------------------------------------------*/

import { LogOutputChannel, window, workspace } from "vscode";
import { Application } from "../constants";
import { Disposable } from "./disposable";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

function isLogLevel(value: string | undefined): value is LogLevel {
  return value === "trace" || value === "debug" || value === "info" || value === "warn" || value === "error";
}

export class Logger extends Disposable {
  private outputChannel: LogOutputChannel | undefined;
  private static _instance: Logger;
  private currentLevel: LogLevel = "info";

  static get instance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  private constructor() {
    super();
    this.outputChannel = window.createOutputChannel(Application.APPLICATION_NAME, { log: true });
    this.registerDisposable(this.outputChannel);
    this.updateLogLevelFromConfiguration();
    this.registerDisposable(
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("gitConfigUser.logLevel")) {
          this.updateLogLevelFromConfiguration();
        }
      })
    );
  }

  private updateLogLevelFromConfiguration() {
    const configuredLevel = workspace.getConfiguration("gitConfigUser").get<string>("logLevel");
    this.currentLevel = isLogLevel(configuredLevel) ? configuredLevel : "info";
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.currentLevel];
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  public logInfo(message: string, data?: object): void {
    if (!this.outputChannel || !this.shouldLog("info")) {
      return;
    }

    this.outputChannel.info(message);
    if (data) {
      this.outputChannel.info(JSON.stringify(data, null, 2));
    }
  }

  /**
   * Log debugging information with structured context
   *
   * @param category Category of the log (e.g., "WorkspaceChange", "ProfileSwitch", "GitConfig")
   * @param message The message to log
   * @param context Additional context data
   */
  public logDebug(category: string, message: string, context?: object): void {
    if (!this.outputChannel || !this.shouldLog("debug")) {
      return;
    }

    const logMessage = `[${category}] ${message}`;
    this.outputChannel.debug(logMessage);
    if (context) {
      this.outputChannel.debug(`  Context: ${JSON.stringify(context, null, 2)}`);
    }
  }

  /**
   * Log extremely verbose tracing details with structured context
   *
   * @param category Category of the log
   * @param message The message to log
   * @param context Additional context data
   */
  public logTrace(category: string, message: string, context?: object): void {
    if (!this.outputChannel || !this.shouldLog("trace")) {
      return;
    }

    const logMessage = `[${category}] ${message}`;
    this.outputChannel.trace(logMessage);
    if (context) {
      this.outputChannel.trace(`  Context: ${JSON.stringify(context, null, 2)}`);
    }
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  public logWarning(message: string, data?: object): void {
    if (!this.outputChannel || !this.shouldLog("warn")) {
      return;
    }

    this.outputChannel.warn(message);
    if (data) {
      this.outputChannel.warn(JSON.stringify(data, null, 2));
    }
  }

  public logError(message: string, error?: Error | string) {
    if (!this.outputChannel || !this.shouldLog("error")) {
      return;
    }

    this.outputChannel.error(message);

    if (error instanceof Error) {
      if (error.message) {
        this.outputChannel.error(error.message);
      }
      if (error.stack) {
        this.outputChannel.error(error.stack);
      }
    } else if (error) {
      this.outputChannel.error(error);
    }
  }

  public show() {
    if (!this.outputChannel) {
      return;
    }

    this.outputChannel.show();
  }
}
