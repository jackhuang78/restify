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

var alertError = function(error) {
	alert(util.format('ERROR %d %s: %s', error.status, error.statusText, error.responseText));
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

			$.ajax({
				url: util.format('%s', collection),
				type: 'GET'

			}).fail(function(error) {
				alertError(error);
			}).done(function(data) {
				this.items = data;
				this.trigger('itemsLoaded');

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
					this.trigger('itemLoaded', id);
					return;
				}
			}
		}.bind(this));
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
	'updateItemByField': 'updateItemByField'
};
var dispatcher = new Dispatcher();
dispatcher.register(function(action) {
	console.log('action', action);

	switch(action.name) {
		case ACTION.loadItems:
			itemStore.loadItems(action.data.collection);
			break;

		case ACTION.updateItemByField:
			itemStore.updateItemByField(action.data.id, action.data.field, action.data.value);
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
var CollectionSelectOption = React.createClass({
	render: function() {
		return <option>{this.props.collection}</option>;
	}
});

var CollectionControl = React.createClass({
	render: function() {
		return (
			<div>
				<select className='form-control' onChange={this.changed}> {
					this.state.collections.map(function(collection, idx) { 
						return <CollectionSelectOption collection={collection} />;
					})
				} </select>
				<FieldSelect fields={this.state.fields} />
			</div>
		);
	},

	getInitialState: function() {
		return {collections: [], fields: []};
	},

	changed: function(event) {

	},


	selectionChanged: function(event) {
		
		var collection = event.target.value; //collections[0];
		$.get(collection + '/_fields', function(fields, status) {
			if(status !== 'success') {
				alert('Failed to load fields for ' + collection);
				return;
			}

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


	},

	componentDidMount: function() {

		$.get('_collections', function(collections, status) {
			
			if(status !== 'success') {
				alert('Failed to load tables');
				return;
			} 

			this.state.collections = collections;
			this.selectionChanged({target: {value: 'student'}});

		}.bind(this));

		
		
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
		this.setState({fields: itemStore.fields, items: itemStore.items});
	},

	componentDidMount: function() {
		itemStore.bind('changed', this.itemsStoreChanged);
		itemStore.bind('selectionChanged', this.itemsStoreChanged);
	},

	componentDidUnmount: function() {
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

		return (
			<table id='mytable' className='table table-hover table-striped table-condensed' data-sort-name='Gpa'>
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

	fieldUpdated: function(err) {
		console.log('fieldUpdated', event);
		alert('cannot update field');

		itemStore.unbind('fieldUpdated', this.fieldUpdated);
	},

	changed: function(event) {
		console.log('changed', event.target);
		console.log('update item id', this.props.item.id, 'field', event.target.dataset.name, 'value', event.target.innerText);

		itemStore.bind('fieldUpdated', this.fieldUpdated);

		dispatcher.dispatch({
			name: 'updateSingleField',
			data: {
				'id': this.props.item.id,
				'field': event.target.dataset.name,
				'value': event.target.innerText
			}
		});
	},



	render: function() {
		return (
			<tr>
				{
					$.map(this.props.item, function(value, key) {
						var v = value instanceof Date 
								? dateFormat(value, 'yyyy/mm/dd')
								: value.toString();
						return (
							<td data-name={key} contentEditable={true} onBlur={this.changed}>{v}</td>
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
				<p contenteditable="true">paragraph</p>
				<div className='row'>
					<div className='col-md-2'>
						<CollectionControl />
					</div>
					<div className='col-md-9'>
						<TableDisplay />
					</div>
				</div>
				<div className='row'>
					<div className='col-md-12'>
						<form><div className="form-group">
							<table>
								<thead>
									<tr>
										<th>field 1</th>
										<th>field 3</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td><input value='312'>abc</input></td>
										<td>def</td>
									</tr>
								</tbody>
							</table>
						</div></form>
					</div>
				</div>
			</div>

		);
	}	
});



module.exports = QueryPage;
