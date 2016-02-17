import winston from 'winston';

let logger = new winston.Logger({
	colors: {
		debug: 'cyan',
		info: 'green',
		warn: 'yellow',
		error: 'red'
	},
	transports: [
		new winston.transports.Console({
			level: 'info',
			colorize: true
		}),
		new winston.transports.File({
			filename: 'restify.log',
			level: 'debug'
		})
	]
});

logger.setConsoleLevel = (level) => {
	logger.transports.console.level = level;
};

logger.debugOn = () => {
	logger.setConsoleLevel('debug');
};

logger.debugOff = () => {
	logger.setConsoleLevel('info');
};

export default logger;