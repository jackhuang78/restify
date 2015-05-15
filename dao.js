// load libaries
var Sequelize = require('sequelize');
var winston = require('winston');

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
		schema[table][field].type = (function(type) {
			switch(type) {
				case 'string': 	return Sequelize.STRING;
				case 'text': 	return Sequelize.TEXT;

				case 'int': 	return Sequelize.INTEGER;
				case 'bigint': 	return Sequelize.BIGINT;
				case 'float': 	return Sequelize.FLOAT;
				case 'decimal': return Sequelize.DECIMAL;
				
				case 'date': 	return Sequelize.DATE;
				case 'boolean': return Sequelize.BOOLEAN;

				case 'enum': 	return Sequelize.ENUM;

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
		age: 23
	});
});


var error = function(name, message) {
	var err = new Error(message);
	err.name = name;
	return err;
}

module.exports.create = function(table, obj, cb) {

	if(!model[table]) {
		cb(error('TableNotFoundError', table));

	} else {
		model[table].create(obj).then(function(obj) {
			cb(null, {id: obj.id});

		}, function(err) {
			console.log(err);
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