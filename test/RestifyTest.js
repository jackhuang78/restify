import assert from 'assert';
import chai, {expect} from 'chai';
import chaiThings from 'chai-things';
import chaiDatetime from 'chai-datetime';
import chaiSubset from 'chai-subset';
import Restify from '../src/Restify';

chai.use(chaiDatetime);
chai.use(chaiThings);
chai.use(chaiSubset);

let config = {
	database: {host: 'localhost', user: 'root', pass: '', db: 'restify'},
	schema: {
		Person: {
			name: {nullable: false},
			dateOfBirth: {type: 'date'},
			age: {type: 'int'}
		},
		Email: {
			address: {nullable: false},
			owner: {type: 'Person', relation: 'ManyToOne', as: 'emails'}
		},
		Organization: {
			name: {nullable: false},
			members: {type: 'Person', relation: 'ManyToMany', as: 'organization'}
		}
	}

};

describe('Restify', () => {

	describe('# constructor', () => {
		it('should instanciate properly', (done) => {
			let restify = new Restify(config);
			expect(restify).to.be.not.null;
			expect(restify._database).to.deep.equal(config.database);
			
			expect(restify.collections()).to.include('Person');
			expect(restify.collections()).to.include('Email');
			expect(restify.collections()).to.include('Organization');

			expect(restify.fields('Person')).to.include('_id');
			expect(restify.fields('Email')).to.include('_id');
			expect(restify.fields('Organization')).to.include('_id');

			expect(restify.fields('Person')).to.include('name');
			expect(restify.fields('Person')).to.include('dateOfBirth');
			expect(restify.fields('Email')).to.include('address');
			expect(restify.fields('Email')).to.include('owner');
			expect(restify.fields('Organization')).to.include('name');
			expect(restify.fields('Organization')).to.include('members');

			expect(restify.fields('Person')).to.include('emails');
			expect(restify.fields('Person')).to.include('organization');


			done();
		});
	});

	describe('# setup', () => {
		let restify = null;

		before((done) => {
			restify = new Restify(config);
			done();
		});

		it('should drop all tables', async (done) => {
			try {
				await restify.reset();
				done();
			} catch(e) {
				done(e);
			}
			
			
		});

		it('should generate create table statements', async (done) => {
			try {
				await restify.sync();
				done();
			} catch(e) {
				done(e);
			}
			
		});
	});

	describe('# crud', () => {
		let restify = null;
		let conn = restify;

		before((done) => {
			restify = new Restify(config);
			done();
		});

		beforeEach(async (done) => {
			await restify.reset();
			await restify.sync();
			conn = restify.connect();
			done();
		});

		afterEach(async (done) => {
			try {
				await conn.end();
				done();
			} catch(e) {
				done(e);
			}
		});

		let item1 = {name: 'Jack', age: 26, dateOfBirth: new Date('12/17/1989')};
		let item2 = {name: 'Joe', age: 40};

		it('should create an item and retrieve it', async (done) => {
			try {
				let id = await conn.post('Person', item1);
				
				let res = await conn.get('Person', {
					select: ['*'],
					where: {_id: id}
				});

				expect(res[0]).to.have.property('_id', id);
				expect(res[0]).to.have.property('name', item1.name);
				expect(res[0].dateOfBirth).to.equalDate(item1.dateOfBirth);

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should query item by field', async (done) => {
			try {
				let id1 = await conn.post('Person', item1);
				let id2 = await conn.post('Person', item2);

				let items = await conn.get('Person', {
					select: ['*'],
					where: {age: ['>', 30]}
				});
				expect(items.length).to.equal(1);
				expect(items).t.containSubset([Object.assign(item2, {_id: id2})]);

				items = await conn.get('Person', {
					select: ['*'],
					where: {age: ['<', 50]}
				});
				expect(items.length).to.equal(2);
				expect(items).to.containSubset([Object.assign(item1, {_id: id1})]);
				expect(items).to.containSubset([Object.assign(item2, {_id: id2})]);

				done();
			} catch(e) {
				done(e);	
			}
			
		});

	});
	

});