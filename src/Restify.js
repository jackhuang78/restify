import mysql from 'mysql';
import logger from './Logger';

const ONE_TO_ONE = 'OneToOne';
const ONE_TO_MANY = 'OneToMany';
const MANY_TO_ONE = 'ManyToOne';
const MANY_TO_MANY = 'ManyToMany';

/**
 * @class Restify
 * @param {Object} config - Configuration.
 * @param {Object} config.database - Database configuration.
 * @param {String} config.database.host - Host/IP.
 * @param {String} config.database.user - Username.
 * @param {String} config.database.pass - Password.
 * @param {String} config.database.db - Database name.
 * @param {Object} config.schema - Schema configuration.
 * @param {Object} config.schema.{collection} - Collection name.
 * @param {Object} config.schema.{collection}.{field} - Field name.
 * @param {Object} config.schema.{collection}.{field}.type - Data type.
 * @param {Boolean} config.schema.{collection}.{field}.nullable - Can be null.
 * @param {String} config.schema.{collection}.{field}.relation - Relation.
 * @param {String} config.schema.{collection}.{field}.as - Remote name.
 * 
 */
class Restify {
	
	constructor(config) {

		// read database configuration
		// and create mysql connection
		this.database = {
			host: config.database.host,
			user: config.database.user,
			pass: config.database.pass,
			db: config.database.db
		};

		this.types = JSON.parse(JSON.stringify(config.schema));

		// add ID field and mark master relation
		for(let typeName in this.types) {
			let type = this.types[typeName];
			
			type._id = {
				type: 'int',
				nullable: 'false',
			};

			for(let fieldName in type) {
				let field = type[fieldName];

				if(field.nullable == null) {
					field.nullable = true;
				} 

				if(field.relation != null) {
					field.master = true;
				}
			}
		}

		for(let typeName in this.types) {
			let type = this.types[typeName];

			for(let fieldName in type) {
				let field = type[fieldName];
				if(field.master) {
					this.types[field.type][field.as] = {
						type: typeName,
						nullable: false,
						relation: this.invRelation(field.relation),
						as: fieldName
					};
				}
			}
		}
	}

	/**
	 * Get a list of collections in the database.
	 * @function Restify#collections
	 * @return {Array<String>} List of collections
	 */
	collections() {
		return Object.keys(this.types);
	}

	/**
	 * Get a list of fields for a given collection.
	 * @function Restify#fields
	 * @param  {String} collection - Collection to get the fields of.
	 * @return {Array<String>} List of fields in the given collection.
	 */
	fields(collection) {
		return Object.keys(this.types[collection]);
	}

	connect() {
		return new Connection(this);
	}

	reset() {
		return new Promise((res, rej) => {
			res('abc');
			// let conn = this.connect();

			// conn.exec(this.selectTableNameStmt())
			// .then((tables) => {
			// 	return conn.exec(this.setForeignKeyCheckStmt(0)).then((rows) => {
			// 		conn.exec(this.setForeignKeyCheckStmt(1))
			// 	});
			// })
			// .then((rows) => {
			// 	return conn.exec(this.setForeignKeyCheckStmt(1));
			// })
			// .catch((err) => {
			// 	conn.end();
			// 	rej(err);
			// });
		});
	}

	/**
	 * Sync database schema.
	 * @function Restify#sync
	 * @param  {Boolean} update - To update or not.
	 * @return {Promise<null>} 
	 */
	sync(update) {
		return new Promise((res, rej) => {
			let conn = this.connect();
			//console.log('begin sync');
			Promise.all(Object.keys(this.types).map((typeName) => {
				return conn.exec(this.createTableStmt(typeName));
			})).then((values) => {
				//console.log('end sync');
				conn.end();
				res(values);
			}).catch((err) => {
				conn.end();
				rej(err);
			});
		});
	}


	


	//========================================
	//	Private Functions
	//========================================
	invRelation(relation) {
		switch(relation) {
			case ONE_TO_ONE:
			case MANY_TO_MANY:
				return relation;
			case ONE_TO_MANY: 
				return MANY_TO_ONE;
			case MANY_TO_ONE:
				return ONE_TO_MANY;
			default:
				throw new Error(`Undefined relation ${relation}.`);
		}
	}

	escId(id) {	
		return this.conn.escapeId(id);
	}

	escVal(val) {
		return this.conn.escape(val);
	}

	
	

	createTableStmt(table) {
		return `CREATE TABLE IF NOT EXISTS ${mysql.escapeId(table)} (\n`
			+ `\tid int, PRIMARY KEY(id)\n`
			+ `);`;
	}

	selectTableNameStmt() {
		return `SELECT table_name\n`
			+ `\tFROM information_schema.tables\n`
			+ `\tWHERE table_schema=${mysql.escape(this.database.db)};`;
	}

	setForeignKeyCheckStmt(state) {
		return `SET FOREIGN_KEY_CHECKS=${mysql.escape(state)};`;
	}


}

class Connection {
	constructor(restify) {
		this.restify = restify;
		this.conn = mysql.createConnection({
			host: restify.database.host,
			user: restify.database.user,
			password: restify.database.pass,
			database: restify.database.db
		});
	}

	exec(sql) {
		return new Promise((res, rej) => {
			logger.debug(`SQL> ${sql}`);
			this.conn.query(sql, (err, rows, fields) => {
				if(err)
					return rej(err);
				return res(rows);
			});
		});
	}

	end() {
		return new Promise((res, rej) => {
			this.conn.end((err) => {
				if(err)
					rej(err);
				res();
			});
		});
		
	}

	post() {

	}

	get() {

	}

	put() {

	}

	delete() {

	}

	

	beginTransaction() {

	}

	commitTransaction() {

	}

	revertTransaction() {

	}	
}





export default Restify;