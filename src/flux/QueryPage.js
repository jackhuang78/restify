var React = require('react');
var $ = require('jquery');
var util = require('util');
var url = require('url');
var Case = require('case');
var dateFormat = require('dateformat');
var MicroEvent = require('microevent');
var Dispatcher = require('./dispatcher');


//============================================
//	Store
//============================================

var alertError = function(error) {
	alert(util.format('ERROR %d %s: %s', error.status, error.statusText, error.responseText));
};

var EVENT = {
	itemsLoaded: 'itemsLoaded',
	itemLoaded: 'itemLoaded',
	fieldSelectionChanged: 'fieldSelectionChanged',
	fieldUpdated: 'fieldUpdated'
};

var ItemStore = function() {
	
	this.collection = null;
	this.items = [];
	this.fields = {};

	this.loadItems = function(collection) {
		this.collection = collection;

		$.ajax({
			url: util.format('%s/_fields', collection),
			type: 'GET'

		}).fail(function(error) {
			alertError(error);
		}).done(function(data) {
			this.fields = data;
			for(var k in this.fields) {
				this.fields[k].selected = true;
			}

			$.ajax({
				url: util.format('%s', collection),
				type: 'GET'

			}).fail(function(error) {
				alertError(error);
			}).done(function(data) {

				this.items = data;
				this.items.forEach(function(item) {
					$.each(item, function(key, value) {
						if(this.fields[key].type === 'date') {
							item[key] = new Date(Date.parse(item[key]));
						}
					}.bind(this));
				}.bind(this));


				this.trigger(EVENT.itemsLoaded);

			}.bind(this));	
		}.bind(this));

		
	};

	this.updateItemByField = function(id, field, value) {
		var body = {};
		body[field] = value;

		$.ajax({
			url: util.format('%s/%d', this.collection, id),
			type: 'PUT',
			data: body
		}).fail(function(error) {
			alertError(error);
		}).done(function(data) {
			this.loadItem(id);
		}.bind(this));
	};

	this.loadItem = function(id) {
		$.ajax({
			url: util.format('%s/%d', this.collection, id),
			type: 'GET'
		}).fail(function(error) {
			alertError(error);
		}).done(function(data) {
			for(var i in this.items) {
				if(this.items[i].id == id) {
					this.items[i] = data;
					this.trigger(EVENT.itemLoaded, id);
					return;
				}
			}
		}.bind(this));
	};

	this.updateFieldSelection = function(field, selected) {
		this.fields[field].selected = selected;
		this.trigger(EVENT.fieldSelectionChanged);
	};





	this.load = function(actionData) {
		this.collection = actionData.collection;
		$.get(actionData.collection, function(items, status) {
			if(status !== 'success') {
				alert('Failed to load tables');
			} else {
				this.fields = actionData.fields;

				items.forEach(function(item) {
					$.each(item, function(key, value) {
						if(this.fields[key].type === 'date') {
							item[key] = new Date(Date.parse(item[key]));
						}
					}.bind(this));
				}.bind(this));

				this.items = items;
				
				this.trigger('changed');
			}
		}.bind(this));		
	};

	this.selectionChanged = function(actionData) {
		this.fields[actionData.field].selected = actionData.selected;
		this.trigger('selectionChanged');
	};

	this.updateSingleField = function(actionData) {
		var updateItem = {};
		updateItem[actionData.field] = actionData.value;
		$.ajax({
			url: this.collection + '/' + actionData.id,
			type: 'PUT',
			data: updateItem,
		}).done(function(data, status) {
			console.log('done', status, data);
			this.trigger('fieldUpdated', null);
		}.bind(this)).fail(function(jqxhr, status, err) {
			console.log('fail', status, err);
			this.trigger('fieldUpdated', err);
		}.bind(this));
	};
};
MicroEvent.mixin(ItemStore);
var itemStore = new ItemStore();


//============================================
//	Actions
//============================================
var ACTION = {
	loadItems: 'loadItems',
	updateItemByField: 'updateItemByField',
	updateFieldSelection: 'updateFieldSelection'
};
var dispatcher = new Dispatcher();
dispatcher.register(function(action) {
	console.log('Dispatch action', action.name, action.data);

	switch(action.name) {
		case ACTION.loadItems:
			itemStore.loadItems(action.data.collection);
			break;

		case ACTION.updateItemByField:
			itemStore.updateItemByField(action.data.id, action.data.field, action.data.value);
			break;

		case ACTION.updateFieldSelection:
			itemStore.updateFieldSelection(action.data.field, action.data.selected);
			break;

		case 'selectionChanged':
			itemStore.selectionChanged(action.data);
			break;

		case 'updateSingleField':
			itemStore.updateSingleField(action.data);
			break;

		default:
			alert('Unknown action', action);
	}
});


