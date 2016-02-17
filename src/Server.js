import express from 'express';
import bodyParser from 'body-parser';
import chai, {expect} from 'chai';
import logger from './Logger';
import Restify from './Restify';

let p = fn => (...args) => fn(...args).catch(args[2]);

class Server {
	constructor(config) {
		this.restify = new Restify(config);
		let restify = this.restify;

		// Express instance
		this.app = express();

		// set parsers
		//this.app.use(cookieParser());
		this.app.use(bodyParser.urlencoded({extended:true}));
		this.app.use(bodyParser.json());

		this.app.use(p(async (req, res, next) => {
			logger.info(`SERVER> ${req.method} ${req.url}`);
			return next();
		}));
		
		this.app.get('/', p(async (req, res) => {
			return res.json({status: 'ok'});
		}));
		
		this.app.post('/_sync', p(async (req, res) => {
			await restify.sync();
			return res.send('OK');
		}));

		this.app.get('/_schema', p(async (req, res) => {
			return res.json(restify.schema());
		}));

		this.app.get('/:table', p(async (req, res) => {
			

			
			return res.send('OK');
		}));
	}

	async start(port) {
		logger.info(`SERVER> starting on port ${port}...`);
		expect(port).to.be.an.int;
		this.port = port;

		return new Promise((res, rej) => {
			this.server = this.app.listen(port)
			.on('listening', () => {
				this.restify.sync().then(() => {
					logger.info('SERVER> ready');
					return res(port);
				}).catch((err) => {
					logger.error('SERVER> error');
					return rej(err);
				});
			}).on('error', (err) => {
				logger.error('SERVER> error');
				err.meta = {port: port};
				return rej(err);
			});
		});
	}

	async stop() {
		logger.info('SERVER> stopping...');
		return new Promise((res, rej) => {
			if(!this.server)
				return rej(new Error('ENOTRUNNING'));
			
			return this.server.close(res);
		});
	}
}

export default Server;