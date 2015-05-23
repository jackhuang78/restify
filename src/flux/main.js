// require modules
var React = require('react');
var $ = require('jquery');
global.jQuery = $;
var bootstrap = require('bootstrap');

// require and register React modules
var QueryPage = require('./QueryPage');
var components = {
	QueryPage: QueryPage
};

// render React module
var Component = components[$('#content').attr('react')];
React.render(
	<Component />, content
);


console.log('URL: ', $(location).attr('href'));
