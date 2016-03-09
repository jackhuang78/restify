import winston from 'winston';

class Logger {
	static loggers = {};

	
	static get(cls) {
		if(Logger.loggers[cls] == null) {
			Logger.loggers[cls] = new winston.Logger({
				colors: {
					debug: 'cyan',
					info: 'green',
					warn: 'yellow',
					error: 'red'
				},
				transports: [new winston.transports.Console({
					level: 'debug',
					colorize: true
				}),	new winston.transports.File({
					filename: 'restify.log',
					level: 'debug'
				})]
			});
			Logger.loggers[cls].name = cls;
		}

		return Logger.loggers[cls];
	}

	
}


export default Logger;