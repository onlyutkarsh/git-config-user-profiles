//interface for command pattern
export interface ICommand<T> {
  execute(...params: any[]): Promise<Result<T>>;
}

//result type with bool and error
export interface Result<T> {
  result?: T;
  message?: string;
  error?: Error;
}
