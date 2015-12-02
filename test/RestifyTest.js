import assert from 'assert';
import chai, {expect} from 'chai';
import chaiDatetime from 'chai-datetime';
import Restify from '../src/Restify';

chai.use(chaiDatetime);

let config = {
	database: {host: 'localhost', user: 'root', pass: '', db: 'restify'},
	schema: {
		Person: {
			name: {nullable: false},
			dateOfBirth: {type: 'date'}
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

		beforeEach((done) => {
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

		it('should create an item', async (done) => {
			try {
				let item = {name: 'Jack', dateOfBirth: new Date('12/17/1989')};
				let id = await conn.post('Person', item);
				expect(id).to.equal(0);

				let res = await conn.get('Person', {_id: id, name: undefined, dateOfBirth: undefined});
				console.log(typeof res[0].dateOfBirth);
				expect(res[0]).to.have.property('_id', id);
				expect(res[0]).to.have.property('name', item.name);
				expect(res[0].dateOfBirth).to.equalDate(item.dateOfBirth);

				done();
			} catch(e) {
				done(e);
			}
		});

	});
	

});