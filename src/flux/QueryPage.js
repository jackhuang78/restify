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

	this.parseItem = function(fields, item) {
		//console.log('fields', fields, 'item', item);
		for(var f in item) {
			//console.log('f', f);
			if(fields[f] && fields[f].type === 'date') {
				item[f] = new Date(Date.parse(item[f]));
			}
		}
	};

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
					this.parseItem(this.fields, item);
					/*$.each(item, function(key, value) {
						if(this.fields[key].type === 'date') {
							item[key] = new Date(Date.parse(item[key]));
						}
					}.bind(this));*/
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
			this.loadItem(id);
		}.bind(this)).done(function(data) {
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
			this.parseItem(this.fields, data);
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

	this.addItem = function() {
		$.ajax({
			url: util.format('%s', this.collection),
			type: 'POST',
			data: {}
		}).fail(function(error) {
			alertError(error);
		}).done(function(data) {
			this.loadItem(data.id);
		}.bind(this));
	};

	// this.updateSingleField = function(id, field, value) {
	// 	var updateItem = {};
	// 	updateItem[field] = value;
	// 	$.ajax({
	// 		url: util.format('%s/%d', this.collection, id),
	// 		type: 'PUT',
	// 		data: updateItem,
	// 	}).done(function(data, status) {
	// 		console.log('done', status, data);
	// 		this.trigger(EVENT.fieldUpdated, null);
	// 	}.bind(this)).fail(function(jqxhr, status, err) {
	// 		console.log('fail', status, err);
	// 		this.trigger(EVENT.fieldUpdated, err);
	// 	}.bind(this));
	// };





	// this.load = function(actionData) {
	// 	this.collection = actionData.collection;
	// 	$.get(actionData.collection, function(items, status) {
	// 		if(status !== 'success') {
	// 			alert('Failed to load tables');
	// 		} else {
	// 			this.fields = actionData.fields;

	// 			items.forEach(function(item) {
	// 				$.each(item, function(key, value) {
	// 					if(this.fields[key].type === 'date') {
	// 						item[key] = new Date(Date.parse(item[key]));
	// 					}
	// 				}.bind(this));
	// 			}.bind(this));

	// 			this.items = items;
				
	// 			this.trigger('changed');
	// 		}
	// 	}.bind(this));		
	// };

	// this.selectionChanged = function(actionData) {
	// 	this.fields[actionData.field].selected = actionData.selected;
	// 	this.trigger('selectionChanged');
	// };

	
};
MicroEvent.mixin(ItemStore);
var itemStore = new ItemStore();


//============================================
//	Actions
//============================================
var ACTION = {
	loadItems: 'loadItems',
	updateItemByField: 'updateItemByField',
	updateFieldSelection: 'updateFieldSelection',
	addItem: 'addItem'
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

		// case 'selectionChanged':
		// 	itemStore.selectionChanged(action.data);
		// 	break;

		case ACTION.updateSingleField:
			itemStore.updateSingleField(action.data);
			break;

		case ACTION.addItem:
			itemStore.addItem();
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
					<div className='col-md-10'>
						<div className='row'>
							<ItemTable fields={this.state.fields} items={this.state.items} />
						</div>
						<div>
							<button className='btn btn-default' type='submit' onClick={this.newItem}>New Item</button>
						</div>
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

		itemStore.bind(EVENT.itemsLoaded, this.itemsLoaded);
		itemStore.bind(EVENT.fieldSelectionChanged, this.fieldSelectionChanged);
		itemStore.bind(EVENT.itemLoaded, this.itemLoaded);

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
		itemStore.unbind(EVENT.itemsLoaded, this.itemsLoaded);
		itemStore.unbind(EVENT.fieldSelectionChanged, this.fieldSelectionChanged);
		itemStore.unbind(EVENT.itemLoaded, this.itemLoaded);
	},

	itemsLoaded: function() {
		console.log('Detect event itemsLoaded');
		this.setState({
			fields: itemStore.fields,
			items: itemStore.items
		});
	},

	fieldSelectionChanged: function() {
		console.log('Detect event fieldSelectionChanged');
		this.setState();
	},

	itemLoaded: function(id) {
		console.log('Detect event itemLoaded', id);
		this.setState({
			items: itemStore.items
		});
	},

	newItem: function() {
		console.log('new Item');
		dispatcher.dispatch({
			name: ACTION.addItem
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
					return <CollectionSelectOption key={idx} collection={collection} />;
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
		var i = 0;
		return (
			<div> {
				$.map(this.props.fields, function(fieldProps, fieldName) {
					return <FieldSelectOption key={i++} value={fieldName} selected={fieldProps.selected} />;
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
					<ItemTableHeader fields={this.props.fields} />
				</thead>
				<tbody key={Date.now()}> {
					this.props.items.map(function(item, idx) {
						return <ItemTableRow item={item} fields={this.props.fields} />;	
					}.bind(this))
				} 
				</tbody>
			</table>
		);	
	}
	
});

var ItemTableHeader = React.createClass({
	render: function() {
		return (
			<tr key={Date.now()}> { 
				$.map(this.props.fields, function(value, key) {
					return value.selected ? <th>{Case.title(key)}</th> : null;
				})
			} </tr>
		);
	}
});

var ItemTableRow = React.createClass({
	render: function() {
		var changed = function(event) {
			if(event.charCode == 13 && !event.shiftKey) {
				dispatcher.dispatch({
					name: ACTION.updateItemByField,
					data: {
						id: this.props.item.id,
						field: event.target.dataset.field,
						value: event.target.innerText
					}
				});
			}	
		}.bind(this);

	


		var format = function(value) {
			if(value == null)
				return null;
			else if(value instanceof Date)
				return dateFormat(value, 'yyyy/mm/dd');
			else
				return value.toString();
		};

		console.log('render item', this.props.item, this.props.fields);
		return (
			<tr> {
				$.map(this.props.item, function(value, key) {
					return this.props.fields[key] && this.props.fields[key].selected 
					? (<td data-field={key} contentEditable={key !== 'id'} onKeyPress={changed} style={{'white-space':'pre'}}>
						{format(value)}
						</td>)
					: null;
				}.bind(this))
			} </tr>
		);
	}
});





module.exports = App;
