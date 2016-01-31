DROP DATABASE restify;
CREATE DATABASE restify;
USE restify;

CREATE TABLE Plan(
	id int NOT NULL AUTO_INCREMENT, PRIMARY KEY(id),
	name varchar(20) NOT NULL, UNIQUE KEY(name),
	monthly_fee decimal(5,2)
);

CREATE TABLE User(
	id int NOT NULL AUTO_INCREMENT, PRIMARY KEY(id),
	username varchar(20) NOT NULL, UNIQUE KEY(username),
	plan_id int, FOREIGN KEY(plan_id) REFERENCES Plan(id)
);

CREATE TABLE Repository(
	id int NOT NULL AUTO_INCREMENT, PRIMARY KEY(id),
	name varchar(20) NOT NULL, UNIQUE KEY(name),
	description varchar(100),
	public boolean,
	created date NOT NULL,
	owner_id int, FOREIGN KEY(owner_id) REFERENCES User(id)
);

CREATE TABLE Contribution(
	repo_id int NOT NULL, FOREIGN KEY(repo_id) REFERENCES Repository(id),
	user_id int NOT NULL, FOREIGN KEY(user_id) REFERENCES User(id),
	PRIMARY KEY(repo_id, user_id),
	role varchar(20) NOT NULL
);

