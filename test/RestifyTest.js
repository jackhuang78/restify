import assert from 'assert';
import chai, {expect} from 'chai';
import chaiSubset from 'chai-subset';
import chaiDatetime from 'chai-datetime';
import Restify from '../src/Restify';
import logger from '../src/Logger';
import mysql from 'mysql';
import fs from 'fs';
import deConfig from './config.json';
import {execCmd, execSql, execSqlFile} from './exec';
import dbConfig from './config.json';

chai.use(chaiSubset);
chai.use(chaiDatetime);


let resetDb = async () => {
	await execSqlFile('./test/sakila-db/sakila-schema.sql');
	await execSqlFile('./test/sakila-db/sakila-data.sql');
};


describe('#Restify', () => {
	describe('#constructor()', () => {
		it('should create Restify instance', async () => {
			let restify = new Restify(dbConfig);
			expect(restify).to.be.not.null;
		});
	});

	describe('#sync()', () => {
		let restify;
		before(async () => {
			await resetDb();
			restify = new Restify(dbConfig);
		});

		it('should sync without error', async () => {
			await restify.sync();
		});

		describe('#schema()', () => {
			before(async () => {
				await restify.sync();
			});

			it('should sync table names correctly', async () => {
				let schema = restify.schema();
				expect(schema).to.have.keys([
						'actor','actor_info','address','category','city','country','customer',
						'customer_list','film','film_actor','film_category','film_list','film_text',
						'inventory','language','nicer_but_slower_film_list','payment','rental',
						'sales_by_film_category','sales_by_store','staff','staff_list','store']);
			});

			it('should sync column names correctly', async () => {
				let schema = restify.schema();
				expect(schema.actor).to.contain.keys(['actor_id', 'first_name', 'last_name', 'last_update']);
			});

			it('should sync column type and size correctly', async () => {
				let schema = restify.schema();

				expect(schema.film.language_id).to.containSubset({type: 'tinyint'});
				expect(schema.film.film_id).to.containSubset({type: 'smallint'});
				expect(schema.inventory.inventory_id).to.containSubset({type: 'mediumint'});
				expect(schema.rental.rental_id).to.containSubset({type: 'int'});
				expect(schema.customer.active).to.containSubset({type: 'tinyint'});

				expect(schema.film.rental_rate).to.containSubset({type: 'decimal', size: 4});

				expect(schema.film.rating).to.containSubset({type: 'enum'});				
				expect(schema.film.special_features).to.containSubset({type: 'set'});

				expect(schema.film.title).to.containSubset({type: 'varchar', size: 255});
				expect(schema.film.description).to.containSubset({type: 'text'});

				expect(schema.customer.create_date).to.containSubset({type: 'datetime'});
				expect(schema.film.last_update).to.containSubset({type: 'timestamp'});
				expect(schema.film.release_year).to.containSubset({type: 'year'});

				expect(schema.staff.picture).to.containSubset({type: 'blob'});
			});

			it('should sync references property correctly', async () => {
				let schema = restify.schema();

				expect(schema.film.film_id).to.containSubset({primary: true});

				expect(schema.film.language_id).to.containSubset({
					foreign: true, referencedTable: 'language', referencedColumn: 'language_id'
				});
				expect(schema.language.language_of_film).to.containSubset({
					referenced: true, hasMany: true, referencedByTable: 'film', referencedByColumn: 'language_id'
				});

				expect(schema.film.original_language_id).to.containSubset({
					foreign: true, referencedTable: 'language', referencedColumn: 'language_id'
				});
				expect(schema.language.original_language_of_film).to.containSubset({
					referenced: true, hasMany: true, referencedByTable: 'film', referencedByColumn: 'original_language_id'
				});


				expect(schema.store.manager_staff_id).to.containSubset({
					foreign: true, unique: true, referencedTable: 'staff', referencedColumn: 'staff_id'
				});
				expect(schema.staff.manager_staff_of_store).to.containSubset({
					referenced: true, hasMany: false, referencedByTable: 'store', referencedByColumn: 'manager_staff_id'
				});

			});

			


		});
	});



	// describe('#CRUD', () => {
	// 	let restify;
	// 	debugOn();

	// 	describe('#post()', () => {
	// 		beforeEach(async () => {
	// 			await resetDb();
	// 			restify = new Restify(config);
	// 			await restify.sync();
	// 		});

	// 		it.only('should insert one row', async () => {
	// 			let res = await restify.post('User', [{username: 'jhuang78'}]);
	// 			expect(res).to.be.an.array.that.has.length(1);
	// 			expect(res[0].id).to.be.an.int;
	// 		});

	// 		it('should insert some rows', async () => {
	// 			let res = await restify.post('User', [{username: 'jhuang78'},{username: 'jack781217'}]);
	// 			expect(res).to.have.length(2);
	// 			expect(res[0]).to.be.an.int;
	// 			expect(res[1]).to.be.an.int;
	// 		});
	// 	});
	// });
	
	
});