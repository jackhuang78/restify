import chai, {expect} from 'chai';
import Server from '../src/Server';

let PORT = 9999;

describe('Server.js', () => {
	describe('#start() / #stop()', () => {
		it('should start ans stop server', async () => {
			let server = new Server(PORT);
			await server.start(PORT);
			await server.stop();
		});	
	});
});