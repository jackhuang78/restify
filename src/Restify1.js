import mysql from 'mysql';
import logger from './Logger';
import util from 'util';
import chai, {expect} from 'chai';

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
	string: 'string',
	boolean: 'boolean',
	double: 'double'
};

const Store = {
	Main: 'Main',
	Target: 'Target',
	MainJoint: 'MainJoint',
	TargetJoint: 'TargetJoint'
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
	
	constructor(config) {
		expect(config).to.contain.all.keys(['host', 'user', 'password', 'database']);
		this.config = Object.assign(config);
	}

	async sync() {
		let res;
		let conn = this.connect();
		let schema = {};

		
		res = await conn.exec('USE information_schema;');

 		res = await conn.exec(`SELECT * FROM columns WHERE table_schema='${this.config.database}'`);
 		//console.log(res);
 		for(let column of res) {
 			let tableName = column.TABLE_NAME;
 			if(schema[tableName] == null) {
 				schema[tableName] = {};
 			}
			let table = schema[tableName];

 			
 			let columnName = column.COLUMN_NAME;
 			//console.log('size', tableName, columnName, column.CHARACTER_MAXIMUM_LENGTH, column.NUMERIC_PRECISION, column.CHARACTER_MAXIMUM_LENGTH || column.NUMERIC_PRECISION);
 			table[columnName] = {
 				nullable: (column.IS_NULLABLE === 'YES'),
 				defaultValue: column.COLUMN_DEFAULT,
 				type: column.DATA_TYPE,
 				size: column.CHARACTER_MAXIMUM_LENGTH || column.NUMERIC_PRECISION,
 				scale: column.NUMERIC_SCALE,
 				primary: (column.COLUMN_KEY === 'PRI'),
 				//foreign: (column.COLUMN_KEY === 'MUL'),
 				unique: (column.COLUMN_KEY === 'UNI'),
 				autoInc: (column.EXTRA === 'auto_increment')
 			};
 			// if(table[columnName].primary)
 			// 	table._keys.push(columnName);
 		}

 		res = await conn.exec(`SELECT * FROM key_column_usage WHERE table_schema='${this.config.database}';`);
 		//console.log(res);
 		for(let constraint of res) {
 			let tableName = constraint.TABLE_NAME;
 			let columnName = constraint.COLUMN_NAME;
 			if(schema[tableName] && schema[tableName][columnName]) {
 				let table = schema[tableName];
 				let column = table[columnName];
 				if(constraint.REFERENCED_TABLE_NAME) {
 					column.foreign = true;
 					column.referencedTable = constraint.REFERENCED_TABLE_NAME;
 					column.referencedColumn = constraint.REFERENCED_COLUMN_NAME;

 					// create alias for foreign keys
 					if(columnName.endsWith('_id') || columnName.endsWith('_fk')) {
 						column.alterName = columnName.slice(0, -3);
 						if(table[column.alterName] == null) {
 							table[column.alterName] = {alias: columnName};
 						}
 					}

 					// create back reference
 					schema[column.referencedTable][`${column.alterName}_of_${tableName}`] = {
 						referencedTable: tableName,
 						referencedColumn: columnName
 					};
 				}
 			}
 		}


 		//console.log(schema);

		res = await conn.end();

		this._schema = schema;
	}

	schema() {
		return Object.assign(this._schema);
	}

	checkTable(tableName) {
		if(this._schema[tableName] == null)
			throw new Error(`Table ${tableName} not found.`);
	}

	// connect() {
	// 	return mysql.createConnection({
	// 		host: config.host,
	// 		user: config.user,
	// 		password: config.password,
	// 		database: config.database
	// 	});
	// }

	async post(table, rows) {
		this.checkTable(table);
		let conn = this.connect();

		let created = [];

		for(let row of rows) {
			let columns = new Set();
			rows.map((row) => {
				Object.keys(row).map((column) => {
					columns.add(column);
				});
			});
			columns = Array.from(columns);
			
			let values = rows.map((row) => {
				return columns.map((column) => (row[column] == null) ? null : row[column]);
			});

			let res = await conn.sqlInsertInto(table, columns, values);
			created.push({id: res.insertId});
		}

		

		conn.end();

		return created;
	}

	async get(tableName, query) {
		this.checkTable(tableName);	

		let select = [];
		for(let columnName in query) {
			select.push(columnName);
		}
		console.log('select', select);

		return [];
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
			case Type.boolean:
				return 'BOOLEAN';
			case Type.double:
				return 'FLOAT';
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

	stmtAlterTableAddUnique(p) {
		return `ALTER TABLE ${mysql.escapeId(p.table)}`
			+ ` ADD UNIQUE INDEX ${mysql.escapeId(`unique_${p.column.name}`)} (${mysql.escapeId(p.column.name)});`;
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
		if(where == null)
			return '(1=1)';

		return '(' + Object.keys(where).map((field) => {
			let vals = (where[field] instanceof Array) ? where[field] : [where[field]];
			return vals.map((val) => {
				return mysql.escape({[field]: val});
			}).join(' OR ');
		}).join(') AND (') + ')';
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
			host: restify.config.host,
			user: restify.config.user,
			password: restify.config.password,
			database: restify.config.database
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

	async sqlInsertInto(table, columns, values) {
		let sql = `INSERT INTO ${mysql.escapeId(table)}(${mysql.escapeId(columns)})`
				+ ` VALUES ${mysql.escape(values)};`;
		let res = await this.exec(sql);
		return res;
	}



	async delete(collectionName, query) {
		let res;
		let collection = this._restify._collections[collectionName];

		// remove relation
		for(let fieldName in collection) {
			let field = collection[fieldName];
			if(field.relation === Relation.OneToOne || field.relation === Relation.OneToMany) {
				if(!field.master) {
					res = await this.exec(this._restify.stmtUpdateSet({
						table: field.type,
						set: {[field.as]: null},
						where: {[field.as]: query._id}
					}));
				}
			} else if(field.relation === Relation.ManyToMany) {
				if(field.master) {
					res = await this.exec(this._restify.stmtDeleteFrom({
						table: `${collectionName}_${fieldName}`,
						where: {_id: query._id}
					}));
				} else {
					res = await this.exec(this._restify.stmtDeleteFrom({
						table: `${field.type}_${field.as}`,
						where: {[field.as]: query._id}
					}));
				}
			}
		}


		let select = Object.keys(query).filter((column) => (collection[column] != null));
		let where = {};
		for(let column of select) {
			where[column] = query[column];
		}



		res = await this.exec(this._restify.stmtDeleteFrom({
			table: collectionName,
			where: where
		}));

		return res;
	}

	async get(collection, query) {
		if(Object.keys(query).indexOf(ALL) >= 0) {
			for(let fieldName in this._restify._collections[collection]) {
				if(query[fieldName] === undefined)
					query[fieldName] = undefined;
			}
			delete query[ALL];
		}
		if(Object.keys(query).indexOf(ID) < 0)
			query[ID] = undefined;

		let select = Object.keys(query).filter((fieldName) => {
			return this._restify._collections[collection][fieldName].store === Store.Main;
		});
		
		let where = {};
		for(let fieldName in query) {
			if(this._restify._collections[collection][fieldName].store === Store.Main && query[fieldName] !== undefined) {
				where[fieldName] = query[fieldName];
			}
		}

		let items = await this.exec(this._restify.stmtSelectFrom({
			table: collection,
			select: select,
			where: where
		}));

		for(let item of items) {
			// query for slave fields
			for(let fieldName in query) {
				if(fieldName === ALL)
					continue;
				let field = this._restify._collections[collection][fieldName];
				
				if(field.store === Store.Target) {
					let res = await this.exec(this._restify.stmtSelectFrom({
						table: field.type,
						select: [ID],
						where: {[field.as]: item._id}
					}));

					if(field.relation === Relation.OneToOne) {
						item[fieldName] = res.length > 0 ? res[0]._id : null;
					} else {
						item[fieldName] = res.map((r) => r._id);
					}

				} else if(field.store === Store.MainJoint) {
					let res = await this.exec(this._restify.stmtSelectFrom({
						table: `${collection}_${fieldName}`,
						select: [fieldName],
						where: {[ID]: item[ID]}
					}));
					item[fieldName] = res.map((r) => r[fieldName]);
				} else if(field.store === Store.TargetJoint) {
					let res = await this.exec(this._restify.stmtSelectFrom({
						table: `${field.type}_${field.as}`,
						select: [ID],
						where: {[field.as]: item[ID]}
					}));
					item[fieldName] = res.map((r) => r[ID]);
				}
			}
		}

		// for boolean field, convert result from int to boolean
		// TODO this seems very inefficient
		for(let item of items) {
			for(let field in item) {
				if(this._restify._collections[collection][field].type === Type.boolean) {
					item[field] = (item[field] === 1);
				}
			}
		}

		return items;
	}

	filterFields(item, filter) {
		let filteredItem = {};

		for(let key in item) {
			if(filter(key))
				filteredItem[key] = item[key];
		}

		return filteredItem;
	}

	classOf(v) {
		switch(typeof v) {
			case 'boolean':
			case 'number':
			case 'string':
				return (typeof v);
			case 'object':
				return (v instanceof Array) ? 'array' : 'object';
			default:
				return null;
		}
	}



	async postOrPut(collectionName, item, canCreate, canUpdate) {
		logger.debug(`Restify> POST/PUT ${collectionName} ${util.inspect(item)}`);

		let res;
		let itemIds = {};
		let collection = this._restify._collections[collectionName];

		// create the item if it doesn't yet exist
		if(item._id == null) {
			let columns = Object.keys(item).filter((fieldName) => collection[fieldName].relation == null);
			let values = columns.map((columnName) => item[columnName]);
			res = await this.exec(this._restify.stmtInsertInto({
				table: collectionName,
				columns: columns,
				values: [values]
			}));
			itemIds._id = res.insertId;
			itemIds.created = true;
			
		} else {
			itemIds._id = item._id;
			let itemFields = this.filterFields(item, (fieldName) => collection[fieldName].relation == null);
			if(Object.keys(itemFields).length !== 0) {
				res = await this.exec(this._restify.stmtUpdateSet({
					table: collectionName,
					set: itemFields,
					where: {_id: itemIds._id}
				}));
			}
		}

		for(let fieldName in item) {
			let field = collection[fieldName];
			let value = item[fieldName];
			if(value === undefined || field.relation == null)
				continue;

			
			if(field.relation === Relation.OneToOne || field.relation === Relation.ManyToOne) {
				// case: ToOne relations
				let child = value;
				let childClass = this.classOf(child);

				if(childClass === 'number') { 
					// child id given
					itemIds[fieldName] = {_id: child};
				} else if(childClass === 'object') {
					// child needs to be created first
					res = await postOrPut(field.type, child);
					itemIds[fieldName] = res;
				} else {
					throw new Error(`Expecting object or number for OneToOne relation, but got ${childClass}.`);
				}

				if(field.relation === Relation.OneToOne) {
					if(field.master) {
						// remove the child from any other relation
						res = await this.exec(this._restify.stmtUpdateSet({
							table: collectionName,
							set: {[fieldName]: null},
							where: {[fieldName]: itemIds[fieldName]._id}
						}));

						// set the relation
						res = await this.exec(this._restify.stmtUpdateSet({
							table: collectionName,
							set: {[fieldName]: itemIds[fieldName]._id},
							where: {_id: itemIds._id}
						}));
					} else {
						res = await this.exec(this._restify.stmtUpdateSet({
							table: field.type,
							set: {[field.as]: null},
							where: {[field.as]: itemIds._id}
						}));					

						res = await this.exec(this._restify.stmtUpdateSet({
							table: field.type,
							set: {[field.as]: itemIds._id},
							where: {_id: itemIds[fieldName]._id}
						}));
					}
				} else {
					if(field.master) {
						// set the relation
						res = await this.exec(this._restify.stmtUpdateSet({
							table: collectionName,
							set: {[fieldName]: itemIds[fieldName]._id},
							where: {_id: itemIds._id}
						}));
					} else {
						throw new Error(`Cannot have ManyToOne slave relation`);
					}
				}
			} else {
				// case: ToMany relations
				let children = value;
				let childrenClass = this.classOf(children);
				if(childrenClass !== 'array') {
					throw new Error(`Expecting array for OneToMany relation, but got ${childrenClass}.`);
				}

				itemIds[fieldName] = [];

				for(let child of children) {
					let childClazz = this.classOf(child);
					if(childClazz === 'object') {
						res = await postOrPut(field.type, child);
						itemIds[fieldName].push(res);
					} else if(childClazz === 'number') {
						itemIds[fieldName].push({_id: child});
					} else {
						throw new Error(`Expecting array of object or number for OneToMany relation, but got ${childClazz}.`);
					}
				}

				if(field.relation === Relation.OneToMany) {
					if(field.master) {
						throw new Error(`Cannot have OneToMany master relation`);
					} else {
						res = await this.exec(this._restify.stmtUpdateSet({
							table: field.type,
							set: {[field.as]: null},
							where: {[field.as]: itemIds._id}
						}));

						res = await this.exec(this._restify.stmtUpdateSet({
							table: field.type,
							set: {[field.as]: itemIds._id},
							where: {_id: itemIds[fieldName].map((child) => child._id)}
						}));
					}
				} else {
					if(field.master) {
						res = await this.exec(this._restify.stmtDeleteFrom({
							table: `${collectionName}_${fieldName}`,
							where: {_id: itemIds._id}
						}));
						res = await this.exec(this._restify.stmtInsertInto({
							table: `${collectionName}_${fieldName}`,
							columns: ['_id', fieldName],
							values: itemIds[fieldName].map((child) => [itemIds._id, child._id])
						}));
					} else {
						res = await this.exec(this._restify.stmtDeleteFrom({
							table: `${field.type}_${field.as}`,
							where: {[field.as]: itemIds._id}
						}));
						res = await this.exec(this._restify.stmtInsertInto({
							table: `${field.type}_${field.as}`,
							columns: ['_id', field.as],
							values: itemIds[fieldName].map((child) => [child._id, itemIds._id])
						}));
					}
				}

			}	// IF relation
		} // FOR field

		return itemIds;


	}

	async put(collection, item) {
		logger.debug('PUT', collection, item);


		let mainItem = {};
		for(let fieldName in item) {
			let field = this._restify._collections[collection][fieldName];
			if(field.store === Store.Main) {
				mainItem[fieldName] = item[fieldName];
			}
		}

		let res = await this.exec(this._restify.stmtUpdateSet({
			table: collection,
			set: mainItem,
			where: {[ID]: item[ID]}
		}));

		// udpate 
		for(let fieldName in item) {
			let field = this._restify._collections[collection][fieldName];

			if(field.store === Store.Target) {
				let targetIds = (field.relation === Relation.OneToOne) 
					? [item[fieldName]] 
					: item[fieldName];

				//if(field.relation === Relation.OneToOne) {
				await this.exec(this._restify.stmtUpdateSet({
					table: field.type,
					set: {[field.as]: null},
					where: {[field.as]: item[ID]}
				}));				
				//}
				
				if(targetIds.length !== 0) {
					res = await this.exec(this._restify.stmtUpdateSet({
						table: field.type,
						set: {[field.as]: item[ID]},
						where: {[ID]: targetIds}
					}));
				}
				
			} else if(field.store === Store.MainJoint) {
				let targetIds = item[fieldName];
				let res = await this.exec(this._restify.stmtDeleteFrom({
					table: `${collection}_${fieldName}`,
					where: {[ID]: item[ID]}
				}));
				res = await this.exec(this._restify.stmtInsertInto({
					table: `${collection}_${fieldName}`,
					columns: [ID, fieldName],
					values: targetIds.map((targetId) => [item[ID], targetId])
				}));
			} else if(field.store === Store.TargetJoint) {
				let targetIds = item[fieldName];
				let res = await this.exec(this._restify.stmtDeleteFrom({
					table: `${field.type}_${field.as}`,
					where: {[field.as]: item[ID]}
				}));
				res = await this.exec(this._restify.stmtInsertInto({
					table: `${field.type}_${field.as}`,
					columns: [ID, field.as],
					values: targetIds.map((targetId) => [targetId, item[ID]])
				}));
			}
		}

		return res;
	}



	

	beginTransaction() {

	}

	commitTransaction() {

	}

	revertTransaction() {

	}	

}





export default Restify;
