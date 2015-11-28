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
			level: 'debug',
			colorize: true
		}),
		new winston.transports.File({
			filename: 'restify.log',
			level: 'debug'
		})
	]
});


export default logger;