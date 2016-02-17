import Sequelize from 'sequelize';
import SqlString from 'sequelize/lib/sql-string';
import logger from './Logger';



class Sql {
	constructor(database, username, password, dialect) {
		this.sequelize = new Sequelize(database, username, password, {
			dialect: dialect
		});
	}

	async exec(stmt) {
		let res = await this.sequelize.query(stmt, {type: Sequelize.QueryTypes.SELECT});
		return res;
	}

	async insert(table, columns, values) {
		//console.log(escape(values));
		let res = await this.sequelize.query(`INSERT INTO ${table} `)
		return;
	}
}

function escape(val) {
	return SqlString.escape(val);
}

export default Sql;