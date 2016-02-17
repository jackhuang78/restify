import chai, {expect} from 'chai';
import Server from '../src/Server';
import request from 'request';
import promisify from 'es6-promisify';
import mysql from 'mysql';
import fs from 'fs';
import chaiSubset from 'chai-subset';

chai.use(chaiSubset);

let PORT = 9999;
let config = {
	host: 'localhost',
	user: 'root',
	password: '',
	database: 'restify'
};
let host = `http://localhost:${PORT}`;

async function resetDb() {
	return new Promise((res, rej) => {
		let sql = fs.readFileSync('./test/setup.sql').toString();
		let conn = mysql.createConnection(Object.assign(config, {multipleStatements: true}));
		conn.connect();
		conn.query(sql, (err, rows, fields) => {
			conn.end();
			if(err)
				rej(err);
			res();
		});
	});
}
async function req(opt) {
	return new Promise((res, rej) => {
		request(opt, (error, response, body) => {
			if(error)
				rej(error);
			res(response, body);
		});
	});
}

describe('Server.js', () => {
	describe('#start() / #stop()', () => {
		it('should start ans stop server', async () => {
			let server = new Server(config);
			await server.start(PORT);
			await server.stop();
		});	
	});

	describe('#HTTP', () => {
		let server = new Server(config);
		before(async () => {
			await resetDb();
			await server.start(PORT);
		});
		after(async () => {
			await server.stop(PORT);
		});

		describe('#GET /', () => {
			it('should get the server status', async () => {
				let response = await req({method: 'GET', url: `${host}/`, json: true});
				expect(response.statusCode).be.equal(200);
				expect(response.body).to.have.property('status', 'ok');
			});
		});
		describe('#GET /_schema', () => {
			it('should get the schema', async () => {
				let response = await req({method: 'GET', url: `${host}/_schema`, json: true});
				expect(response.statusCode).be.equal(200);
				expect(response.body).to.contain.all.keys(['User', 'Repository', 'Contribution', 'Plan']);
			});
		});
	});
});