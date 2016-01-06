import mysql from 'mysql';
import Enum from 'es6-enum';

describe('quick test', () => {
	// it('should do some quick test', (done) => {
	// 	let conn = mysql.createConnection({host: 'localhost', user: 'root', password: '', database: 'restify'});
	// 	conn.query('drop table abc;', (err, rows, fields) => {
	// 		conn.query('create table abc(id int auto_increment, primary key(id), name varchar(255));', (err, rows, fields) => {
	// 			conn.query('insert into abc(name) values (\'abc\'),(\'def\');', (err, rows, fields) => {
	// 				console.log('err', err, 'rows', rows, 'fields', fields);
	// 				conn.end();
	// 				done();
	// 			});
	// 		});
	// 	});
		
	// });
	// 
	
	it('should do some test', () => {
		// console.log(mysql.escape([[1, 'abc', null], [2, 'def', null]]));
		// console.log(mysql.escape([1, 'abc', null]));
		// console.log(mysql.escapeId([['abc', 'def']]));
		// console.log(mysql.escape({abc:[123,456], def:'jack', ghi: null}));
	});
});