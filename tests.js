const unparametrize_sql_query = require("./index");

const assert = require("assert");


process.on(
	"unhandledRejection", 
	(reason, promise) => {
		console.log("[" + process.pid + "] Unhandled Rejection at: Promise", promise, "reason", reason);
		
		process.exit(1);
	}
);

process.on(
	"uncaughtException", 
	(error) => {
		console.log("[" + process.pid + "] Unhandled exception.");
		console.error(error);
		
		process.exit(1);
	}
);


const strOutputSQL_MySQL = unparametrize_sql_query(/*sql*/ `
	SELECT
		-- One line comment with /* stream comment inside of it */ and another right after -- I want my independence
		DISTINCT unique_random_numbers_anyway,
		(
			SELECT  
				*
			FROM whatever
			FORCE INDEX (bigger_than_the_table_itself)
		),
		1 / 0 * 3, -- Division by zero?,
		111 / 0 * 333, -- Division by zero?,
		0xAFE0 AS I_AM_A_blob,
		COUNT(*), -- is this allowed here anyway?,
		CONCAT('', 'aaaa', 'bbbb', 1234)
	FROM users /* Why do we have stream comments? */
	LEFT JOIN something ON something.user_id = users.user_id
	WHERE
		-- We joined you to leave you
		something.user_id IS NULL
		
		AND
		user_id = 123

		AND
		wage > 0.1
		
		AND
		name LIKE '%this will be stripped%'
	ORDER BY
		user_date_created DESC /* 
		Multi-line comment means importance!
		Right?
		Right?!
	*/
	LIMIT 1460 /* LIMIT HERE? */ -- Noooo!

	UNION -- ALL

	SELECT
		${"`"}database name with spaces${"`"}./*table name with numbers*/${"`"}012345799${"`"}
	FROM xxxx
`, {bThrowOnSyntaxError: true});

const strControlValue_MySQL = "SELECT DISTINCT unique_random_numbers_anyway, ( SELECT * FROM whatever FORCE INDEX (bigger_than_the_table_itself) ), ? / ? * ?, ? / ? * ?, ? AS I_AM_A_blob, COUNT(*), CONCAT('?', '?', '?', ?) FROM users LEFT JOIN something ON something.user_id = users.user_id WHERE something.user_id IS NULL AND user_id = ? AND wage > ? AND name LIKE '?' ORDER BY user_date_created DESC LIMIT ? UNION SELECT `database name with spaces`.`012345799` FROM xxxx";
assert.strictEqual(strOutputSQL_MySQL, strControlValue_MySQL, `${strOutputSQL_MySQL} !== ${strControlValue_MySQL}`);


console.log("\x1b[32mTests passed.\x1b[0m");
