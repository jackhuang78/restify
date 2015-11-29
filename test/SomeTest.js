import mysql from 'mysql';

describe('some test', () => {
	it('should do some test', () => {
		console.log(mysql.escape([1,'abc',true]));
	});
});