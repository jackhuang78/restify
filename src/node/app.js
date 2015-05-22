// load libraries
var express = require('express'),
	util = require('util'),
	request = require('request'),
	bodyParser = require('body-parser'),
	ejs = require('ejs');

var dao = require('./dao.js');

// setup server
var app = express();
app.use(express.static('node_modules'));
app.use(express.static('build'));
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());
app.set('views', 'src/flux');
app.set('view engine', 'ejs');


app.get('/', function(req, res) {
	res.render('main', {react: 'IndexPage'});
});

app.get('/admin', function(req, res) {
	res.render('main', {react: 'AdminPage'});
});

app.post('/echo', function(req, res) {
	console.log(req.body);
	res.status(200).send(req.body);
});


app.get('/_collections', function(req, res) {
	dao._collections(function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(200).json(obj);
		}
	});
});


app.post('/:collection', function(req, res) {
	dao.create(req.params.collection, req.body, function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(200).json(obj);
		}
	});
});

app.get('/:collection/:id?', function(req, res) {
	dao.read(req.params.collection, req.params.id, req.query.sw, function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(200).json(obj);
		}
	});
});

app.put('/:collection/:id', function(req, res) {
	dao.update(req.params.collection, req.params.id, req.body, function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(200).json(obj);
		}
	});
});

app.delete('/:collection/:id', function(req, res) {
	dao.delete(req.params.collection, req.params.id, req.query.sw, function(err, obj) {
		if(err) {
			handleError(err, res);
		} else {
			res.status(200).json(obj);
		}
	});
});



var handleError = function(err, res) {
	switch(err.name) {
		case 'CollectionNotFoundError':
			res.status(404).type('text/plain').send(util.format('Collection %s doesn\'t exist.', err.message));
			break;
		case 'FieldNotFoundError':
			res.status(404).type('text/plain').send(util.format('Field %s doesn\'t exist.', err.message));
			break;
		case 'ItemNotFoundError':
			res.status(404).type('text/plain').send(util.format('Item %s doesn\'t exist.', err.message));
			break;
		case 'ConversionError':
			res.status(400).type('text/plain').send(util.format('Invalid value: %s', err.message));
			break;
		case 'SequelizeValidationError':
			res.status(400).type('text/plain').send(util.format('Constrain violation: %s.', err.message));
			break;
		case 'SequelizeDatabaseError':
			res.status(400).type('text/plain').send(util.format('Invalid value: %s.', err.message));
			break;
		default:
			res.status(500).type('text/plain').send(util.format('Unexpected error %s: %s.\n%s', err.name, err.message, err.stack));
	}
};

// run server
app.listen(9000);