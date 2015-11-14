import assert from 'assert';
import {expect} from 'chai';

import Restify from '../src/Restify';

let config = {
	database: {host: 'localhost', user: 'root', pass: '', db: 'restify'},
	schema: {
		Person: {
			name: {type: 'string', nullable: false},
			gender: {type: 'enum', values: ['male', 'female']},
			dateOfBirth: {type: 'date'}
		},
		Email: {
			address: {type: 'string', nullable: false},
			owner: {type: 'Person',	relation: 'manyToOne', mappedBy: 'emails'}
		},
		Organization: {
			name: {type: 'string'},
			members: {type: 'Person', relation: 'manyToMany', mappedBy: 'organization'}
		}
	}
};

describe('Restify', () => {

	describe('# constructor()', () => {
		it('should instanciate', (done) => {
			let restify = new Restify(config);
			expect(restify).to.be.not.null;
			expect(restify.database).to.deep.equal(config.database);
			
			expect(restify.collections()).to.include('Person');
			expect(restify.collections()).to.include('Email');
			expect(restify.collections()).to.include('Organization');

			expect(restify.fields('Person')).to.include('name');
			expect(restify.fields('Person')).to.include('gender');
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

});