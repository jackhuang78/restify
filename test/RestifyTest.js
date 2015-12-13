import assert from 'assert';
import chai, {expect} from 'chai';
import chaiSubset from 'chai-subset';
import chaiDatetime from 'chai-datetime';
import Restify from '../src/Restify';
import logger from '../src/Logger';

chai.use(chaiSubset);
chai.use(chaiDatetime);

let config = {
	database: {host: 'localhost', user: 'root', pass: '', db: 'restify'},
	schema: {
		Person: {
			name: {nullable: false},
			dateOfBirth: {type: 'date'},
			age: {type: 'int'},
			height: {type: 'double'},
			graduated: {type: 'boolean'}
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

let debugOn = () => logger.setConsoleLevel('debug');
let debugOff = () => logger.setConsoleLevel('info');


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
			//debugOn();
			done();
		});

		after((done) => {
			debugOff();
			done();
		});

		it('should drop all tables and recreate them', async (done) => {
			try {
				await restify.reset();
				await restify.sync();
				done();
			} catch(e) {
				done(e);
			}
			
			
		});

	});

	describe('# sigle table crud', () => {
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
			//debugOn();
			done();
		});

		afterEach(async (done) => {
			try {
				await conn.end();
				debugOff();
				done();
			} catch(e) {
				done(e);
			}
		});

		after((done) => {
			done();
		});

		let item0 = {};
		let item1 = {name: 'Jack', age: 26, dateOfBirth: new Date('12/17/1989'), height: 170.1, graduated: true};
		let item2 = {name: 'Joe', age: 40};
		let item3 = {address: 'jack.huang78@gmail.com', 'owner':{name: 'Jack'}};

		it('should create an item, read the item, and delete the item', async (done) => {
			try {
				let res = await conn.post('Person', item0);
				expect(res).to.be.not.null;
				expect(res).to.have.property('_id', 1);
				let id = res._id;

				let items = await conn.get('Person', {_id: id});
				expect(items).to.be.not.null;
				expect(items).to.be.instanceof(Array);
				expect(items).to.have.length(1);
				expect(items[0]).to.be.not.null;
				expect(items[0]).to.have.property('_id', id);

				res = await conn.delete('Person', {_id: id});

				items = await conn.get('Person', {_id: id});
				expect(items).to.have.length(0);

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should create an item with various types of fields', async (done) => {
			try {
				let res = await conn.post('Person', item1);
				let id = res._id;
				let items = await conn.get('Person', {'*': undefined, _id: id});

				expect(items[0]).to.have.property('_id', id);
				expect(items[0]).to.have.property('name', item1.name);
				expect(items[0]).to.have.property('age', item1.age);
				expect(items[0]).to.have.property('height', item1.height);
				expect(items[0]).to.have.property('graduated', item1.graduated);
				expect(items[0].dateOfBirth).to.equalDate(item1.dateOfBirth);

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should udpate an item', async (done) => {
			try {
				let res = await conn.post('Person', item1);
				let id = res._id;

				res = await conn.put('Person', {_id: id, name: 'Jack Huang'});

				let items = await conn.get('Person', {'*': undefined, _id: id});
				expect(items[0]).to.have.property('name', 'Jack Huang');

				done();
			} catch(e) {
				done(e);
			}
		});

		


		// it('should create an item and retrieve it by ID', async (done) => {
		// 	try {
		// 		let id = (await conn.post('Person', item1))._id;
		// 		let res = await conn.get('Person', {
		// 			select: ['*'],
		// 			where: {_id: id}
		// 		});

		// 		expect(res[0]).to.have.property('_id', id);
		// 		expect(res[0]).to.have.property('name', item1.name);
		// 		expect(res[0].dateOfBirth).to.equalDate(item1.dateOfBirth);

		// 		done();
		// 	} catch(e) {
		// 		done(e);
		// 	}
		// });

		// it('should query items by field', async (done) => {
		// 	try {
		// 		let res1 = await conn.post('Person', item1);
		// 		let res2 = await conn.post('Person', item2);
		// 		expect(res1).to.have.property('_id');
		// 		expect(res2).to.have.property('_id');
				
		// 		let items = await conn.get('Person', {
		// 			select: ['*'],
		// 			where: {age: ['>', 30]}


		// 		});
		// 		expect(items.length).to.equal(1);
		// 		expect(items).to.containSubset([Object.assign(item2, {_id: res2._id})]);

		// 		items = await conn.get('Person', {
		// 			select: ['*'],
		// 			where: {age: ['<', 50]}
		// 		});
		// 		expect(items.length).to.equal(2);
		// 		expect(items).to.containSubset([Object.assign(item1, {_id: res1._id})]);
		// 		expect(items).to.containSubset([Object.assign(item2, {_id: res2._id})]);


		// 		done();
		// 	} catch(e) {
		// 		done(e);	
		// 	}
		// });

		// it('should create item with nested item', async (done) => {
		// 	try {
		// 		let created = await conn.post('Email', item3);
		// 		expect(created).to.have.property('_id');
		// 		expect(created).to.have.property('owner');
		// 		expect(created).to.have.deep.property('owner._id');




		// 		//TODO: do this next
		// 		done();
		// 	} catch(e) {
		// 		done(e);
		// 	}
		// });

	});
	

});