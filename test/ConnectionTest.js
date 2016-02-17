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


	describe('#select()', () => {
		let conn;
		beforeEach(async () => {
			await resetDb();
			await execSql([
				`USE ${dbConfig.database}`,
				`CREATE TABLE table1(id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id), field1 INT, field2 VARCHAR(10))`,
				`INSERT INTO table1(field1, field2) VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four')`
			]);
			conn = connect();
		});
		afterEach(async () => {
			conn.end();
		});

		it('should read a column from a table', async () => {
			let res = await conn.select('table1', ['field1']);
			expect(res).to.have.length(4);
			expect(res).to.containSubset([{field1: 1}, {field1: 2}, {field1: 3}, {field1: 4}]);
		});

		it('should read some columns from a table', async () => {
			let res = await conn.select('table1', ['field1', 'field2']);
			expect(res).to.have.length(4);
			expect(res).to.containSubset([{field1: 1, field2: 'one'}, {field1: 2, field2: 'two'}, {field1: 3, field2: 'three'}, {field1: 4, field2: 'four'}]);
		});

		it('should read columns from a table with condition', async () => {
			let res;

			res = await conn.select('table1', ['field1'], ['field1', '=', 2]);
			expect(res).to.have.length(1);
			expect(res).to.containSubset([{field1: 2}]);

			res = await conn.select('table1', ['field1'], ['field1', '>=', 2]);
			expect(res).to.have.length(3);
			expect(res).to.containSubset([{field1: 2}, {field1: 3}, {field1: 4}]);
		});

		it('should read columns from a table with multiple conditions', async () => {
			let res;

			res = await conn.select('table1', ['field1'], ['OR', ['field1', '=', 2], ['field1', '=', 3]]);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 2}, {field1: 3}]);

			res = await conn.select('table1', ['field1'], ['AND', ['field1', '!=', 2], ['field1', '!=', 3]]);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 1}, {field1: 4}]);
		});

		it('should read columns from a table with nested conditions', async () => {
			let res;

			res = await conn.select('table1', ['field1'], ['OR', ['field1', '=', 1], ['AND', ['field1', '!=', 2], ['field1', '!=', 3]]]);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 1}, {field1: 4}]);

		});
	});

	describe('#insert', () => {
		let conn;

		beforeEach(async () => {
			logger.debugOn();
			await resetDb();
			await execSql([
				`USE ${dbConfig.database}`,
				`CREATE TABLE table1(id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id), field1 INT, field2 VARCHAR(10))`
			]);
			conn = connect();
		});

		afterEach(async () => {
			conn.end();
		});

		it('should insert a row', async () => {
			let res = await conn.insert('table1', ['field1'], [[1]]);
			res = await conn.select('table1', ['field1']);
			expect(res).to.have.length(1);
			expect(res).to.containSubset([{field1: 1}]);
		});

		it('should insert multiple rows', async () => {
			let res = await conn.insert('table1', ['field1'], [[1],[3]]);
			res = await conn.select('table1', ['field1']);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 1}, {field1: 3}]);
		});

		it('should insert multiple rows with multiple columns', async () => {
			let res = await conn.insert('table1', ['field1', 'field2'], [[1,'one'],[3,'three']]);
			res = await conn.select('table1', ['field1','field2']);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 1, field2: 'one'}, {field1: 3, field2: 'three'}]);
		});

		it('should insert a row and return the generated id', async () => {
			let id1 = await conn.insert('table1', ['field1'], [[3]]);
			expect(id1).to.be.an.int;

			let id2 = await conn.insert('table1', ['field1'], [[4]]);
			expect(id2).to.be.an.int;

			let res = await conn.select('table1', ['field1'], ['id', '=', id1]);
			expect(res).to.have.length(1);
			expect(res).to.containSubset([{field1: 3}]);

			res = await conn.select('table1', ['field1'], ['id', '=', id2]);
			expect(res).to.have.length(1);
			expect(res).to.containSubset([{field1: 4}]);
		});
	});

	describe.only('#update', () => {
		let conn;
		
		beforeEach(async () => {
			logger.debugOn();
			await resetDb();
			await execSql([
				`USE ${dbConfig.database}`,
				`CREATE TABLE table1(id INT NOT NULL AUTO_INCREMENT, PRIMARY KEY(id), field1 INT, field2 VARCHAR(10))`,
				`INSERT INTO table1(field1, field2) VALUES (1, 'one'), (2, 'two'), (3, 'three'), (4, 'four')`
			]);
			conn = connect();
		});

		afterEach(async () => {
			conn.end();
		});

		it('should udpate rows', async () => {
			let res;

			res = await conn.update('table1', {field1: 10, field2: 'ten'}, ['OR', ['field1', '=', 1], ['field2', '=', 'two']]);
			
			res = await conn.select('table1', ['field1'], ['field2', '=', 'ten']);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 10}, {field1: 10}]);

			res = await conn.select('table1', ['field1'], ['field2', '!=', 'ten']);
			expect(res).to.have.length(2);
			expect(res).to.containSubset([{field1: 3}, {field1: 4}]);

		});

	});
	
	
});