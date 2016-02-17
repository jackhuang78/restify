import assert from 'assert';
import chai, {expect} from 'chai';
import chaiSubset from 'chai-subset';
import chaiDatetime from 'chai-datetime';
import Restify from '../src/Restify';
import logger from '../src/Logger';
import mysql from 'mysql';
import fs from 'fs';

chai.use(chaiSubset);
chai.use(chaiDatetime);

let config = {
	host: 'localhost',
	user: 'root',
	password: '',
	database: 'restify'
};

let debugOn = () => logger.setConsoleLevel('debug');
let debugOff = () => logger.setConsoleLevel('info');

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

describe('#Restify', () => {
	describe('#constructor()', () => {
		it('should create Restify instance', async () => {
			let restify = new Restify(config);
			expect(restify).to.be.not.null;
		});
	});

	describe('#sync()', () => {
		let restify;
		beforeEach(async () => {
			await resetDb();
			restify = new Restify(config);
		});
		it('should sync without error', async () => {
			await restify.sync();
		});
	});

	describe('#schema()', () => {
		let restify;
		beforeEach(async () => {
			await resetDb();
			restify = new Restify(config);
			await restify.sync();
		});
		it('should sync table names correctly', async () => {
			let schema = restify.schema();
			expect(schema).to.contain.all.keys(['User', 'Repository', 'Contribution', 'Plan']);
		});
		it('should sync column names correctly', async () => {
			let schema = restify.schema();
			expect(schema.User).to.contain.all.keys(['id', 'username', 'plan_id']);
			expect(schema.Plan).to.contain.all.keys(['id', 'name', 'monthly_fee']);
			expect(schema.Repository).to.contain.all.keys(['id', 'name', 'description', 'public', 'created', 'owner_id']);
			expect(schema.Contribution).to.contain.all.keys(['repo_id', 'user_id', 'role']);
		});
		it('should sync column type and size correctly', async () => {
			let schema = restify.schema();

			expect(schema.User.id).to.containSubset({type: 'int'});
			expect(schema.User.username).to.containSubset({type: 'varchar', size: 20});
			expect(schema.User.plan_id).to.containSubset({type: 'int'});
			expect(schema.Plan.id).to.containSubset({type: 'int'});
			expect(schema.Plan.name).to.containSubset({type: 'varchar', size: 20});
			expect(schema.Plan.monthly_fee).to.containSubset({type: 'decimal', size: 5, scale: 2});
			expect(schema.Repository.id).to.containSubset({type: 'int'});
			expect(schema.Repository.name).to.containSubset({type: 'varchar', size: 20});
			expect(schema.Repository.description).to.containSubset({type: 'varchar', size: 100});
			expect(schema.Repository.public).to.containSubset({type: 'tinyint'});			
			expect(schema.Repository.created).to.containSubset({type: 'date'});			
			expect(schema.Repository.owner_id).to.containSubset({type: 'int'});
			expect(schema.Contribution.user_id).to.containSubset({type: 'int'});
			expect(schema.Contribution.repo_id).to.containSubset({type: 'int'});
			expect(schema.Contribution.role).to.containSubset({type: 'varchar', size: 20});
		});

		it('should sync column key property correctly', async () => {
			let schema = restify.schema();

			expect(schema.User.id).to.containSubset({primary: true});
			expect(schema.User.username).to.containSubset({unique: true});
			expect(schema.User.plan_id).to.containSubset({foreign: true});
			expect(schema.Plan.id).to.containSubset({primary: true});
			expect(schema.Plan.name).to.containSubset({unique: true});
			expect(schema.Repository.id).to.containSubset({primary: true});
			expect(schema.Repository.name).to.containSubset({unique: true});
			expect(schema.Repository.owner_id).to.containSubset({foreign: true});
			expect(schema.Contribution.user_id).to.containSubset({primary: true});
			expect(schema.Contribution.repo_id).to.containSubset({primary: true});		
		});

		it('should sync column reference correctly', async () => {
			let schema = restify.schema();

			expect(schema.User.plan_id).to.containSubset({referencedTable: 'Plan', referencedColumn: 'id'});
			expect(schema.Repository.owner_id).to.containSubset({referencedTable: 'User', referencedColumn: 'id'});
			expect(schema.Contribution.user_id).to.containSubset({referencedTable: 'User', referencedColumn: 'id'});
			expect(schema.Contribution.repo_id).to.containSubset({referencedTable: 'Repository', referencedColumn: 'id'});
		});

		it('should sync column reference alias correctly', async () => {
			let schema = restify.schema();

			expect(schema.User.plan).to.containSubset({alias: 'plan_id'});
			expect(schema.Repository.owner).to.containSubset({alias: 'owner_id'});
			expect(schema.Contribution.user).to.containSubset({alias: 'user_id'});
			expect(schema.Contribution.repo).to.containSubset({alias: 'repo_id'});
		});

		it('should sync column back reference correctly', async () => {
			let schema = restify.schema();

			expect(schema.Plan.plan_of_User).to.containSubset({referencedTable: 'User', referencedColumn: 'plan_id'});
			expect(schema.User.owner_of_Repository).to.containSubset({referencedTable: 'Repository', referencedColumn: 'owner_id'});
			expect(schema.User.user_of_Contribution).to.containSubset({referencedTable: 'Contribution', referencedColumn: 'user_id'});
			expect(schema.Repository.repo_of_Contribution).to.containSubset({referencedTable: 'Contribution', referencedColumn: 'repo_id'});
		});
	});


	describe('#CRUD', () => {
		let restify;
		debugOn();

		describe('#post()', () => {
			beforeEach(async () => {
				await resetDb();
				restify = new Restify(config);
				await restify.sync();
			});

			it.only('should insert one row', async () => {
				let res = await restify.post('User', [{username: 'jhuang78'}]);
				expect(res).to.be.an.array.that.has.length(1);
				expect(res[0].id).to.be.an.int;
			});

			it('should insert some rows', async () => {
				let res = await restify.post('User', [{username: 'jhuang78'},{username: 'jack781217'}]);
				expect(res).to.have.length(2);
				expect(res[0]).to.be.an.int;
				expect(res[1]).to.be.an.int;
			});
		});
	});
	
	
});