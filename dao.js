// load libaries
var Sequelize = require('sequelize');
var winston = require('winston');
var util = require('util');

var log = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)()
      //, new (winston.transports.File)({ filename: 'somefile.log' })
    ]
 });





// load database configurations
var db = require('./database.json');
var schema= require('./schema.json');

log.info('Database %j', db, {});
var sequelize = new Sequelize(db.database, db.user, db.password, {
	host: db.host,
	dialect: db.dialect
});
console.log(schema);

var model = {};
for(var table in schema) {
	for(var field in schema[table]) {
		
		log.info('Creating %s.%s: %j', table, field, schema[table][field], {});
		schema[table][field].typeName = schema[table][field].type;
		schema[table][field].type = (function(type) {
			switch(type) {
				case 'string': 	return Sequelize.STRING;
				case 'text': 	return Sequelize.TEXT;
				case 'date': 	return Sequelize.DATE;
				case 'enum': 	return Sequelize.ENUM;

				case 'integer': return Sequelize.INTEGER;
				case 'bigint': 	return Sequelize.BIGINT;
				case 'float': 	return Sequelize.FLOAT;
				case 'decimal': return Sequelize.DECIMAL;
				
				case 'boolean': return Sequelize.BOOLEAN;

				default: 		return Sequelize.STRING;
			}
		})(schema[table][field].type);
		
		
		
	}
	model[table] = sequelize.define(table, schema[table]);
}


sequelize.sync({force: true}).then(function() {
	console.log("DONE!");
	model['student'].create({
		name: 'Jack Huang',
		gpa: 3.9,
		credits: 40,
		dateOfBirth: '1989-12-17'
	});
});


var error = function(name, message) {
	var err = new Error(message);
	err.name = name;
	return err;
}

var convert = function(type, value) {
	console.log('convert', type, value);

	if(value === null || value === undefined)
		return null;

	switch(type) {
		case 'string':
		case 'text':
		case 'enum':
			return value;

		case 'date':
			return new Date(value).toISOString();

		case 'integer':
		case 'bigint':
			return parseInt(value);

		case 'decimal':
		case 'float':
			return parseFloat(value);

		case 'boolean':
			return (value.toLowerCase() === 'true');

		default:
			return value;
	}


}

var parseWhere = function(collection, q) {
	var where = {};
	if(q) {
		console.log('q: ', q);
		q.split(',').map(function(condition) {
			
			console.log('cond', condition);

			var operators = ['==', '!=', '~~', '!~', '>>', '!>', '<<', '!<', '>=', '<=', '<>', '><','{}'];			
			var operator = null;
			var elems = null;
			for(var i in operators) {
				operator = operators[i];
				if(condition.indexOf(operator) >= 0) {
					elems = condition.split(operator);
					break;
				}
			}

			var field = elems ? elems[0] : null;
			var type = (field && schema[collection][field]) ? schema[collection][field].typeName : null;

			if(type) {
				console.log('elems[1]', elems[1]);
				var values = elems[1].split('|').map(function(value) {
					return convert(type, value);
				});

				switch(operator) {
					case '==': where[field] = values[0]; break;
					case '!=': where[field] = {ne: values[0]};	break;
					case '~~': where[field] = {like: '%' + values[0] + '%'}; break;
					case '!~': where[field] = {notlike: '%' + values[0] + '%'}; break;
					case '>>': where[field] = {gt: values[0]}; break;
					case '!>': 	
					case '<=': where[field] = {lte: values[0]}; break;
					case '<<': where[field] = {lt: values[0]};	break;
					case '!<': 
					case '>=': where[field] = {gte: values[0]}; break;
					case '<>': where[field] = {between: [values[0], values[1]]}; break;
					case '><': where[field] = {notbetween: [values[0], values[1]]}; break;
					case '{}': where[field] = {in: values}; break;
					default  : where[field] = values[0];
				}	
			}
		});
	}
	console.log('where: ', where);
	return where;
}


module.exports.create = function(collection, item, cb) {
	if(!model[collection]) {
		cb(error('CollectionNotFoundError', collection));

	} else {
		model[collection].create(item).then(function(item) {
			cb(null, {id: item.id});

		}, function(err) {
			cb(error(err.name, err.message));
		});
	}
}

// q=[name=abc,name~def]
module.exports.read = function(collection, id, q, cb) {
	if(!model[collection]) {
		cb(error('CollectionNotFoundError', collection));

	} else if(id === '_all') {



		//console.log('where: ', parseWhere(collection, q));

		model[collection].findAll({where: parseWhere(collection, q)}).then(function(items) {
			cb(null, items);

		}, function(err){
			cb(error(err.name, err.message));
		});

	} else {
		model[collection].findOne({where:{id: id}}).then(function(item) {
			if(!item) {
				console.log(item);
				cb(error('ItemNotFoundError', util.format('%s[%d]', collection, id)));
			} else {
				cb(null, item);
			}

		}, function(err){
			cb(error(err.name, err.message));
		});
	}
}



/*var User = sequelize.define('User', {
  username: Sequelize.STRING,
  birthday: Sequelize.DATE
});

return sequelize.sync().then(function() {
  return User.create({
    username: 'janedoe',
    birthday: new Date(1980, 6, 20)
  });
}).then(function(jane) {
  console.log(jane.get({
    plain: true
  }))
});*/