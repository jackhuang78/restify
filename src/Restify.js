import {expect} from 'chai';
import Connection from './Connection';
import logger from './Logger';

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
}

export default Restify;