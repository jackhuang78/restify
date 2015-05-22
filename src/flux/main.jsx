var React = require('react'),
	IndexPage = require('../flux/index.js'),
	AdminPage = require('../flux/admin.js');

var reactComponent = content.getAttribute('react');

switch(reactComponent) {
	case 'IndexPage':
		React.render(<IndexPage />, content);
		break;
	
	case 'AdminPage': 
		React.render(<AdminPage/>, content);
		break;

	default:
		React.render(<div>NOT FOUND</div>, content);
}



console.log('main.js');