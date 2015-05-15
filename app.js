// load libraries
var express = require('express'),
	util = require('util'),
	request = require('request'),
	bodyParser = require('body-parser');

var dao = require('./dao.js');

// setup server
var app = express();
app.use(bodyParser.urlencoded({extended:true}))
app.use(bodyParser.json());

app.get('/', function(req, res) {
	res.status(200).send('OK');
});

app.post('/echo', function(req, res) {
	console.log(req.body);
	res.status(200).send(req.body);
});


app.post('/:table', function(req, res) {
	
	dao.create(req.params.table, req.body, function(err, obj) {
		if(err) {
			switch(err.name) {
				case 'TableNotFoundError':
					res.status(404).send(util.format('Table %s doesn\'t exist.', err.message));
					break;
				case 'SequelizeValidationError':
					res.status(400).send(util.format('Constrain violation: %s.', err.message));
					break;
				case 'SequelizeDatabaseError':
					res.status(400).send(util.format('Invalid value: %s.', err.message));
				default:
					res.status(500).send(util.format('Unexpected error %s: %s.\n%s', err.name, err.message, err.stack));
			}
			
		} else {
			res.status(201).json(obj);
		}
	});
});

// run server
app.listen(9000);