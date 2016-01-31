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

	describe('#sync()', () => {
		let server;
		before(async () => {
			server = new Server(config);
			await server.start(PORT);
		});
		after(async () => {
			await server.stop();
		});

		it('should sync table names', async () => {
			let res;

			res = await server.sync();
			res = server.schema();

			expect(res).to.have.property('User');
			expect(res.User).to.have.property('id');
			expect(res.User.id).to.containSubset({type: 'int', primary: true, autoInc: true});
			expect(res.User.username).to.containSubset({type: 'varchar', size: 20, nullable: false, unique: true});
			expect(res.User.plan_id).to.containSubset({type: 'int', foreign: true});

			expect(res).to.have.property('Plan');
			expect(res.Plan).to.have.property('id');
			expect(res.Plan.id).to.containSubset({type: 'int', primary: true, autoInc: true});
			expect(res.Plan.name).to.containSubset({type: 'varchar', size: 20, nullable: false, unique: true});
			expect(res.Plan.monthly_fee).to.containSubset({type: 'decimal', size: 5, scale: 2});

			expect(res).to.have.property('Repository');
			expect(res.Repository).to.have.property('id');
			expect(res.Repository.id).to.containSubset({type: 'int', primary: true, autoInc: true});
			expect(res.Repository.name).to.containSubset({type: 'varchar', size: 20, nullable: false, unique: true});
			expect(res.Repository.description).to.containSubset({type: 'varchar', size: 100});
			expect(res.Repository.public).to.containSubset({type: 'tinyint'});			
			expect(res.Repository.created).to.containSubset({type: 'date', nullable: false});			
			expect(res.Repository.owner_id).to.containSubset({type: 'int', foreign: true});

			expect(res).to.have.property('Contribution');
			expect(res.Contribution.user_id).to.containSubset({type: 'int', foreign: true});
			expect(res.Contribution.repo_id).to.containSubset({type: 'int', foreign: true});
			expect(res.Contribution.role).to.containSubset({type: 'varchar', size: 20, nullable: false});
			

		});
	});

	describe('#HTTP', () => {
		let server = new Server(config);
		beforeEach(async () => {
			await resetDb();
			await server.start(PORT);
		});
		afterEach(async () => {
			await server.stop(PORT);
		});

		describe('#GET /', () => {
			it('should get the server status', async () => {
				let response = await req({method: 'GET', url: 'http://localhost:9999', json: true});
				expect(response.statusCode).be.equal(200);
				expect(response.body).to.have.property('status', 'ok');
			});
		});
	});
});