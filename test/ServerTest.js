import chai, {expect} from 'chai';
import Server from '../src/Server';
import request from 'request';

let PORT = 9999;

describe('Server.js', () => {

	async function req(opt) {
		return new Promise((res, rej) => {
			request(opt, (error, response, body) => {
				if(error)
					rej(error);
				res(response, body);
			});
		});
	}

	describe('#start() / #stop()', () => {
		it('should start ans stop server', async () => {
			let server = new Server();
			await server.start(PORT);
			await server.stop();
		});	
	});

	describe('HTTP', () => {
		let server = new Server();
		beforeEach(async () => {
			await server.start(PORT);
		});
		afterEach(async () => {
			await server.stop(PORT);
		});

		describe('#GET /', () => {
			it('should get the server status', async () => {
				let response = await req({method: 'GET', url: 'http://localhost:9999', json: true});
				expect(response.statusCode).be.equal(200);
				expect(response.body).to.have.property('status', 'ok');
			});
		});
	});
});