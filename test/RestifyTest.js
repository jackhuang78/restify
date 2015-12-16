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
		Resume: {
			yearsOfExperience: {type: 'int'},
			owner: {type: 'Person', 'relation': 'OneToOne', as: 'resume'}
		},
		Email: {
			address: {nullable: false},
			owner: {type: 'Person', relation: 'ManyToOne', as: 'emails'}
		},
		Organization: {
			name: {nullable: false},
			members: {type: 'Person', relation: 'ManyToMany', as: 'organizations'}
		}
	}

};

let debugOn = () => logger.setConsoleLevel('debug');
let debugOff = () => logger.setConsoleLevel('info');


describe('Restify', () => {
	let restify, conn;


	describe('# constructor', () => {
		it('should instanciate properly', (done) => {
			restify = new Restify(config);
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
			expect(restify.fields('Person')).to.include('organizations');

			//console.log(restify._collections);


			done();
		});
	});

	describe('# setup', () => {
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

	describe('# single table crud', () => {
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

		it('should create an item, read the item, and delete the item', async (done) => {
			try {
				let res = await conn.post('Person', {});
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
				//debugOn();
				let item = {
					name: 'Jack', 
					age: 26, 
					dateOfBirth: new Date('12/17/1989'), 
					height: 170.1, 
					graduated: true
				};
				let res = await conn.post('Person', item);
				let id = res._id;
				let items = await conn.get('Person', {'*': undefined, _id: id});

				expect(items).to.have.length(1);
				expect(items[0]).to.have.property('_id', id);
				expect(items[0]).to.have.property('name', item.name);
				expect(items[0]).to.have.property('age', item.age);
				expect(items[0]).to.have.property('height', item.height);
				expect(items[0]).to.have.property('graduated', item.graduated);
				expect(items[0].dateOfBirth).to.equalDate(item.dateOfBirth);

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should udpate an item', async (done) => {
			try {
				let res = await conn.post('Person', {name: 'Jack'});
				let id = res._id;

				res = await conn.put('Person', {_id: id, name: 'Jack Huang'});

				let items = await conn.get('Person', {'*': undefined, _id: id});
				expect(items[0]).to.have.property('name', 'Jack Huang');

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should create with ManyToOne relation', async (done) => {
			try {
				//debugOn();
				let res, items;

				res = await conn.post('Person', {});
				let personId = res._id;
				res = await conn.post('Email', {owner: personId});
				let email1Id = res._id;
				res = await conn.post('Email', {owner: personId});
				let email2Id = res._id;

				items = await conn.get('Email', {'*': undefined, _id: email1Id});
				expect(items[0]).to.have.property('owner', personId);
				items = await conn.get('Email', {'*': undefined, _id: email2Id});
				expect(items[0]).to.have.property('owner', personId);

				items = await conn.get('Person', {'*': undefined, _id: email1Id});
				expect(items[0]).to.have.property('emails')
						.that.is.an('array')
						.that.containSubset([email1Id, email2Id]);

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should create with OneToMany relation', async (done) => {
			try {
				//debugOn();
				let res, items;

				res = await conn.post('Email', {});
				let email1Id = res._id;
				res = await conn.post('Email', {});
				let email2Id = res._id;
				res = await conn.post('Person', {emails: [email1Id, email2Id]});
				let personId = res._id;

				items = await conn.get('Email', {'*': undefined, _id: email1Id});
				expect(items[0]).to.have.property('owner', personId);
				items = await conn.get('Email', {'*': undefined, _id: email2Id});
				expect(items[0]).to.have.property('owner', personId);
				items = await conn.get('Person', {'*': undefined, _id: email1Id});
				expect(items[0]).to.have.property('emails')
						.that.is.an('array')
						.that.containSubset([email1Id, email2Id]);

				done();
			} catch(e) {
				done(e);
			}
		});

		it('should create with OneToOne relation', async (done) => {
			try {
				//debugOn();
				let res, items;

				res = await conn.post('Person', {});
				let person1Id = res._id;
				res = await conn.post('Resume', {owner: person1Id});
				let resume1Id = res._id;

				items = await conn.get('Resume', {_id: resume1Id, 'owner': undefined});
				expect(items[0]).to.have.property('owner', person1Id);
				items = await conn.get('Person', {_id: person1Id, 'resume': undefined});
				expect(items[0]).to.have.property('resume', resume1Id);

				res = await conn.post('Resume', {});
				let resume2Id = res._id;				
				res = await conn.post('Person', {resume: resume2Id});
				let person2Id = res._id;

				items = await conn.get('Resume', {_id: resume2Id, 'owner': undefined});
				expect(items[0]).to.have.property('owner', person2Id);
				items = await conn.get('Person', {_id: person2Id, 'resume': undefined});
				expect(items[0]).to.have.property('resume', resume2Id);


				done();
			} catch(e) {
				done(e);
			}
		});

		it('should create with ManyToMany relation from master', async (done) => {
			try {
				//debugOn();
				let res, items;

				res = await conn.post('Person', {});
				let person1Id = res._id;
				res = await conn.post('Person', {});
				let person2Id = res._id;
				res = await conn.post('Organization', {members:[person1Id, person2Id]});
				let org1Id = res._id;
				res = await conn.post('Organization', {members:[person1Id, person2Id]});
				let org2Id = res._id;

				items = await conn.get('Organization', {_id: org1Id, 'members': undefined});
				expect(items[0]).to.have.property('members')
						.that.is.an('array')
						.that.containSubset([person1Id, person2Id]);

				items = await conn.get('Organization', {_id: org2Id, 'members': undefined});
				expect(items[0]).to.have.property('members')
						.that.is.an('array')
						.that.containSubset([person1Id, person2Id]);

				items = await conn.get('Person', {_id: person1Id, 'organizations': undefined});
				expect(items[0]).to.have.property('organizations')
						.that.is.an('array')
						.that.containSubset([org1Id, org2Id]);

				items = await conn.get('Person', {_id: person2Id, 'organizations': undefined});
				expect(items[0]).to.have.property('organizations')
						.that.is.an('array')
						.that.containSubset([org1Id, org2Id]);



				done();
			} catch(e) {
				done(e);
			}
		});

		it('should create with ManyToMany relation from slave', async (done) => {
			try {
				//debugOn();
				let res, items;

				res = await conn.post('Organization', {});
				let org1Id = res._id;
				res = await conn.post('Organization', {});
				let org2Id = res._id;
				res = await conn.post('Person', {organizations: [org1Id, org2Id]});
				let person1Id = res._id;
				res = await conn.post('Person', {organizations: [org1Id, org2Id]});
				let person2Id = res._id;
				

				items = await conn.get('Organization', {_id: org1Id, 'members': undefined});
				expect(items[0]).to.have.property('members')
						.that.is.an('array')
						.that.containSubset([person1Id, person2Id]);

				items = await conn.get('Organization', {_id: org2Id, 'members': undefined});
				expect(items[0]).to.have.property('members')
						.that.is.an('array')
						.that.containSubset([person1Id, person2Id]);

				items = await conn.get('Person', {_id: person1Id, 'organizations': undefined});
				expect(items[0]).to.have.property('organizations')
						.that.is.an('array')
						.that.containSubset([org1Id, org2Id]);

				items = await conn.get('Person', {_id: person2Id, 'organizations': undefined});
				expect(items[0]).to.have.property('organizations')
						.that.is.an('array')
						.that.containSubset([org1Id, org2Id]);



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