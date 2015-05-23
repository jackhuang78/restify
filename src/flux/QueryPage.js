var React = require('react');
var $ = require('jquery');

var TableSelectItem = React.createClass({
	render: function() {
		return (
			<option>{this.props.item}</option>
		);
	}
});

var TableSelect = React.createClass({
	render: function() {
		return (
			<select>
				{
					this.props.items.map(function(item, idx) { 
						return (
							<TableSelectItem item={item} /> 
						);	
					})
				}
			</select>
		);
	}
});

var QueryPage = React.createClass({
	getInitialState: function() {
		return {items: []};
	},
	componentDidMount: function() {
		$.get('_collections', function(items, status) {
			if(status !== 'success') {
				alert('Failed to load tables');
			} else {
				this.setState({items: items});
			}
		}.bind(this));
	},
	render: function() {
		return (
			<div>
				<h1>QueryPage</h1>
				<TableSelect items={this.state.items} />
			</div>
			
		);
	}	
});

module.exports = QueryPage;
