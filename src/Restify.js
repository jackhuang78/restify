import mysql from 'mysql';

const ONE_TO_ONE = 'oneToOne';
const ONE_TO_MANY = 'oneToMany';
const MANY_TO_ONE = 'manyToOne';
const MANY_TO_MANY = 'manyToMany';

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

		this.conn = mysql.createConnection({
			host: this.database.host,
			user: this.database.user,
			password: this.database.pass,
			database: this.database.db
		});



		// start parsing table information
		this.types = {};
		for(let typeName in config.schema) {
			let type = {};

			for(let fieldName in config.schema[typeName]) {
				let fieldConfig = config.schema[typeName][fieldName];

				let field = {
					type: fieldConfig.type,
					nullable: fieldConfig.nullable ? true : false,
					relation: fieldConfig.relation,
					mappedBy: fieldConfig.mappedBy,
					master: fieldConfig.relation != null
				};

				type[fieldName] = field;
			}
			this.types[typeName] = type;
		}

		// create mappedBy fields
		for(let typeName in this.types) {
			for(let fieldName in this.types[typeName]) {
				let field = this.types[typeName][fieldName];
				if(field.master) {
					this.types[field.type][field.mappedBy] = {
						type: typeName,
						nullable: false,
						relation: invRelation(field.relation),
						mappedBy: fieldName,
						master: false
					};
				}
			}
		}
		//console.log(this.types);
		//console.log(Object.keys(this.types));
	}

	collections() {
		return Object.keys(this.types);
	}

	fields(type) {
		return Object.keys(this.types[type]);
	}
}

function invRelation(relation) {
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

export default Restify;