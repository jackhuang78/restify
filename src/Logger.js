import winston from 'winston';

class Logger {
	static loggers;

	static _init() {
		Logger.loggers = {};
		Logger.loggers.default = new winston.Logger({
			colors: {
				debug: 'cyan',
				info: 'green',
				warn: 'yellow',
				error: 'red'
			},
			transports: [new winston.transports.Console({
				level: 'info',
				colorize: true
			}),	new winston.transports.File({
				filename: 'restify.log',
				level: 'debug'
			})]
		});				
	}

	static get(cls) {
		return (Logger.loggers[cls] == null)
				? Logger.loggers.default
				: Logger.loggers[cls];
	}
}

Logger._init();

export default Logger;