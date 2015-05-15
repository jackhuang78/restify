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

var handleError = function(err, res) {
	switch(err.name) {
		case 'CollectionNotFoundError':
			res.status(404).send(util.format('Collection %s doesn\'t exist.', err.message));
			break;
		case 'ItemNotFoundError':
			res.status(404).send(util.format('Item %s doesn\'t exist.', err.message));
			break;
		case 'SequelizeValidationError':
			res.status(400).send(util.format('Constrain violation: %s.', err.message));
			break;
		case 'SequelizeDatabaseError':
			res.status(400).send(util.format('Invalid value: %s.', err.message));
			break;
		default:
			res.status(500).send(util.format('Unexpected error %s: %s.\n%s', err.name, err.message, err.stack));
	}
}

app.post('/:collection', function(req, res) {
	dao.create(req.params.collection, req.body, function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(201).json(obj);
		}
	});
});

app.get('/:collection/:id?', function(req, res) {
	req.params.id = req.params.id || '_all';

	dao.read(req.params.collection, req.params.id, req.query.q, function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(200).json(obj);
		}
	})


	//console.log(req.params.collection, req.params.id);

	//res.status(200).send('ok');
});

// run server
app.listen(9000);