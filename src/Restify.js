import {expect} from 'chai';
import util from 'util';
import Connection from './Connection';
import Logger from './Logger';

let logger = Logger.get('Restify');

class Restify {
	constructor(config) {
		expect(config).to.contain.all.keys(['host', 'user', 'password', 'database']);
		this.config = Object.assign(config);
	}

	_connect() {
		return new Connection(
				this.config.host, 
				this.config.user, 
				this.config.password, 
				this.config.database
		);
	}

	async sync() {
		let res;
		let conn = this._connect();
		let schema = {};

		res = await conn.exec('USE information_schema;');
 		res = await conn.exec(`SELECT * FROM columns WHERE table_schema='${this.config.database}'`);
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
 						referenced: true,
 						referencedToColumn: column.referencedColumn,
 						referencedByTable: tableName,
 						referencedByColumn: columnName,
 						hasMany: !column.unique
 					};
 				}
 			}
 		}

		res = await conn.end();

		this._schema = schema;
	}

	schema() {
		return this._schema;
	}

	_type(val) {
		if(val === undefined)
			return 'undefined';
		else if(val === null)
			return 'null';
		else if(val instanceof Array)
			return 'array';
		else if(val instanceof Object)
			return 'object';
		else 
			return typeof(val);


	}

	_buildConditions(query) {
		let cond = Object.keys(query)
		.filter((column) => {
			let type = this._type(query[column]);
			return (type !== 'undefined') && (type !== 'object');
		})	
		.map((column) => {
			if(query[column] instanceof Array) {
				return [column, query[column][0], query[column][1]];
			} else if(query[column] instanceof Object) {

			} else {
				return query[column] === null 
						? [column, 'is', null] 
						: [column, '=', query[column]];
			}	
		});

		if(cond.length === 0)
			return null;
		else if(cond.length === 1)
			return cond[0];
		else {
			cond.unshift('AND');
			return cond;
		}

	}

	async get(tableName, query) {
		logger.debug(`Restify> GET ${tableName} ${util.inspect(query)}`);
		let res;
		let conn = this._connect();
		let table = this._schema[tableName];

		if(table == null)
			throw new Error(`Table not found: ${tableName}`);

		let columns = [];
		let references = [];
		let backReferences = [];

		for(let column of Object.keys(query)) {
			if(table[column].alias != null) {
				references.push(table[column].alias);
				columns.push(table[column].alias);
			} else if(table[column].referenced) {
				backReferences.push(column);
				columns.push(table[column].referencedToColumn);
			} else {
				columns.push(column);
			}
		}

		res = await conn.select(tableName, columns, this._buildConditions(query));

		let items = res;

		for(let item of items) {
			for(let referenceName of references) {
				let reference = table[referenceName];
				let subquery = query[reference.alterName] == null ? {} : query[reference.alterName];
				subquery[reference.referencedColumn] = item[referenceName];
				res = await this.get(reference.referencedTable, subquery);
				item[reference.alterName] = res.length > 0 ? res[0] : null;
				delete item[referenceName];
			}

			for(let referenceName of backReferences) {
				let reference = table[referenceName];
				let subquery = query[referenceName] == null ? {} : query[referenceName];
				subquery[reference.referencedByColumn] = item[reference.referencedToColumn];
				res = await this.get(reference.referencedByTable, subquery);
				item[referenceName] = reference.hasMany ? res
						: (res.length > 0) ? res[0] : null;
			}
		}


		




		conn.end();

		return items;
	}
}

export default Restify;