export class Logger {
  static debug(message?: any, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams);
  }

  static info(message?: any, ...optionalParams: any[]): void {
    console.log(message, ...optionalParams);
  }

  static error(message?: any, ...optionalParams: any[]): void {
    console.error(message, ...optionalParams);
  }
}

const loggers: { [level: string]: (message?: any) => void } = {
  debug: Logger.debug,
  info: Logger.info,
  error: Logger.error,
};

/** Logs each call to the decorated async method, with its arguments. */
export function logAsync(level: string = "info") {
  return (_: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    const targetMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      loggers[level]!(`Method ${propertyKey} called with arguments ${JSON.stringify(args)}.`);
      return await targetMethod!.apply(this, args);
    };

    return descriptor;
  };
}

/** Logs each call to the decorated sync method, with its arguments. */
export function logSync(level: string = "info") {
  return (_: any, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) => {
    const targetMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      loggers[level]!(`Method ${propertyKey} called with arguments ${JSON.stringify(args)}.`);
      return targetMethod!.apply(this, args);
    };

    return descriptor;
  };
}
