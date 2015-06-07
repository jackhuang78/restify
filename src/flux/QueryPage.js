var React = require('react');
var $ = require('jquery');
var util = require('util');
var Case = require('case');
var dateFormat = require('dateformat');
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
				this.fields = actionData.fields;

				console.log('items', items);

				items.forEach(function(item) {
					console.log('item', item);
					$.each(item, function(key, value) {
						if(this.fields[key].type === 'date') {
							item[key] = new Date(Date.parse(item[key]));
						}
					}.bind(this));
				}.bind(this));


				console.log('loaded items', items);

				this.items = items;
				
				this.trigger('changed');
			}
		}.bind(this));		
	};

	this.selectionChanged = function(actionData) {
		console.log('selectionChanged', actionData.field, actionData.selected);
		this.fields[actionData.field].selected = actionData.selected;
		this.trigger('selectionChanged');
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

		case 'selectionChanged':
			itemStore.selectionChanged(action.data);
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

			$.each(fields, function(key, value) {
				value.selected = true;
			});

			this.setState({
				fields: fields,
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
							<FieldSelectItem value={fieldName} selected={fieldValues.selected}/>
						);
					}.bind(this))
				}
			</div>
		);
	}
});

var FieldSelectItem = React.createClass({
	onChange: function(event) {
		console.log('changed', event.target.checked);
		dispatcher.dispatch({
			name: 'selectionChanged',
			data: {
				field: this.props.value,
				selected: event.target.checked
			}
		});
	},
	render: function() {
		return (
			<div className="checkbox" >
				<label>
					<input type="checkbox" key={Date.now()} defaultChecked={this.props.selected} onChange={this.onChange}/> {this.props.value}
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

	itemsStoreChanged: function() {
		console.log('table store changed');
		console.log('items', itemStore.items);
		this.setState({fields: itemStore.fields, items: itemStore.items});
	},

	componentDidMount: function() {
		console.log('itemStoreChanged', this.itemsStoreChanged);
		itemStore.bind('changed', this.itemsStoreChanged);
		itemStore.bind('selectionChanged', this.itemsStoreChanged);
	},

	componentDidUnmount: function() {
		console.log('unbind component');
		itemStore.unbind('changed', this.itemsStoreChanged);
		itemStore.unbind('selectionChanged', this.itemsStoreChanged);
	},


	render: function() {
		var filteredFields = {};
		$.each(this.state.fields, function(key, value) {
			if(value.selected)
				filteredFields[key] = value;
		}.bind(this));


		var filteredItems = this.state.items.map(function(item) {
			var filteredItem = {};
			$.each(item, function(key, value) {
				if(filteredFields[key]) {
					filteredItem[key] = value;
					
				}

			}.bind(this));	
			return filteredItem;		
		}.bind(this));

		console.log('filteredItems', filteredItems);

		return (
			<table className="table table-hover table-striped table-condensed">
				<thead>
					<TableDisplayHeader fields={filteredFields} />
				</thead>

				<tbody>
					{
						filteredItems.map(function(item) {
							return (
								<TableDisplayRow item={item} />
							);
						})
					}
				</tbody>

			</table>
		);
	}
});

var TableDisplayHeader = React.createClass({
	render: function() {
		return (
			<tr> 
				{ 
					$.map(this.props.fields, function(value, key) {
						return (
							<th>{Case.title(key)}</th>
						);
					})
				} 
			</tr>
		);
	}
});

var TableDisplayRow = React.createClass({

	render: function() {
		return (
			<tr>
				{
					$.map(this.props.item, function(value, key) {
						console.log('value is date', value instanceof Date);
						return (
							<td>{ value instanceof Date 
								? dateFormat(value, 'yyyy/mm/dd')
								: value.toString()
							}</td>
						);
					}.bind(this))
				}
			</tr>
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
					<div className='col-md-9'>
						<TableDisplay />
					</div>
				</div>
			</div>

		);
	}	
});



module.exports = QueryPage;
