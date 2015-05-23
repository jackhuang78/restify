// require modules
var React = require('react');
var $ = require('jquery');
global.jQuery = $;
var bootstrap = require('bootstrap');

// require React components
var components = {};
components.QueryPage = require('./QueryPage');


// render React components
var Component = components[$('#content').attr('react')];
React.render(
	<Component />, content
);


console.log('URL: ', $(location).attr('href'));
