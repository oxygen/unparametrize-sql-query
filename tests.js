const highlight = require("cli-highlight").highlight;
const diff = require("cli-diff").default;
const chalk = require("chalk");

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


function assertEqualSQL(strSQLExpected, strSQLToTest)
{
	// Visual Studio Code ruins indent on empty lines and removes whitespaces from all around automatically. Can't test without a bit of leading and trailling whitespace trimming.
	assert.strictEqual(
		strSQLToTest.replace(/^[\t ]+|[\t ]+$/gm, "").trim().toLowerCase(), 
		strSQLExpected.replace(/^[\t ]+|[\t ]+$/gm, "").trim().toLowerCase(), 
		"\n" + (`
		${highlight(strSQLExpected, {language: "SQL", ignoreIllegals: false})}
			

${chalk.red("!==")}
			
		${highlight(strSQLToTest, {language: "SQL", ignoreIllegals: false})}
			
${chalk.red("nDiff:")}

			
			${diff(
				strSQLToTest.replace(/^[\t ]+|[\t ]+$/gm, "").trim().toLowerCase(), 
				strSQLExpected.replace(/^[\t ]+|[\t ]+$/gm, "").trim().toLowerCase()
			)}
		`.replace(/^\t|^(    ){1}/mg, "").trim())
		// SQL in this file generally has an indent of 1 tab (or 4 spaces).
	);
}


const strMySQLQuery = /*sql*/`
	SELECT
		*
	FROM
	(
		SELECT
			-- One line comment with /* stream comment inside of it */ and another right after -- I want my independence
			DISTINCT unique_random_numbers_anyway,
			(
				SELECT  
					COUNT(*),
					*
				FROM whatever
				FORCE INDEX (bigger_than_the_table_itself)
			),
			@var_Name := CONCAT('''', "'abc'", "/*' -- Hello'*/", '\r\n\t -- line comment inside string? It can''t be. /* block comment */ '''' '),
			'"/*''\r\n\t*/"', -- Confusing start of block comment: /*
			-3 + (-9) - - 3 + ( -    99 + 2 % -5 | 333 ~999&111111111 * -0.00  *  +   33 >> +123 << ++321.22) ^ 0xAFe0 AS ${"`"}Computer error 123${"`"}
		FROM users /* Why do we have stream comments? */
		LEFT JOIN something ON something.user_id = users.user_id
		WHERE
			-- We joined you to kill you. TROJAN JOIN
			something.user_id IS NULL

			AND	-1=-+-+-++-1
			AND -1=-+-+-++1
			
			AND	${"`"}quoted_name${"`"}='2019-12-12'
			OR${"`"}quoted_name${"`"} >= '2019-12-12T12:34:56Z'

			-- NOT IN and IN may vary in number of elements dynamically for the same query, usually when they don't contain any subqueries.
			OR xxx NOT IN ( - 999, 'AAA', -59)
			AND zzz not in ('a', -12.9999, 0xAFED13, (select name from cache limit 1), 0, column_name)
			
			AND	-user_id = -123 -- That minus sign must be gone. Only questions must remain. Except for the name which must keep the minus sign.
			AND	wage > 0.1
			
			AND	name LIKE '%I will become a question mark% start of block comment: /*'
		ORDER BY
			user_date_created DESC /* 
			Multi-line comment means importance!
			ortance...
			tance...
			sss...
		*/
		LIMIT 1460 /* LIMIT HERE? */ -- Noooo!

		UNION -- ALL

		SELECT
			${"`"}database name with spaces${"`"}./*What am I?*/${"`"}012345799${"`"}
		FROM xxxx
	)
	ORDER BY FIELD(user_phone_call_uniqueid, 'abc', 'def', 'xxx', 1, -1)
`;

let strControlSQL_keepWhiteSpace_MySQL = /*sql*/`
	SELECT
		*
	FROM
	(
		SELECT

			DISTINCT unique_random_numbers_anyway,
			(
				SELECT  
					COUNT(*),
					*
				FROM whatever
				FORCE INDEX (bigger_than_the_table_itself)
			),
			@var_Name := CONCAT(?, ?, ?, ?),
			?,
			? + (?) - ? + ( ? + ? % ? | ? ~?&? * ?  *  +   ? >> +? << ++?) ^ ? AS ${"`"}Computer error 123${"`"}
		FROM users
		LEFT JOIN something ON something.user_id = users.user_id
		WHERE

			something.user_id IS NULL

			AND	?=-+-+-++?
			AND ?=-+-+-++?
			
			AND	${"`"}quoted_name${"`"}=?
			OR${"`"}quoted_name${"`"} >= ?


			OR xxx NOT IN (?)
			AND zzz not in (?, ?, ?, (select name from cache limit ?), ?, column_name)

			AND	-user_id = ?
			AND	wage > ?
			
			AND	name LIKE ?
		ORDER BY
			user_date_created DESC
		LIMIT ?

		UNION

		SELECT
			${"`"}database name with spaces${"`"}.${"`"}012345799${"`"}
		FROM xxxx
	)
	ORDER BY FIELD(user_phone_call_uniqueid, ?)
`;

const strControlSQL_stripWhiteSpace_MySQL = /*sql*/`SELECT * FROM ( SELECT DISTINCT unique_random_numbers_anyway, ( SELECT COUNT(*), * FROM whatever FORCE INDEX (bigger_than_the_table_itself) ), @var_Name := CONCAT(?, ?, ?, ?), ?, ? + (?) - ? + ( ? + ? % ? | ? ~?&? * ? * + ? >> +? << ++?) ^ ? AS ${"`"}Computer error 123${"`"} FROM users LEFT JOIN something ON something.user_id = users.user_id WHERE something.user_id IS NULL AND ?=-+-+-++? AND ?=-+-+-++? AND ${"`"}quoted_name${"`"}=? OR${"`"}quoted_name${"`"} >= ? OR xxx NOT IN (?) AND zzz not in (?, ?, ?, (select name from cache limit ?), ?, column_name) AND -user_id = ? AND wage > ? AND name LIKE ? ORDER BY user_date_created DESC LIMIT ? UNION SELECT ${"`"}database name with spaces${"`"}.${"`"}012345799${"`"} FROM xxxx ) ORDER BY FIELD(user_phone_call_uniqueid, ?)`;

const strOutputSQL_keepWhiteSpace_MySQL = unparametrize_sql_query(strMySQLQuery, {bStripWhiteSpace: false, bReduceEnumsToOneElement: true});
const strOutputSQL_stripWhiteSpace_MySQL = unparametrize_sql_query(strMySQLQuery, {bStripWhiteSpace: true, bReduceEnumsToOneElement: true});

assertEqualSQL(strControlSQL_keepWhiteSpace_MySQL, strOutputSQL_keepWhiteSpace_MySQL);
assertEqualSQL(strControlSQL_stripWhiteSpace_MySQL, strOutputSQL_stripWhiteSpace_MySQL);

console.log("\x1b[32mTests passed.\x1b[0m");
