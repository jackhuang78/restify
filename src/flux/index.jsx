var React = require('react');

var Content = React.createClass({
	render: function() {
		return (
			//<div>{this.props.value}</div>
			<div>Content</div>
		);		
	}	
});

var Content2 = React.createClass({
	render: function() {
		return (
			//<div>{this.props.value}</div>
			<div>Content3</div>
		);		
	}	
});

React.render(
	<Content />, document.getElementById('content')
);


console.log('INDEX.JSs');