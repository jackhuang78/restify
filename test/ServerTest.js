import chai, {expect} from 'chai';
import Server from '../src/Server';
import request from 'request';
import promisify from 'es6-promisify';
import mysql from 'mysql';
import fs from 'fs';
import chaiSubset from 'chai-subset';
import dbConfig from './config.json';
import {execCmd, execSql, execSqlFile, toFile} from './exec';

chai.use(chaiSubset);

let PORT = 8888;
let host = `http://localhost:${PORT}`;

let resetDb = async () => {
	await execSqlFile('./test/sakila-db/sakila-schema.sql');
	await execSqlFile('./test/sakila-db/sakila-data.sql');
};
let req = async (opt) => {
	return new Promise((res, rej) => {
		opt.baseUrl = `http://localhost:${PORT}`;
		request(opt, (error, response, body) => {
			if(error)
				rej(error);
			res(response, body);
		});
	});
};

describe('Server.js', () => {
	describe('#_parseQuery()', () => {
		it('should parse query', () => {
			expect(Server._parseQuery({f1: 1, f2: 2}))
					.to.deep.equal({f1: ['=',1], f2: ['=',2]});

			expect(Server._parseQuery({f1: 1, ['f2.f21']: 21, ['f2.f22']: 22}))		
					.to.deep.equal({f1: ['=',1], f2: {f21: ['=',21], f22: ['=',22]}});

		});
	});


	describe('#start() / #stop()', () => {
		it('should start ans stop server', async () => {
			let server = new Server(dbConfig);
			await server.start(PORT);
			await server.stop();
		});	
	});

	describe('#HTTP', () => {
		let server = new Server(dbConfig);
		before(async () => {
			await resetDb();
			await server.start(PORT);
		});
		after(async () => {
			await server.stop(PORT);
		});

		describe('#/', () => {
			describe('#GET', () => {
				it('should get the server status', async () => {
					let res = await req({method: 'GET', url: `/`, json: true});
					expect(res.statusCode).to.equal(200);
					expect(res.body).to.have.property('status', 'ok');
				});
			});

			describe('#OPTION', () => {
				it('should get a list of table names', async () => {
					let res = await req({method: 'OPTIONS', url: `/`, json: true});
					expect(res.statusCode).to.equal(200);
					expect(res.body).to.containSubset({tables: ['film', 'actor']});
				});
			});
		});

		describe('#/:table', () => {
			describe('#OPTIONS', () => {
				it('should get columns for table', async () => {
					let res = await req({method: 'OPTIONS', url: '/film', json: true});
					expect(res.statusCode).to.equal(200);
					expect(res.body).to.containSubset({fields: {film_id: {type: 'smallint'}, title: {type: 'varchar'}}});
				});
			});

			describe('#GET', () => {
				describe('conditions', () => {
					it('should get data by =', async () => {
						//let res = await req({method: 'GET', url: '/film', qs: {film_id: 1, title: null}, json: true});
						let res = await req({method: 'GET', url: '/film?film_id=2&title', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(1);
						expect(res.body).to.containSubset([{film_id: 2, title: 'ACE GOLDFINGER'}]);
					});

					it('should get data by <', async () => {
						let res = await req({method: 'GET', url: '/film?film_id=<5&title', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(4);
						expect(res.body).to.containSubset([
							{film_id: 1, title: 'ACADEMY DINOSAUR'}, 
							{film_id: 2, title: 'ACE GOLDFINGER'},
							{film_id: 3, title: 'ADAPTATION HOLES'},
							{film_id: 4, title: 'AFFAIR PREJUDICE'}
						]);
					});

					it('should get data by <=', async () => {
						let res = await req({method: 'GET', url: '/film?film_id=<=5&title', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(5);
						expect(res.body).to.containSubset([
							{film_id: 1, title: 'ACADEMY DINOSAUR'}, 
							{film_id: 2, title: 'ACE GOLDFINGER'},
							{film_id: 3, title: 'ADAPTATION HOLES'},
							{film_id: 4, title: 'AFFAIR PREJUDICE'},
							{film_id: 5, title: 'AFRICAN EGG'}
						]);
					});

					it('should get data by >', async () => {
						let res = await req({method: 'GET', url: '/film?film_id=>996&title', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(4);
						expect(res.body).to.containSubset([
							{film_id: 997, title: 'YOUTH KICK'},
							{film_id: 998, title: 'ZHIVAGO CORE'},
							{film_id: 999, title: 'ZOOLANDER FICTION'},
							{film_id: 1000, title: 'ZORRO ARK'}
						]);
					});

					it('should get data by >=', async () => {
						let res = await req({method: 'GET', url: '/film?film_id=>=996&title', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(5);
						expect(res.body).to.containSubset([
							{film_id: 996, title: 'YOUNG LANGUAGE'}, 
							{film_id: 997, title: 'YOUTH KICK'},
							{film_id: 998, title: 'ZHIVAGO CORE'},
							{film_id: 999, title: 'ZOOLANDER FICTION'},
							{film_id: 1000, title: 'ZORRO ARK'}
						]);
					});

					it('should get data by !=', async () => {
						let res = await req({method: 'GET', url: '/film?rating=!=G&title', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(822);
					});

					it('should get data by ~', async () => {
						let res = await req({method: 'GET', url: '/film?title=~%ACE%', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.have.length(15);
					});
				});
				
				describe('nesting', () => {
					it('should get toOne relation', async () => {
						let res = await req({method: 'GET', url: '/film?film_id=1&language.name', json: true});
						expect(res.statusCode).to.equal(200);
						expect(res.body).to.containSubset([
							{film_id: 1, language: {name: 'English'}}
						]);
					});

					it('should get toMany relation', async () => {
						let res = await(req({method: 'GET', url: '/customer?customer_id=1&customer_of_rental.rental_id', json: true}));
						expect(res.statusCode).to.equal(200);
						expect(res.body[0]).to.have.length(32);
					});

				});
			});


		});

		
	});
});