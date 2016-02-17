import assert from 'assert';
import chai, {expect} from 'chai';
import chaiSubset from 'chai-subset';
import chaiDatetime from 'chai-datetime';
import logger from '../src/Logger';
import fs from 'fs';
import util from 'util';


import {execCmd, execSql} from './exec';
import dbConfig from './config.json';
import Connection from '../src/Connection';

chai.use(chaiSubset);
chai.use(chaiDatetime);

let resetDb = async () => {
	return await execSql([
		`DROP DATABASE IF EXISTS ${dbConfig.database}`,
		`CREATE DATABASE ${dbConfig.database}`,
	]);
};

function connect() {
	return new Connection(dbConfig.host, dbConfig.user, dbConfig.password, dbConfig.database);
}

describe('# Connection', () => {
	describe('#constructor()', () => {
		it('should create itself', () => {
			let conn = connect('test');
			expect(conn).to.be.not.null;
		});
	});
	
	describe('#exec()', () => {
		it('should execute a statement', async () => {
			let conn = connect();
			let res = await conn.exec('SHOW DATABASES;');
			expect(res).to.containSubset([{Database: 'information_schema'}, {Database: 'restify'}]);
			await conn.end();
		});
	});


	describe.only('#select()', () => {
		let conn;
		beforeEach(async () => {
			await resetDb();
			await execSql([
				`USE ${dbConfig.database}`,
				`CREATE TABLE table1(id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id), field1 INT, field2 VARCHAR(10))`,
				`INSERT INTO table1(field1, field2) VALUES (1, 'one'), (2, 'two'), (3, 'three')`
			]);
			conn = connect();
		});
		afterEach(async () => {
			conn.end();
		});

		it('should read a column from a table', async () => {
			let res = await conn.select('table1', ['field1']);
			expect(res).to.have.length(3);
			expect(res).to.containSubset([{field1: 1}, {field1: 2}, {field1: 3}]);
		});

		it('should read some columns from a table', async () => {
			let res = await conn.select('table1', ['field1', 'field2']);
			expect(res).to.have.length(3);
			expect(res).to.containSubset([{field1: 1, field2: 'one'}, {field1: 2, field2: 'two'}, {field1: 3, field2: 'three'}]);
		});

		it('should read columns from a table with condition', async () => {
			let res;

			res = await conn.select('table1', ['field1'], ['field1', '=', 2]);
			expect(res).to.have.length(1);
			expect(res).to.containSubset([{field1: 2}]);

			res = await conn.select('table1', ['field1'], ['field1', '>=', 2]);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 2}, {field1: 3}]);
		});

		it('should read columns from a table with multiple conditions', async () => {
			let res;

			res = await conn.select('table1', ['field1'], ['OR', ['field1', '=', 2], ['field1', '=', 3]]);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 2}, {field1: 3}]);

			res = await conn.select('table1', ['field1'], ['AND', ['field1', '!=', 2], ['field1', '!=', 3]]);
			expect(res).to.have.length(1);
			expect(res).to.containSubset([{field1: 1}]);


		});

	});

	// describe('#operation', () => {
	// 	let conn;
	// 	beforeEach(async () => {
	// 		let ret = await exec('ls -lash');
	// 		console.log(ret);

	// 		conn = connect();

	// 	});

	// 	describe('#insert()', () => {
	// 		it('should execute insert statement', async () => {
	// 			let res;
	// 			res = await conn.exec('DROP TABLE restify;');
	// 			res = await conn.exec('CREATE TABLE restify(id INT, NOT NULL AUTO_INCREMENT, PRIMARY KEY(id), val VARCHAR(10));');

	// 			res = await conn.insert('test', ['val'], ['val1']);
	// 			await conn.end();
	// 		});
	// 	});
	// });

	
});