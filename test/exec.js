import {exec} from 'child_process';
import dbConfig from './config.json';

let execCmd = async (cmd) => {
	return new Promise((res, rej) => {
		exec(cmd, (err, stdout, stderr) => {
			if(err) {
				return rej(err);
			} else {
				return res(stdout);
			}
		});
	});
};

let execSql = async (sql) => {
	if(!sql instanceof Array)
		sql = [sql];
	return await execCmd(`mysql -u ${dbConfig.user} -e "${sql.join(';')}"`);
};

export {execCmd, execSql};