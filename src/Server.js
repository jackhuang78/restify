import express from 'express';
import bodyParser from 'body-parser';
import chai, {expect} from 'chai';
import logger from './Logger';
import Restify from './Restify';

class Server {
	constructor(config) {
		this.restify = new Restify(config);


		// Express instance
		this.app = express();

		// set parsers
		//this.app.use(cookieParser());
		this.app.use(bodyParser.urlencoded({extended:true}));
		this.app.use(bodyParser.json());

		//
		this.app.get('/', (req, res) => {
			return res.json({status: 'ok'});
		});
	}

	async start(port) {
		//logger.info('SERVER> starting...');
		this.port = port;
		expect(port).to.be.an.int;
		return new Promise((res, rej) => {
			this.server = this.app.listen(port)
			.on('listening', () => {
				return res(port);
			}).on('error', (err) => {
				err.meta = {port: port};
				return rej(err);
			});
		});
	}

	async stop() {
		//logger.info('SERVER> stopping...');
		return new Promise((res, rej) => {
			if(!this.server)
				return rej(new Error('ENOTRUNNING'));
			
			return this.server.close(res);
		});
	}

	async sync() {
		await this.restify.sync();
	}

	schema() {
		return this.restify.schema();
	}
}

export default Server;