import Enum from 'es6-enum';
import mysql from 'mysql';
import logger from './Logger';

// TODO
// make this work with single table query only!

const Relation = {
	OneToOne: 'OneToOne',
	OneToMany: 'OneToMany',
	ManyToOne: 'ManyToOne',
	ManyToMany: 'ManyToMany'
};

const Type = {
	int: 'int',
	date: 'date',
	string: 'string'
};

const Type2 = {
	int: 'INT',
	date: 'DATETIME',
	string: 'VARCHAR'
};

const ID = '_id';
const ALL = '*';

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

		// create records for each collection and the fields of each
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
					type: (field.type == null) ? Type.string : field.type,
					nullable: (field.nullable) ? true : false,
					relation: Relation[field.relation],
					master: Relation[field.relation] ? true : false,
					as: field.as
				};
			}
		}

		// create relation between collections
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
			await conn.exec(this.stmtCreateTable({
				table: collectionName
			}));
		}

		// add columns
		for(let collectionName of Object.keys(this._collections)) {
			let collection = this._collections[collectionName];
			for(let fieldName of Object.keys(collection)) {
				let field = collection[fieldName];

				if(fieldName === '_id')
					continue;
				
				if(!field.relation) {
					await conn.exec(this.stmtAlterTableAdd({
						table: collectionName, 
						column: {name: fieldName, type: field.type}
					}));
					continue;
				}

				if(!field.master)
					continue;

				switch(field.relation) {
					case Relation.OneToOne:
					case Relation.ManyToOne:
						await conn.exec(this.stmtAlterTableAddFk({
							table: collectionName,
							column: {name: fieldName, type: field.type}
						}));
						break;
					case Relation.ManyToMany:
						await conn.exec(this.stmtCreateJoinTable({
							table: collectionName, 
							master: collectionName,
							slave: field.type,
							field: fieldName
						}));
						break;	
				}
			}
		}
		


		await conn.end();
	}


	


	//========================================
	//	Private Functions
	//========================================
	
	isToOne(relation) {
		return (relation == Relation.OneToOne) || (relation == Relation.ManyToOne);
	}


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
	
	toSqlType(type) {
		switch(type) {
			case Type.int:
				return 'INT';
			case Type.date:
				return 'DATETIME';
			case Type.string:
				return 'VARCHAR(255)';
			default:
				throw Error(`Undefined type ${type}`);
		}
	}
	
	stmtCreateTable(p) {
		return `CREATE TABLE IF NOT EXISTS ${mysql.escapeId(p.table)} (`
			+ `${mysql.escapeId(ID)} INT AUTO_INCREMENT, `
			+ `PRIMARY KEY(${mysql.escapeId(ID)})`
			+ `);`;
	}

	stmtCreateJoinTable(p) {
		return `CREATE TABLE IF NOT EXISTS ${mysql.escapeId(`${p.master}_${p.field}`)} (`
			+ ` ${mysql.escapeId(ID)} INT,`
			+ ` FOREIGN KEY (${mysql.escapeId(ID)}) `
			+ ` REFERENCES ${mysql.escapeId(p.master)}(${mysql.escapeId(ID)}),`
			+ ` ${mysql.escapeId(p.field)} INT,`
			+ ` FOREIGN KEY (${mysql.escapeId(p.field)})`
			+ ` REFERENCES ${mysql.escapeId(p.slave)}(${mysql.escapeId(ID)}));`;
	}

	stmtAlterTableAdd(p) {
		//let size = column.size ? `(${column.size})` : ``;
		return `ALTER TABLE ${mysql.escapeId(p.table)}`
			+ ` ADD ${mysql.escapeId(p.column.name)} ${this.toSqlType(p.column.type)};`;
	}

	stmtAlterTableAddFk(p) {
		return `ALTER TABLE ${mysql.escapeId(p.table)}`
			+ ` ADD ${mysql.escapeId(p.column.name)} INT,`
			+ ` ADD FOREIGN KEY (${mysql.escapeId(p.column.name)})`
			+ ` REFERENCES ${mysql.escapeId(p.column.type)}(${mysql.escapeId(ID)});`;
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

	stmtFormatWhere(where) {
		return Object.keys(where).map((field) => {
			return mysql.escape({[field]: where[field]});
		}).join(' AND ');
	}

	//=======

	stmtInsertInto(p) {
		return `INSERT INTO ${mysql.escapeId(p.table)}(${mysql.escapeId(p.columns)})`
			+ ` VALUES ${mysql.escape(p.values)};`;
	}

	stmtSelectFrom(p) {
		let select = p.select.map((column) => {
			return (column === ALL) ? column : mysql.escapeId(column);
		}).join(',');
		return `SELECT ${select}`
			+ ` FROM ${p.table}`
			+ ` WHERE ${this.stmtFormatWhere(p.where)};`;
	}

	stmtUpdateSet(p) {
		return `UPDATE ${mysql.escapeId(p.table)}`
			+ ` SET ${mysql.escape(p.set)}`
			+ ` WHERE ${this.stmtFormatWhere(p.where)};`;
	}

	stmtDeleteFrom(p) {
		return `DELETE FROM ${mysql.escapeId(p.table)}`
			+ ` WHERE ${this.stmtFormatWhere(p.where)};`;
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
		let created = {};
		
		// only actual fields and toOne master relation is stored in the main table
		let columns = Object.keys(item).filter((column) => {
			let field = this._restify._collections[collection][column];
			if(field == null)
				return false;
			else if(field.relation == null)
				return true;
			else if(field.relation === Relation.OneToOne || field.relation === Relation.ManyToOne)
				return field.master;
			else 
				return false;
		});

		let values = columns.map((column) => item[column]);

		let res = await this.exec(this._restify.stmtInsertInto({
			table: collection,
			columns: columns,
			values: [values]
		}));

		created._id = res.insertId;

		return created;
	}

	async get(collection, query) {
		let select = Object.keys(query).filter((column) => {
			return column === ALL || this._restify._collections[collection][column] != null;
		});
		
		let where = {};
		for(let column of select) {
			if(column !== ALL && query[column] !== undefined)
				where[column] = query[column];
		}

		let res = await this.exec(this._restify.stmtSelectFrom({
			table: collection,
			select: select,
			where: where
		}));

		return res;
	}

	async delete(collection, query) {
		let select = Object.keys(query).filter((column) => {
			return this._restify._collections[collection][column] != null;
		});
		let where = {};
		for(let column of select) {
			where[column] = query[column];
		}

		let res = await this.exec(this._restify.stmtDeleteFrom({
			table: collection,
			where: where
		}));

		return res;
	}

	

	
	// async get(collection, q) {

	// 	let select = Object.keys(q).map((field) => {
	// 		let field = this._restify[collection][column];
	// 		return !field.relation 
	// 			|| (field.master && (field.relation == Relation.OneToOne || field.relation == Relation.ManyToOne));
	// 	});

	// 	let where = select.filter((field) => {
	// 		return q[field] !== undefined;
	// 	}).map((field) => {
	// 		return 
	// 	});



	// 	if(q.select != null && q.select.length != 0 && q.select[0] === '*')
	// 		q.select = Object.keys(this._restify._collections[collection]);

	// 	for(let fieldName of q.select) {
	// 		if(q.where[fieldName] === undefined) {
	// 			q.where[fieldName] = undefined;	// probably not a good idea...
	// 		}
	// 	}
	// 	let res = await this.exec(this._restify.stmtSelectFrom(collection, q.where));
	// 	return res;
	// }

	put() {

	}

	

	

	beginTransaction() {

	}

	commitTransaction() {

	}

	revertTransaction() {

	}	


	// async post2(collection, item) {
	// 	let created = {};

	// 	// first, insert all nested items
	// 	// for(let fieldName in item) {
	// 	// 	let field = this._restify[collection][fieldName];
	// 	// 	switch(field.relation) {
	// 	// 		case Relation.OneToOne:
	// 	// 		case Relation.ManyToOne:
	// 	// 			created[fieldName] = await this.post(field.type, item[fieldName]);
	// 	// 			item[fieldName] = created[fieldName]._id;
	// 	// 			break;
	// 	// 		case Relation.OneToMany:
	// 	// 		case Relation.ManyToMany:
	// 	// 			created[fieldName] = [];
	// 	// 			for(let child of item[fieldName]) {
	// 	// 				created[fieldName].push(await this.post(field.type, child));
	// 	// 			}
	// 	// 			item[fieldName] = created[fieldName].map((obj) => obj._id);
	// 	// 			break;
	// 	// 	}
	// 	// }


	// 	let columns = Object.keys(item).filter((column) => {
	// 		let field = this._restify[collection][column];
	// 		return !field.relation 
	// 			|| (field.master && (field.relation == Relation.OneToOne || field.relation == Relation.ManyToOne));
	// 	});

	// 	let res = await this.exec(this._restify.stmtInsertInto({
	// 		table: collection,
	// 		columns: columns,
	// 		values: columns.map((column) => item[column])
	// 	}));
	// let res = await this.exec(this._restify.stmtInsertInto(collection, item));
		

	// 	//TODO
	// 	created._id = res.insertId;
	// 	return created;
	// }
}





export default Restify;