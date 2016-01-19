import assert from 'assert';
import chai, {expect} from 'chai';
import chaiSubset from 'chai-subset';
import chaiDatetime from 'chai-datetime';
import Restify from '../src/Restify';
import logger from '../src/Logger';
import faker from 'faker';
import Chance from 'chance';
import {argv} from 'yargs';



let chance = new Chance(1);
faker.seed(1);
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
	

	//==============================
	//	test cases
	//==============================
	
	describe('#Operation', () => {
		let restify, conn;
		before(async () => {
			restify = new Restify(config);
		});
		beforeEach(async () => {
			if(process.env.env === 'ci' || argv.d)
				debugOn();
			await restify.reset();
			await restify.sync();
			conn = restify.connect();
		});
		afterEach(async () => {
			await conn.end();
			debugOff();
		});
		after(async () => {
		});

		describe('#Object', () => {
			describe('#postOrPut', async () => {
				it('should create items with valid ID', async () => {
					let res;
						
					res = await conn.postOrPut('Person', {});
					expect(res).to.not.be.null;
					expect(res).to.have.property('_id')
							.that.is.a('number')
							.that.is.greaterThan(0);
					let id1 = res._id;

					res = await conn.postOrPut('Person', {});
					expect(res).to.not.be.null;
					expect(res).to.have.property('_id')
							.that.is.a('number')
							.that.is.greaterThan(0)
							.that.not.equals(id1);
				});
			});

			describe('#get', async () => {
				it('should read a created item by ID', async () => {
					let res;
					let name1 = chance.name();
					let name2 = chance.name();

					res = await conn.postOrPut('Person', {name: name1});
					let id1 = res._id;
					res = await conn.postOrPut('Person', {name: name2});
					let id2 = res._id;

					res = await conn.get('Person', {_id: id1, name: undefined});
					expect(res).to.not.be.null;
					expect(res).to.be.a('array').that.have.length(1)
							.that.containSubset([{_id: id1, name: name1}]);

					res = await conn.get('Person', {_id: id2, name: undefined});
					expect(res).to.not.be.null;
					expect(res).to.be.a('array').that.have.length(1)
							.that.containSubset([{_id: id2, name: name2}]);
				});
			});

			describe('#delete', async () => {
				it('should delete a created item by ID', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let id = res._id;
					res = await conn.delete('Person', {_id: id});
					res = await conn.get('Person', {_id: id});
					expect(res).to.not.be.null;
					expect(res).to.be.a('array').that.have.length(0);
				});
			});
		});

		describe('#Fields', () => {
			describe('#postOrPut', () => {
				it('should create an item with string/int/float/boolean/date fields', async () => {
					let res;
					let person1 = {
						name: chance.name(),
						age: chance.age(), 
						dateOfBirth: new Date(chance.date().setMilliseconds(0)),
						height: chance.floating({min: 0, max: 300, fixed: 2}),
						graduated: chance.bool()
					};

					res = await conn.postOrPut('Person', person1);
					let id = res._id;
					res = await conn.get('Person', {_id: id, '*': undefined});
					expect(res).to.containSubset([person1]);
				});
			
				it('should update an item with string/int/float/boolean/date fields', async () => {
					let res;
					let person1 = {
						name: chance.name(),
						age: chance.age(), 
						dateOfBirth: new Date(chance.date().setMilliseconds(0)),
						height: chance.floating({min: 0, max: 300, fixed: 2}),
						graduated: chance.bool()
					};
					res = await conn.postOrPut('Person', person1);
					let id = res._id;

					let person2 = {
						_id: id,
						name: chance.name(),
						age: chance.age(), 
						dateOfBirth: new Date(chance.date().setMilliseconds(0)),
						height: chance.floating({min: 0, max: 300, fixed: 2}),
						graduated: chance.bool()
					};
					res = await conn.postOrPut('Person', person2);
					res = await conn.get('Person', {_id: id, '*': undefined});
					expect(res[0]).to.containSubset(person2);
					expect(res[0]).to.have.property('resume', null);
					expect(res[0]).to.have.property('emails').that.is.a('array').that.is.empty;
					expect(res[0]).to.have.property('organizations').that.is.a('array').that.is.empty;
				});
			});

			describe('#get', () => {
				let person1Id, person2Id;
				let person1 = {
					name: 'Adam',
					age: 16,
					dateOfBirth: new Date('01/20/2000'),
					height: 170.4,
					graduated: true
				};
				let person2 = {
					name: 'Bill',
					age: 40,
					dateOfBirth: new Date('09/08/1976'),
					height: 153,
					graduated: false
				};
				beforeEach(async() => {
					let res;
					res = await conn.postOrPut('Person', person1);
					person1Id = res._id;
					res = await conn.postOrPut('Person', person2);
					person2Id = res._id;
				});

				it('should query by equality', async () => {
					let res;
					
					res = await conn.get('Person', {name: 'Adam', _id: undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person1Id}]);
					
					res = await conn.get('Person', {age: 40, '*': undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person2Id}]);
					
					res = await conn.get('Person', {dateOfBirth: new Date('01/20/2000'), '*': undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person1Id}]);
					
					res = await conn.get('Person', {height: 153, '*': undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person2Id}]);
					
					res = await conn.get('Person', {graduated: true, '*': undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person1Id}]);
				});

				it('should query by number relation', async () => {
					let res;

					res = await conn.get('Person', {age: {'<': 20}, _id: undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person1Id}]);

					res = await conn.get('Person', {age: {'>': 20}, _id: undefined});
					expect(res).to.have.length(1).that.containSubset([{_id: person2Id}]);

				});
			});
		});

		describe('#Relations', () => {
			describe('#postOrPut', () => {
				it('should create OneToOne relation from master', async () => {
					let res;

					res = await conn.postOrPut('Resume', {});
					let resumeId = res._id;
					res = await conn.postOrPut('Person', {resume: resumeId});
					let personId = res._id;

					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res[0]).to.have.property('resume', resumeId);
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
				});

				it('should create OneToOne relation from slave', async () => {
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Resume', {owner: personId});
					let resumeId = res._id;

					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res[0]).to.have.property('resume', resumeId);
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
				});

				it('should update OneToOne relation from master', async () => {
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Resume', {});
					let resume1Id = res._id;
					res = await conn.postOrPut('Resume', {});
					let resume2Id = res._id;
					
					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res[0]).to.have.property('resume', null);
					res = await conn.get('Resume', {_id: resume1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Resume', {_id: resume1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);

					res = await conn.postOrPut('Person', {_id: personId, resume: resume1Id});
					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res[0]).to.have.property('resume', resume1Id);
					res = await conn.get('Resume', {_id: resume1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
					res = await conn.get('Resume', {_id: resume2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);

					res = await conn.postOrPut('Person', {_id: personId, resume: resume2Id});
					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res[0]).to.have.property('resume', resume2Id);
					res = await conn.get('Resume', {_id: resume1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Resume', {_id: resume2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
				});

				it('should update OneToOne relation from slave', async () => {
					let res;

					res = await conn.postOrPut('Resume', {});
					let resumeId = res._id;
					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;
					
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Person', {_id: person1Id, resume: undefined});
					expect(res[0]).to.have.property('resume', null);
					res = await conn.get('Person', {_id: person2Id, resume: undefined});
					expect(res[0]).to.have.property('resume', null);

					res = await conn.postOrPut('Resume', {_id: resumeId, owner: person1Id});
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res[0]).to.have.property('owner', person1Id);
					res = await conn.get('Person', {_id: person1Id, resume: undefined});
					expect(res[0]).to.have.property('resume', resumeId);
					res = await conn.get('Person', {_id: person2Id, resume: undefined});
					expect(res[0]).to.have.property('resume', null);

					res = await conn.postOrPut('Resume', {_id: resumeId, owner: person2Id});
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res[0]).to.have.property('owner', person2Id);
					res = await conn.get('Person', {_id: person1Id, resume: undefined});
					expect(res[0]).to.have.property('resume', null);
					res = await conn.get('Person', {_id: person2Id, resume: undefined});
					expect(res[0]).to.have.property('resume', resumeId);
				});

				it('should create ManyToOne relation from master', async () => {
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Email', {owner: personId});
					let emailId = res._id;

					res = await conn.get('Email', {_id: emailId, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails')
							.that.has.members([emailId]);
				});

				it('should update ManyToOne relation from master', async () => {
					let res;

					res = await conn.postOrPut('Email', {});
					let emailId = res._id;
					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;

					res = await conn.get('Email', {_id: emailId, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Person', {_id: person1Id, emails: undefined});
					expect(res[0]).to.have.property('emails').that.is.empty;
					res = await conn.get('Person', {_id: person2Id, emails: undefined});
					expect(res[0]).to.have.property('emails').that.is.empty;

					res = await conn.postOrPut('Email', {_id: emailId, owner: person1Id});
					res = await conn.get('Email', {_id: emailId, owner: undefined});
					expect(res[0]).to.have.property('owner', person1Id);
					res = await conn.get('Person', {_id: person1Id, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.length(1).that.containSubset([emailId]);
					res = await conn.get('Person', {_id: person2Id, emails: undefined});
					expect(res[0]).to.have.property('emails').that.is.empty;

					res = await conn.postOrPut('Email', {_id: emailId, owner: person2Id});
					res = await conn.get('Email', {_id: emailId, owner: undefined});
					expect(res[0]).to.have.property('owner', person2Id);
					res = await conn.get('Person', {_id: person1Id, emails: undefined});
					expect(res[0]).to.have.property('emails').that.is.empty;
					res = await conn.get('Person', {_id: person2Id, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.length(1).that.containSubset([emailId]);
				});

				it('should create OneToMany relation from slave', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Email', {});
					let email1Id = res._id;
					res = await conn.postOrPut('Email', {});
					let email2Id = res._id;
					res = await conn.postOrPut('Person', {emails: [email1Id, email2Id]});
					let personId = res._id;

					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails')
							.that.has.members([email1Id, email2Id]);
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
				});

				it('should update OneToMany relation from slave', async () => {
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Email', {});
					let email1Id = res._id;
					res = await conn.postOrPut('Email', {});
					let email2Id = res._id;

					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.members([]);
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);

					res = await conn.postOrPut('Person', {_id: personId, emails: [email1Id]});
					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.members([email1Id]);
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);

					res = await conn.postOrPut('Person', {_id: personId, emails: [email1Id, email2Id]});
					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.members([email1Id, email2Id]);
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);

					res = await conn.postOrPut('Person', {_id: personId, emails: [email2Id]});
					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.members([email2Id]);
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
				});

				it('should create ManyToMany relation from master', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Organization', {});
					let org1Id = res._id;
					res = await conn.postOrPut('Organization', {});
					let org2Id = res._id;

					res = await conn.postOrPut('Person', {organizations: [org1Id]});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {organizations: [org1Id, org2Id]});
					let person2Id = res._id;

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id, org2Id]);

					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id, person2Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person2Id]);
				});

				it('should create ManyToMany relation from slave', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;

					res = await conn.postOrPut('Organization', {members: [person1Id]});
					let org1Id = res._id;
					res = await conn.postOrPut('Organization', {members: [person1Id, person2Id]});
					let org2Id = res._id;

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id, org2Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);

					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id, person2Id]);
				});

				it('should update ManyToMany relation from master', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;
					res = await conn.postOrPut('Organization', {});
					let org1Id = res._id;
					res = await conn.postOrPut('Organization', {});
					let org2Id = res._id;

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);

					res = await conn.postOrPut('Person', {_id: person1Id, organizations: [org1Id]});
					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);

					res = await conn.postOrPut('Person', {_id: person2Id, organizations: [org1Id, org2Id]});
					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id, org2Id]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id, person2Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([org2Id]);

					res = await conn.postOrPut('Person', {_id: person2Id, organizations: [org2Id]});
					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([org2Id]);
				});

				it('should update ManyToMany relation from slave', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;
					res = await conn.postOrPut('Organization', {});
					let org1Id = res._id;
					res = await conn.postOrPut('Organization', {});
					let org2Id = res._id;

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);

					res = await conn.postOrPut('Organization', {_id: org1Id, members: [person1Id]});
					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);

					res = await conn.postOrPut('Organization', {_id: org2Id, members: [person1Id, person2Id]});
					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id, org2Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id, person2Id]);

					res = await conn.postOrPut('Organization', {_id: org2Id, members: [person2Id]});
					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org1Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person2Id]);
				});
			}); 

			describe('#delete', () => {
				it('should delete item that is OneToOne relation master', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Resume', {owner: personId});
					let resumeId = res._id;

					res = await conn.delete('Resume', {_id: resumeId});
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res[0]).to.have.property('resume', null);					
				});

				it('should delete item that is OneToOne relation slave', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Resume', {owner: personId});
					let resumeId = res._id;
					
					res = await conn.delete('Person', {_id: personId});
					res = await conn.get('Person', {_id: personId, resume: undefined});
					expect(res).to.have.length(0);
					res = await conn.get('Resume', {_id: resumeId, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
				});

				it('should delete item that is ManyToOne relation master', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Email', {owner: personId});
					let email1Id = res._id;
					res = await conn.postOrPut('Email', {owner: personId});
					let email2Id = res._id;

					res = await conn.delete('Email', {_id: email1Id});
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', personId);
					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res[0]).to.have.property('emails').that.has.members([email2Id]);
				});

				it('should delete item that is OneToMany relation slave', async () => {
					//debugOn();
					let res;

					res = await conn.postOrPut('Person', {});
					let personId = res._id;
					res = await conn.postOrPut('Email', {owner: personId});
					let email1Id = res._id;
					res = await conn.postOrPut('Email', {owner: personId});
					let email2Id = res._id;

					res = await conn.delete('Person', {_id: personId});
					res = await conn.get('Email', {_id: email1Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Email', {_id: email2Id, owner: undefined});
					expect(res[0]).to.have.property('owner', null);
					res = await conn.get('Person', {_id: personId, emails: undefined});
					expect(res).to.be.empty;
				});

				it('should delete item that is ManyToMany relation master', async () => {
					let res;

					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;
					res = await conn.postOrPut('Organization', {members: [person1Id]});
					let org1Id = res._id;
					res = await conn.postOrPut('Organization', {members: [person1Id, person2Id]});
					let org2Id = res._id;

					res = await conn.delete('Organization', {_id: org1Id});

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person1Id, person2Id]);

					res = await conn.delete('Organization', {_id: org2Id});

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res).to.be.empty;

				});

				it('should delete item that is ManyToMany relation slave', async () => {
					let res;

					res = await conn.postOrPut('Person', {});
					let person1Id = res._id;
					res = await conn.postOrPut('Person', {});
					let person2Id = res._id;
					res = await conn.postOrPut('Organization', {members: [person1Id]});
					let org1Id = res._id;
					res = await conn.postOrPut('Organization', {members: [person1Id, person2Id]});
					let org2Id = res._id;

					res = await conn.delete('Person', {_id: person1Id});

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res[0]).to.have.property('organizations').that.has.members([org2Id]);
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([person2Id]);

					res = await conn.delete('Person', {_id: person2Id});

					res = await conn.get('Person', {_id: person1Id, organizations: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Person', {_id: person2Id, organizations: undefined});
					expect(res).to.be.empty;
					res = await conn.get('Organization', {_id: org1Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);
					res = await conn.get('Organization', {_id: org2Id, members: undefined});
					expect(res[0]).to.have.property('members').that.has.members([]);

				});
			});
		});
	});
});
