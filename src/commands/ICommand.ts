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

// class CreateUserCommand implements ICommand<boolean> {
//   async execute(): Promise<Result<boolean>> {
//     const result: Result<boolean> = {};
//     result.result = true;
//     // return dummy resuly
//     return result;
//   }
// }

// use result type to return a bool
// class createUserProfileCommand implements ICommand {
//     async execute(): Promise<IResult<boolean>> {
//       const result: IResult<boolean> = {};
//       result.result = true;
//       // return dummy resuly
//       return result;
//     }
//   }