//============================================
//	Views
//============================================

var App = React.createClass({
	render: function() {
		return (
			<div>
				<h1>Query Page</h1>
				<div className='row'>
					<div className='col-md-2'>
						<QueryControl collections={this.state.collections}
							fields={this.state.fields} />
					</div>
					<div className='col-md-8'>
						<ItemTable fields={this.state.fields} items={this.state.items} />
					</div>
				</div>
			</div>
		);
	},

	getInitialState: function() {
		return {
			collections: ['COLLECTION1', 'COLLECTION2'],
			fields: {'FIELD1': {selected: true}, 'FIELD2': {selected: false}},
			items: []
		};
	},

	componentDidMount: function() {
		console.log('App mounted');

		itemStore.bind('itemsLoaded', this.itemsLoaded);

		$.ajax({
			url: url.format({pathname: '_collections'})
		}).fail(function(error) {
			alertError(error);
		}).done(function(data) {
			this.setState({collections: data});
			dispatcher.dispatch({
				name: ACTION.loadItems,
				data: {
					collection: data[0]
				}
			});
		}.bind(this));
	},

	componentDidUnmount: function() {
		itemStore.unbind('itemsLoaded', this.itemsLoaded);
	},

	itemsLoaded: function() {
		console.log('Detect event itemsLoaded');
		this.setState({
			fields: itemStore.fields,
			items: itemStore.items
		});
	}



});

var QueryControl = React.createClass({
	render: function() {
		return (
			<div>
				<CollectionSelect collections={this.props.collections} />
				<FieldSelect fields={this.props.fields} />
			</div>
		);
	}
});

var CollectionSelect = React.createClass({
	render: function() {
		return (
			<select className='form-control' onChange={this.onChange}> {
				this.props.collections.map(function(collection, idx) { 
					return <CollectionSelectOption collection={collection} />;
				})
			} </select>
		);
	},

	onChange: function(event) {
		dispatcher.dispatch({
			name: ACTION.loadItems,
			data: {
				collection: event.target.value
			}
		});
	}
});

var CollectionSelectOption = React.createClass({
	render: function() {
		return <option>{this.props.collection}</option>;
	}
});

var FieldSelect = React.createClass({
	render: function() {
		return (
			<div> {
				$.map(this.props.fields, function(fieldProps, fieldName) {
					return <FieldSelectOption value={fieldName} selected={fieldProps.selected} />;
				})
			} </div>
		);
	}
});

var FieldSelectOption = React.createClass({
	render: function() {
		return (
			<div className='checkbox'>
				<label>
					<input type='checkbox' key={Date.now()} defaultChecked={this.props.selected} onChange={this.onChange} /> 
					{this.props.value}
				</label>
			</div>
		);
	},

	onChange: function(event) {
		dispatcher.dispatch({
			name: ACTION.updateFieldSelection,
			data: {
				field: this.props.value,
				selected: event.target.checked
			}
		});
	}
});

var ItemTable = React.createClass({
	render: function() {
		console.log('render items', this.props.items);
		
		return (
			<table className='table table-hover table-striped table-condensed'>
				<thead>
					<ItemTableHeader key={Date.now()} fields={this.props.fields} />
				</thead>
				<tbody> {
					this.props.items.map(function(item, idx) {
						return <ItemTableRow key={idx} data-abc={idx} item={item} />;
					})
				} </tbody>
			</table>
		);	
	}
	
});

var ItemTableHeader = React.createClass({
	render: function() {
		return (
			<tr> { 
				$.map(this.props.fields, function(value, key) {
					return <th>{Case.title(key)}</th>;
				})
			} </tr>
		);
	}
});

var ItemTableRow = React.createClass({
	render: function() {
		function changed(event) {
			alert('Content changed');
		}
		function format(value) {
			console.log('format', value, 'to', value.toString());
			if(value instanceof Date)
				return dateFormat(value, 'yyyy/mm/dd');
			else
				return value.toString();
		}

		console.log('render item', this.props.item);
		console.log('dataset', this.props.dataset);
		return (
			<tr> {
				$.map(this.props.item, function(value, key) {
					return (
						<td> 
							{format(value)} 
						</td>);
				})
			} </tr>
		);
	
	}
});





module.exports = App;
