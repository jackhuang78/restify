import {exec} from 'child_process';
import fs from 'fs';
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
	if(!(sql instanceof Array))
		return await execCmd(`mysql -v -u ${dbConfig.user} -e "${sql}"`);
	else
		return await execCmd(`mysql -v -u ${dbConfig.user} -e "${sql.join(';')}"`); 
};

let execSqlFile = async (fn) => {
	return await execCmd(`mysql -u ${dbConfig.user} < ${fn}`);
};

export {execCmd, execSql, execSqlFile};