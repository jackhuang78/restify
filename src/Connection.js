import mysql from 'mysql';
import logger from './Logger';
import chai, {expect} from 'chai';

class Connection {
	/**
	 * Create a SQL connection
	 * @param  {[type]} host     [description]
	 * @param  {[type]} user     [description]
	 * @param  {[type]} password [description]
	 * @param  {[type]} database [description]
	 * @return {[type]}          [description]
	 */
	constructor(host, user, password, database) {
		this._conn = mysql.createConnection({
			host: host,
			user: user,
			password: password,
			database: database,
			multipleStatements: true
		});
	}

	/**
	 * Execute a sql statament
	 * @param  {[type]} sql [description]
	 * @return {[type]}     [description]
	 */
	async exec(stmt) {
		return new Promise((res, rej) => {
			logger.debug(`SQL> ${stmt}`);
			this._conn.query(stmt, (err, rows, fields) => {
				if(err) 
					return rej(err);

				return res(rows);
			});
		});
	}

	async end() {
		return new Promise((res, rej) => {
			this._conn.end((err) => {
				if(err) 
					return rej(err);
			
				return res();
			});
		});
	}

	_parseWhere(where) {
		expect(where).to.be.an.array;
		let operator = where[0];
		if(operator === 'AND' || operator === 'OR') {
			return where.slice(1).map(w => this._parseWhere(w)).join(operator);
		} else {
			expect(where).to.have.length(3);
			return `(${mysql.escapeId(where[0])} ${where[1]} ${mysql.escape(where[2])})`;
		}
	}

	async select(table, columns, where) {
		let stmt = (where == null || where === '' || where.length === 0 || where === {}) 
				? `SELECT ${mysql.escapeId(columns)} FROM ${table};`
				: `SELECT ${mysql.escapeId(columns)} FROM ${table} WHERE ${this._parseWhere(where)};`;
		let res = await this.exec(stmt);
		return res;
	}

	async insert(table, columns, values) {
		let stmt = `INSERT INTO ${mysql.escapeId(p.table)}(${mysql.escapeId(p.columns)})` 
				+ ` VALUES ${mysql.escape(p.values)};`;
		let res = await this.exec(stmt);
		return res;
	}

}

export default Connection;