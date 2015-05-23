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
		var tableItems = this.props.items.map(function(item, idx) { 
			return (
				<TableSelectItem item={item} /> 
			);		
		});

		return (
			<select className='form-control'>
				{tableItems}
			</select>
		);
	}
});

var TableDisplay = React.createClass({
	render: function() {
		return (
			<table className="table table-hover">
				<tr><th>ID</th></tr>
				<tr><td>1</td></tr>
				<tr><td>2</td></tr>
			</table>
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

				//TODO continue from here				

				this.setState({items: items});
			}
		}.bind(this));
	},

	onClick: function(e) {
		alert('Clicked ' + e.target.innerText);
	},

	render: function() {
		return (
			<div>
				<h1>QueryPage</h1>
				<div className='row'>
					<div className='col-md-2'>
						<TableSelect id=""items={this.state.items} />
					</div>
					<div className='col-md-1'>
						<button type="button" className="btn btn-primary" onClick={this.onClick}>Query</button>
					</div>
				</div>
				<TableDisplay />
			</div>

		);
	}	
});

module.exports = QueryPage;
