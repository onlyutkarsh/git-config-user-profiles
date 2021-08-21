/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2017 Esben Petersen
 *  Licensed under the MIT License.
 *  See https://github.com/prettier/prettier-vscode/blob/master/LICENSE for license information.
 *--------------------------------------------------------------------------------------------*/

import { OutputChannel, window } from "vscode";
import { Application } from "../constants";
import { Disposable } from "./disposable";

type LogLevel = "INFO" | "WARN" | "ERROR";

export class Logger extends Disposable {
  private outputChannel: OutputChannel | undefined;
  private static _instance: Logger;

  static get instance(): Logger {
    if (!Logger._instance) {
      Logger._instance = new Logger();
    }
    return Logger._instance;
  }

  private constructor() {
    super();
    this.outputChannel = window.createOutputChannel(Application.APPLICATION_NAME);
    this.registerDisposable(this.outputChannel);
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  public logInfo(message: string, data?: object): void {
    this.logMessage(message, "INFO");
    if (data) {
      this.logObject(data);
    }
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  public logWarning(message: string, data?: object): void {
    this.logMessage(message, "WARN");
    if (data) {
      this.logObject(data);
    }
  }

  public logError(message: string, error?: Error | string) {
    this.logMessage(message, "ERROR");

    if (!this.outputChannel) {
      return;
    }

    if (error instanceof Error) {
      if (error.message) {
        this.outputChannel.appendLine(error.message);
      }
      if (error.stack) {
        this.outputChannel.appendLine(error.stack);
      }
    } else if (error) {
      this.outputChannel.appendLine(error);
    }
  }

  public show() {
    if (!this.outputChannel) {
      return;
    }

    this.outputChannel.show();
  }

  private logObject(data: object): void {
    if (this.outputChannel) {
      const message = JSON.stringify(data, null, 2).trim();
      this.outputChannel.appendLine(message);
    }
  }

  /**
   * Append messages to the output channel and format it with a title
   *
   * @param message The message to append to the output channel
   */
  private logMessage(message: string, logLevel: LogLevel): void {
    if (this.outputChannel) {
      const title = new Date().toLocaleTimeString();
      this.outputChannel.appendLine(`[${logLevel} - ${title}] ${message}`);
    }
  }
}
