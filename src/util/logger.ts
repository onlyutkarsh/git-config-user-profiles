/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2017 Esben Petersen
 *  Licensed under the MIT License.
 *  See https://github.com/prettier/prettier-vscode/blob/master/LICENSE for license information.
 *--------------------------------------------------------------------------------------------*/

import { LogOutputChannel, window, workspace } from "vscode";
import { Application } from "../constants";
import { Disposable } from "./disposable";

export enum LogLevel {
  Error = 0,
  Warning = 1,
  Info = 2,
  Debug = 3
}

export class Logger extends Disposable {
  private outputChannel: LogOutputChannel | undefined;
  private static _instance: Logger;

  static get instance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  private getLogLevel(): LogLevel {
    const configLevel = workspace.getConfiguration("gitConfigUser").get<string>("logLevel", "info");
    switch (configLevel.toLowerCase()) {
      case "error":
        return LogLevel.Error;
      case "warning":
        return LogLevel.Warning;
      case "info":
        return LogLevel.Info;
      case "debug":
        return LogLevel.Debug;
      default:
        return LogLevel.Info;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.getLogLevel();
  }

  private constructor() {
    super();
    this.outputChannel = window.createOutputChannel(Application.APPLICATION_NAME, { log: true });
    this.registerDisposable(this.outputChannel);
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  public logInfo(message: string, data?: object): void {
    if (!this.outputChannel || !this.shouldLog(LogLevel.Info)) {
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
    if (!this.outputChannel || !this.shouldLog(LogLevel.Debug)) {
      return;
    }

    const logMessage = `[${category}] ${message}`;
    this.outputChannel.info(logMessage);
    if (context) {
      this.outputChannel.info(`  Context: ${JSON.stringify(context, null, 2)}`);
    }
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  public logWarning(message: string, data?: object): void {
    if (!this.outputChannel || !this.shouldLog(LogLevel.Warning)) {
      return;
    }

    this.outputChannel.warn(message);
    if (data) {
      this.outputChannel.warn(JSON.stringify(data, null, 2));
    }
  }

  public logError(message: string, error?: Error | string) {
    if (!this.outputChannel || !this.shouldLog(LogLevel.Error)) {
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
