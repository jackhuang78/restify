var React = require('react');
var $ = require('jquery');
var util = require('util');
var MicroEvent = require('microevent');
var Dispatcher = require('./dispatcher');


//============================================
//	Store
//============================================
var ItemStore = function() {
	this.items = [];
	this.fields = {};

	this.load = function(actionData) {
		console.log('load data', actionData);
		$.get(actionData.collection, function(items, status) {
			if(status !== 'success') {
				alert('Failed to load tables');
			} else {
				this.items = items;
				this.fields = actionData.fields;
				this.trigger('changed');
			}
		}.bind(this));		
	};
};
MicroEvent.mixin(ItemStore);
var itemStore = new ItemStore();


//============================================
//	Actions
//============================================
var dispatcher = new Dispatcher();
dispatcher.register(function(action) {
	console.log('Action', action);
	switch(action.name) {
		case 'loadItems':
			itemStore.load(action.data);
			break;

		default:
			alert('Unknown action', action);
	}
});





itemStore.bind('changed', function() {
	console.log('table store changed');
	console.log('items', itemStore.items);
});




//============================================
//	Views
//============================================
var TableSelectItem = React.createClass({
	render: function() {
		return (
			<option>
				{this.props.collection}
			</option>
		);
	}
});

var TableSelect = React.createClass({

	getInitialState: function() {
		console.log('getInitialState');
		return {collections: [], fields: []};
	},

	selectionChanged: function(event) {
		
		console.log('event', event.target.value);

		

		var collection = event.target.value; //collections[0];
		$.get(collection + '/_fields', function(fields, status) {
			if(status !== 'success') {
				alert('Failed to load fields for ' + collection);
				return;
			}

			console.log('fields', fields);
			this.setState({
				fields: fields,
				initialChecked: true
			});

			dispatcher.dispatch({
				name: 'loadItems',
				data: {
					collection: collection,
					fields: fields
				}
			});

		}.bind(this));


		/*console.log('mounted', $('#collectionSelect'));
		dispatcher.dispatch({
			name: 'selectCollection',
			data: event.target.value
		});*/
		//console.log('this', event.target.value);
	},

	componentDidMount: function() {
		console.log('componentDidMount');

		$.get('_collections', function(collections, status) {
			console.log('fetched collections');
			
			if(status !== 'success') {
				alert('Failed to load tables');
				return;
			} 

			this.state.collections = collections;
			this.selectionChanged({target: {value: 'student'}});

		}.bind(this));

		
		
	},

	

	render: function() {
		
		console.log('render with', this.state.collections);
		return (
			<div>
				<select id='collectionSelect' className='form-control' onChange={this.selectionChanged} >
					{
						this.state.collections.map(function(collection, idx) { 
							return (
								<TableSelectItem collection={collection} /> 
							);		
						})
					}
				</select>
				<FieldSelect fields={this.state.fields} />
			</div>
		);
	}

});

var FieldSelect = React.createClass({
	render: function() {
		
		return (
			<div>
				{
					$.map(this.props.fields, function(fieldValues, fieldName) {
						return (
							<FieldSelectItem value={fieldName} />
						);
					}.bind(this))
				}
			</div>
		);
	}
});

var FieldSelectItem = React.createClass({
	render: function() {
		return (
			<div className="checkbox" >
				<label>
					<input type="checkbox" key={Date.now()} defaultChecked /> {this.props.value}
				</label>
			</div>
		);
	}
});


var TableDisplay = React.createClass({

	getInitialState: function() {
		return {
			fields: {},
			items: []
		};
	},

	componentDidMount: function() {
		itemStore.bind('changed', function() {
			console.log('table store changed');
			console.log('items', itemStore.items);
			this.setState({fields: itemStore.fields, items: itemStore.items});
		}.bind(this));
	},

	render: function() {
		return (

			<table className="table table-hover">
				<tr>
					{
						$.map(this.state.fields, function(fieldValues, fieldName) {
							console.log('header', fieldName);
							return (
								<th>{fieldName}</th>
							);
						}.bind(this))
					}
				</tr>

				

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
	
	

	onClick: function(e) {
		alert('Clicked ' + e.target.innerText);
	},

	render: function() {

		return (
			<div>
				<h1>QueryPage</h1>
				<div className='row'>
					<div className='col-md-2'>
						<TableSelect />
					</div>
					<div className='col-md-8'>
						<TableDisplay />
					</div>
				</div>
			</div>

		);
	}	
});



module.exports = QueryPage;
