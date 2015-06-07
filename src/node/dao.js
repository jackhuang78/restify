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
var db = require('../../conf/database.json');
var schema= require('../../conf/schema.json');

log.info('Database %j', db, {});
var sequelize = new Sequelize(db.database, db.user, db.password, {
	host: db.host,
	dialect: db.dialect
});
console.log(schema);

function toSequelizeType(type) {
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
}

var model = {};
for(var table in schema) {
	for(var field in schema[table]) {
		
		log.info('Creating %s.%s: %j', table, field, schema[table][field], {});
		schema[table][field].typeName = schema[table][field].type;
		schema[table][field].type = toSequelizeType(schema[table][field].type);
		
		
	}
	model[table] = sequelize.define(table, schema[table]);
}


sequelize.sync({force: true}).then(function() {
	console.log("DONE!");
	model.student.create({
		name: 'Jack Huang',
		gpa: 3.9,
		credits: 40,
		dateOfBirth: new Date('1989-12-17'),
		selfDescription: 'blablabla',
		graduated: true,
		gender: 'male',
		email: 'jack.huang78@gmail.com'
	});

	model.student.create({
		name: 'Jeff Huang',
		gpa: 3.5,
		credits: 45,
		dateOfBirth: new Date('1991-09-13'),
		selfDescription: 'hahaha',
		graduated: true,
		gender: 'male',
		email: 'ymh223@nyu.edu'
	});

	model.major.create({
		name: 'Electrical Engineering',
		department: "Engineering"
	});
});


var error = function(name, message) {
	var err = new Error(message);
	err.name = name;
	return err;
};

var convert = function(type, value) {
	console.log('convert', type, value);

	if(value === null) {
		return null;
	}

	try {
		switch(type) {
			case 'string':
			case 'text':
			case 'enum':
				return value;

			case 'date':
				value = isNaN(value) ? value : parseInt(value);
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

	} catch(err) {
		return err;
	}

};

var parseSelectWhere = function(collection, selectWhere, cb) {
	var where = {};
	var select = {id: null};
	var err = null;
	if(selectWhere) {
		//console.log('selectWhere: ', selectWhere);
		selectWhere.split(',').map(function(condition) {
			
			console.log('cond', condition);

			var operators = ['==', '!=', '~~', '!~', '>>', '!>', '<<', '!<', '>=', '<=', '<>', '><','{}'];			
			var operator = null;
			var elems = [condition];
			for(var i in operators) {
				operator = operators[i];
				if(condition.indexOf(operator) >= 0) {
					elems = condition.split(operator);
					break;
				}
			}

			var field = elems[0];
			if(field === '*') {
				for(var f in schema[collection]) {
					select[f] = null;
				}
				return;

			} else if(!schema[collection][field]) {
				err = error('FieldNotFoundError', util.format('%s.%s', collection, field));
				return;
			}

			select[field] = null;
			if(elems[1] === undefined) {
				return;
			}


			var type = schema[collection][field].typeName;
			var values = elems[1].split('|').map(function(value) {
				var convertedValue = convert(type, value);
				if(convertedValue instanceof Error) {
					err = error('ConversionError', util.format('%s.%s<%s>=%s', collection, field, type, value));
					return null;
				} else {
					return convertedValue;
				}
				
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
		});
	}

	//console.log('select: ', select);
	//console.log('where: ', where);
	//console.log('err:', err);

	cb(err, select, where);
};


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
};


module.exports.read = function(collection, id, selectWhere, cb) {
	id = id || '_all';
	selectWhere = selectWhere || '*';

	if(!model[collection]) {
		cb(error('CollectionNotFoundError', collection));

	} else if(id === '_all') {
		parseSelectWhere(collection, selectWhere, function(err, select, where) {
			if(err) {
				cb(err);
			} else {
				model[collection].findAll({attributes: Object.keys(select), where: where}).then(function(items) {
					cb(null, items);

				}, function(err){
					cb(error(err.name, err.message));
				});
			}
		});

	} else {
		model[collection].findOne({where:{id: id}}).then(function(item) {
			if(!item) {
				cb(error('ItemNotFoundError', util.format('%s[%d]', collection, id)));
			} else {
				cb(null, item);
			}

		}, function(err){
			cb(err);
		});
	}
};

module.exports.update = function(collection, id, updateItem, cb) {
	if(!model[collection]) {
		cb(error('CollectionNotFoundError', collection));
	} else {
		model[collection].findOne({where:{id: id}}).then(function(item) {
			if(!item) {
				cb(error('ItemNotFoundError', util.format('%s[%d]', collection, id)));
			} else {
				for(var field in updateItem) {
					item[field] = updateItem[field];
				}
				item.save().then(function(item){
					cb(null, {id: item.id});
				}, function(err){
					cb(err);
				});
			}

		}, function(err) {
			cb(err);
		});
	}
};

module.exports.delete = function(collection, id, selectWhere, cb) {
	id = id || '_all';
	selectWhere = selectWhere || '*';


	if(!model[collection]) {
		cb(error('CollectionNotFoundError', collection));

	} else if(id === '_all') {
		parseSelectWhere(collection, selectWhere, function(err, select, where) {
			if(err) {
				cb(err);
			} else {
				model[collection].findAll({attributes: ['id'], where: where}).then(function(items) {
					model[collection].destroy({where: where}).then(function(affected) {
						cb(null, items);
					}, function(err){
						cb(err);
					});
				}, function(err){
					cb(err);
				});
			}
		});
	} else {
		model[collection].findOne({attributes: ['id'], where: {id: id}}).then(function(item) {
			if(!item) {
				cb(error('ItemNotFoundError', util.format('%s[%d]', collection, id)));
			} else {
				item.destroy().then(function() {
					cb(null, item);
				}, function(err) {
					cb(err);
				});
			}
		});
	}
};

module.exports._collections = function(cb) {
	var collections = Object.keys(model);
	cb(null, collections);
};

module.exports._fields = function(collection, cb) {
	if(!model[collection]) {
		cb(error('CollectionNotFoundError', collection));
		return;
	}

	var fields = {id: {type: 'integer'}};
	for(var key in schema[collection]) {
		fields[key] = {
			type: schema[collection][key].typeName
		};
	}

	
	cb(null, fields);
};



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