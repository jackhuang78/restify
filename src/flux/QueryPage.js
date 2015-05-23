var React = require('react');

var TableSelectItem = React.createClass({
	render: function() {
		return (
			<option>abc</option>
		);
	}
});

var TableSelect = React.createClass({
	render: function() {
		return (
			<select>
				<TableSelectItem />
			</select>
		);
	}
});

var QueryPage = React.createClass({
	render: function() {
		return (
			<div>
				<h1>QueryPage</h1>
				<TableSelect />
			</div>
			
		);
	}	
});

module.exports = QueryPage;
