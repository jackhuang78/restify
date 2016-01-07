import Enum from 'es6-enum';
import mysql from 'mysql';
import logger from './Logger';
import util from 'util';

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

		// add some more metadata
		for(let collectionName in this._collections) {
			let collection = this._collections[collectionName];
			for(let fieldName in collection) {
				let field = collection[fieldName];
				switch(field.relation) {
					case Relation.OneToOne:
						field.store = field.master ? Store.Main : Store.Target;
						break;
					case Relation.ManyToOne:
						field.store = Store.Main;
						break;
					case Relation.OneToMany:
						field.store = Store.Target;
						break;
					case Relation.ManyToMany:
						field.store = field.master ? Store.MainJoint : Store.TargetJoint;
						break;
					default:
						field.store = Store.Main;
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
						await conn.exec(this.stmtAlterTableAddFk({
							table: collectionName,
							column: {name: fieldName, type: field.type}
						}));
						await conn.exec(this.stmtAlterTableAddUnique({
							table: collectionName,
							column: {name: fieldName}
						}));
						break;
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
						await conn.exec(this.stmtCreateUniqueIndex({
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

	stmtCreateUniqueIndex(p) {
		return `ALTER TABLE ${mysql.escapeId(`${p.master}_${p.field}`)}`
			+ ` ADD UNIQUE ${mysql.escapeId(`uq_${p.master}_${p.field}`)}`
			+ ` (${mysql.escapeId(ID)}, ${mysql.escapeId(p.field)})`;
	}

	stmtAlterTableAdd(p) {
		//let size = column.size ? `(${column.size})` : ``;
		return `ALTER TABLE ${mysql.escapeId(p.table)}`
			+ ` ADD ${mysql.escapeId(p.column.name)} ${this.toSqlType(p.column.type)};`;
	}

	stmtAlterTableAddUnique(p) {
		return `ALTER TABLE ${mysql.escapeId(p.table)}`
			+ ` ADD UNIQUE (${mysql.escapeId(p.column.name)});`;
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
		 
		let res = await this.exec(this._restify.stmtInsertInto({
			table: collection,
			columns: [],
			values: [[]]
		}));

		created._id = res.insertId;

		item[ID] = created[ID];
		await this.put(collection, item);


		return created;
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




	async createOrUpdate(collectionName, item) {
		logger.debug(`Restify> PUT ${collectionName} ${util.inspect(item)}`);

		let res;
		let itemIds = {};
		let collection = this._restify._collections[collectionName];

		// create the item if it doesn't yet exist
		if(item._id == null) {
			res = await this.exec(this._restify.stmtInsertInto({
				table: collectionName,
				columns: [],
				values: [[]]
			}));
			itemIds._id = res.insertId;
			itemIds.created = true;
		} else {
			itemIds._id = item._id;
		}

		// update fields
		let itemFields = this.filterFields(item, (fieldName) => collection[fieldName].relation == null);
		if(Object.keys(itemFields).length !== 0) {
			res = await this.exec(this._restify.stmtUpdateSet({
				table: collectionName,
				set: itemFields,
				where: {_id: itemIds._id}
			}));
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
					res = await createOrUpdate(field.type, child);
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
					let childClazz = classOf(child);
					if(childClazz === 'object') {
						res = await createOrUpdate(field.type, child);
						itemIds[fieldName].push(res);
					} else if(childClazz === 'number') {
						itemIds[fieldName].push({_id: child});
					} else {
						throw new Error(`Expecting array of object or number for OneToMany relation, but got ${childClazz}.`);
					}
				}

				if(field.relation === OneToMany) {
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