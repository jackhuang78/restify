import express from 'express';
import bodyParser from 'body-parser';
import chai, {expect} from 'chai';
import Logger from './Logger';
import Restify from './Restify';

let logger = Logger.get('Server');

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

		// middleware
		this.app.use(p(async (req, res, next) => {
			logger.info(`SERVER> ${req.method} ${req.url}`);
			return next();
		}));
		
		// status
		this.app.get('/', p(async (req, res) => {
			return res.json({status: 'ok'});
		}));

		this.app.options('/', p(async (req, res) => {
			return res.json({
				tables: Object.keys(restify.schema())
			});
		}));

		this.app.options('/:table', p(async (req, res) => {
			return res.json({
				fields: restify.schema()[req.params.table]
			});
		}));

		

		this.app.get('/:table', p(async (req, res) => {
			let table = req.params.table;

			//console.log('req', req);

			// console.log('req.param.table', req.param.table);
			// console.log('req.query', req.query);

			let query = Server._parseQuery(req.query);

			console.log('query', query);

			let items = await restify.get(table, query);

//		console.log('items', items);
			

			
			return res.json(items);
		}));
	}

	static _parseQuery(query) {
		let parsed = {};
		for(let fields in query) {
			let cur = parsed;
			
			let keys = fields.split('.');
			let last = keys.pop();
			for(let key of keys) {
				if(cur[key] === undefined) {
					cur[key] = {};
				}
				cur = cur[key];
			}

			if(typeof(query[fields]) === 'number') {
				cur[last] = ['=', query[fields]];
			} else if(query[fields] === '*') {
				cur[last] = undefined;
			} else if(query[fields] === 'NULL') {
				cur[last] = null;
			} else if(query[fields].startsWith('<=')) {
				cur[last] = ['<=', query[fields].substring(2)];
			} else if(query[fields].startsWith('<')) {
				cur[last] = ['<', query[fields].substring(1)];
			}	else if(query[fields].startsWith('>=')) {
				cur[last] = ['>=', query[fields].substring(2)];
			} else if(query[fields].startsWith('>')) {
				cur[last] = ['>', query[fields].substring(1)];
			} else if(query[fields].startsWith('!=')) {
				cur[last] = ['!=', query[fields].substring(2)];
			} else if(query[fields].startsWith('~')) {
				cur[last] = ['LIKE', query[fields].substring(1)];
			} else {
				cur[last] = ['=', query[fields]];
			}
			

		}
		return parsed;
	};

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