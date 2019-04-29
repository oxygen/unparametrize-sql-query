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
		*
	FROM
	(
		SELECT
			-- One line comment with /* stream comment inside of it */ and another right after -- I want my independence
			DISTINCT unique_random_numbers_anyway,
			(
				SELECT  
					*
				FROM whatever
				FORCE INDEX (bigger_than_the_table_itself)
			),
			@var_Name := '',
			1 / 0 * 3, -- Division by zero?,
			111 / 0 * 333, -- Division by zero?,
			-5 / -1000.11 +3,
			-999,
			1 + (-9) - 3 + ( -    99),
			0xAFE0 AS I_AM_A_blob,
			COUNT(*), -- is this allowed here anyway?,
			CONCAT('', 'aaaa', 'bbbb', 1234)
		FROM users /* Why do we have stream comments? */
		LEFT JOIN something ON something.user_id = users.user_id
		WHERE
			1=1
			AND\t${"`"}quoted_name${"`"}='2019-12-12'

			AND
			1=1

			OR${"`"}quoted_name${"`"} >= '2019-12-12T12:34:56Z'

			-- NOT IN and IN may vary in number of elements dynamically for the same query, usually when they don't contain any subqueries.
			OR xxx NOT IN ( - 999, 'AAA', -59)

			AND zzz not in ('a', -12.9999, 0xAFED13, (select name from cache limit 1), 0, column_name)

			AND
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
	)
	ORDER BY
		ORDER BY FIELD(user_phone_call_uniqueid, 'abc', 'def', 'xxx', 1, -1)
`, {bThrowOnSyntaxError: true});

const strControlValue_MySQL = "SELECT * FROM ( SELECT DISTINCT unique_random_numbers_anyway, ( SELECT * FROM whatever FORCE INDEX (bigger_than_the_table_itself) ), @var_Name := ?, ? / ? * ?, ? / ? * ?, ? / ? +?, ?, ? + (?) - ? + ( ?), ? AS I_AM_A_blob, COUNT(*), CONCAT(?, ?, ?, ?) FROM users LEFT JOIN something ON something.user_id = users.user_id WHERE ?=? AND `quoted_name`=? AND ?=? OR`quoted_name` >= ? OR xxx NOT IN ( ?, ?, ?) AND zzz not in (?, ?, ?, (select name from cache limit ?), ?, column_name) AND something.user_id IS NULL AND user_id = ? AND wage > ? AND name LIKE ? ORDER BY user_date_created DESC LIMIT ? UNION SELECT `database name with spaces`.`012345799` FROM xxxx ) ORDER BY ORDER BY FIELD(user_phone_call_uniqueid, ?, ?, ?, ?, ?)";
assert.strictEqual(strOutputSQL_MySQL, strControlValue_MySQL, `${strOutputSQL_MySQL} !== ${strControlValue_MySQL}`);


assert.strictEqual(unparametrize_sql_query("NOT IN (-19, '333', 33)", {bReduceEnumsToOneElement: true}), "NOT IN (?)");

// Identifier next to IN without space.
assert.strictEqual(unparametrize_sql_query("`column_name`in (-19, '333', 33)", {bReduceEnumsToOneElement: true}), "`column_name`in (?)");

assert.strictEqual(unparametrize_sql_query("ORDER BY FIELD (column_name, -19, '333', 33)", {bReduceEnumsToOneElement: true}), "ORDER BY FIELD (column_name, ?)");


console.log("\x1b[32mTests passed.\x1b[0m");
