import Enum from 'es6-enum';
import mysql from 'mysql';
import logger from './Logger';



const Relation = {
	OneToOne: 'OneToOne',
	OneToMany: 'OneToMany',
	ManyToOne: 'ManyToOne',
	ManyToMany: 'ManyToMany'
};

const Type = {
	int: 'INT',
	date: 'DATETIME',
	string: 'VARCHAR(255)'
};

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
	
	constructor(config, config2) {

		// read database configuration
		// and create mysql connection
		this._database = {
			host: config.database.host,
			user: config.database.user,
			pass: config.database.pass,
			db: config.database.db
		};




		//this._collections = JSON.parse(JSON.stringify(config.schema));
		
		this._collections = {};
		for(let collectionName in config.schema) {
			this._collections[collectionName] = {
				_id: {
					type: Type.int,
					nullable: false,
					key: true
				}
			};

			for(let fieldName in config.schema[collectionName]) {
				let field = config.schema[collectionName][fieldName];

				this._collections[collectionName][fieldName] = {
					type: (field.type == null) ? 'string' : field.type,
					nullable: (field.nullable) ? true : false,
					relation: Relation[field.relation],
					master: Relation[field.relation] ? true : false,
					as: field.as
				};
			}


		}

		// add ID field and mark master relation
		// for(let collectionName in this._collections) {
		// 	let collection = this._collections[collectionName];
			
		// 	collection._id = {
		// 		type: Type.int,
		// 		nullable: 'false'
		// 	};

		// 	for(let fieldName in collection) {
		// 		let field = collection[fieldName];

		// 		if(field.nullable == null) {
		// 			field.nullable = true;
		// 		} 

		// 		if(field.relation != null) {
		// 			field.master = true;
		// 		}
		// 	}
		// }

		for(let collectionName in this._collections) {
			let collection = this._collections[collectionName];

			for(let fieldName in collection) {
				let field = collection[fieldName];
				if(field.master) {
					this._collections[field.type][field.as] = {
						type: collectionName,
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
		return Object.keys(this._collections);
	}

	/**
	 * Get a list of fields for a given collection.
	 * @function Restify#fields
	 * @param  {String} collection - Collection to get the fields of.
	 * @return {Array<String>} List of fields in the given collection.
	 */
	fields(collection) {
		return Object.keys(this._collections[collection]);
	}

	connect() {
		return new Connection(this);
	}


	async reset() {	
		let conn = this.connect();

		let tableNameRecords = await conn.exec(this.stmtSelectTableName());
		await conn.exec(this.stmtSetForeignKeyCheck(false));
		for(let record of tableNameRecords) {
			await conn.exec(this.stmtDropTable(record.table_name));
		}
		await conn.exec(this.stmtSetForeignKeyCheck(true));

		await conn.end();
	}

	/**
	 * Sync database schema.
	 * @function Restify#sync
	 * @param  {Boolean} update - To update or not.
	 * @return {Promise<null>} 
	 */
	async sync(update) {
		let conn = this.connect();

		// create table with id
		for(let collectionName of Object.keys(this._collections)) {
			await conn.exec(this.stmtCreateTable(collectionName, '_id'));
		}

		// add columns
		for(let collectionName of Object.keys(this._collections)) {
			let collection = this._collections[collectionName];
			for(let fieldName of Object.keys(collection)) {
				let field = collection[fieldName];

				if(fieldName === '_id')
					continue;
				
				if(!field.relation) {
					await conn.exec(this.stmtAlterTableAdd(collectionName, fieldName, field));
					continue;
				}

				if(!field.master)
					continue;

				switch(field.relation) {
					case Relation.ManyToMany:
						await conn.exec(this.stmtCreateJoinTable(collectionName, '_id', fieldName, field.type, '_id'));
						break;	
				}


			}
		}
		


		await conn.end();
	}


	


	//========================================
	//	Private Functions
	//========================================
	
	// TODO make enum
	invRelation(relation) {
		switch(relation) {
			case Relation.OneToOne:
			case Relation.ManyToMany:
				return relation;
			case Relation.OneToMany: 
				return Relation.ManyToOne;
			case Relation.ManyToOne:
				return Relation.OneToMany;
			default:
				return null;
		}
	}


	
	//===============================
	//	SQL statements
	//===============================
	
	stmtCreateTable(table, id) {
		return `CREATE TABLE IF NOT EXISTS ${mysql.escapeId(table)} (`
			+ `${mysql.escapeId(id)} int, PRIMARY KEY(${mysql.escapeId(id)})`
			+ `);`;
	}

	stmtCreateJoinTable(master, masterId, field, slave, slaveId) {
		return `CREATE TABLE IF NOT EXISTS ${mysql.escapeId(`${master}_${field}`)} (`
			+ ` ${mysql.escapeId(`_id`)} int,`
			+ ` FOREIGN KEY (${mysql.escapeId(`_id`)}) `
			+ ` REFERENCES ${mysql.escapeId(master)}(${mysql.escapeId(masterId)}),`
			+ ` ${mysql.escapeId(`${field}_id`)} int,`
			+ ` FOREIGN KEY (${mysql.escapeId(`${field}_id`)}) `
			+ ` REFERENCES ${mysql.escapeId(slave)}(${mysql.escapeId(slaveId)}));`;
	}

	stmtAlterTableAdd(table, columnName, column) {
		return `ALTER TABLE ${mysql.escapeId(table)}`
			+ ` ADD ${mysql.escapeId(columnName)} ${Type[column.type]};`;
	}


	stmtSelectTableName() {
		return `SELECT table_name`
			+ ` FROM information_schema.tables`
			+ ` WHERE table_schema=${mysql.escape(this._database.db)};`;
	}

	stmtSetForeignKeyCheck(state) {
		return `SET FOREIGN_KEY_CHECKS=${mysql.escape(state ? 1 : 0)};`;
	}

	stmtDropTable(table) {
		return `DROP TABLE ${mysql.escapeId(table)};`;
	}

	stmtInsertInto(table, record) {
		let columns = Object.keys(record);
		let values = columns.map((column) => {
			return record[column];
		});

		return `INSERT INTO ${mysql.escapeId(table)}`
			+ ` (${mysql.escapeId(columns)})`
			+ ` VALUES (${mysql.escape(values)});`;
	}

}

class Connection {
	constructor(restify) {
		this._restify = restify;
		this._conn = mysql.createConnection({
			host: restify._database.host,
			user: restify._database.user,
			password: restify._database.pass,
			database: restify._database.db
		});
	}

	async exec(sql) {
		return new Promise((res, rej) => {
			logger.debug(`SQL> ${sql}`);
			this._conn.query(sql, (err, rows, fields) => {
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
					rej(err);
				res();
			});
		});
		
	}

	async post(collection, item) {
		console.log(collection, item, 'abc');
		let res = await this.exec(this._restify.stmtInsertInto(collection, item));
		console.log(res);
		return;
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