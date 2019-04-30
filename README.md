# Unparametrize SQL query

[![Version npm](https://img.shields.io/npm/v/unparametrize-sql-query.svg)](https://www.npmjs.com/package/unparametrize-sql-query)

[![Linux build](https://travis-ci.org/oxygen/unparametrize-sql-query.svg?branch=master)](https://travis-ci.org/oxygen/unparametrize-sql-query)

Removes string literals, number constants, comments and excess whitespace from an SQL **in one pass**. The removed string literals and number constants are replaced with `'?'` and `?` respectively.

The goal is to reduce a query to a unique (common) form which could be used, for example, to keep performance counters per query (just like MySQL Performance Reports does).

This project was written as a support library for per process performance counters because the MySQL Performance Schema is disabled in Google Cloud SQL.

## Installation:

### Node.js
```shell
npm i unparametrize-sql-query
```

### Browser
(if you don't have a build system):
```html
<script src="/node_modules/unparametrize-sql-query/dist/browser/unparametrize-sql-query.js"></script>
```

## Usage

See [index.js](./index.js) for options.

### Node.js
```JavaScript
const unparametrize_sql_query = require("unparametrize-sql-query");

const unparametrizedSQL = unparametrize_sql_query("SELECT 123 FROM table");

console.log(unparametrizedSQL);
```

### Browser
```html
<script>
// The function is exported on window.
console.log(unparametrize_sql_query("SELECT 123 FROM table"));
</script>
```

## Example
#### Input
```sql
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
		-3 + (-9) - - 3 + ( -    99 + 2 % -5 | 333 ~999&111111111 * -0.00  *  +   33 >> +123 << ++321.22) ^ 0xAFe0 AS `Computer error 123`
	FROM users /* Why do we have stream comments? */
	LEFT JOIN something ON something.user_id = users.user_id
	WHERE
		-- We joined you to kill you. TROJAN JOIN
		something.user_id IS NULL

		AND	-1=-+-+-++-1
		AND -1=-+-+-++1
		
		AND	`quoted_name`='2019-12-12'
		OR`quoted_name` >= '2019-12-12T12:34:56Z'

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
		`database name with spaces`./*What am I?*/`012345799`
	FROM xxxx
)
ORDER BY FIELD(user_phone_call_uniqueid, 'abc', 'def', 'xxx', 1, -1)
```

#### Output
```sql
SELECT * FROM ( SELECT DISTINCT unique_random_numbers_anyway, ( SELECT COUNT(*), * FROM whatever FORCE INDEX (bigger_than_the_table_itself) ), @var_Name := CONCAT(?, ?, ?, ?), ?, ? + (?) - ? + ( ? + ? % ? | ? ~?&? * ? * + ? >> +? << ++?) ^ ? AS `Computer error 123` FROM users LEFT JOIN something ON something.user_id = users.user_id WHERE something.user_id IS NULL AND ?=-+-+-++? AND ?=-+-+-++? AND `quoted_name`=? OR`quoted_name` >= ? OR xxx NOT IN (?) AND zzz not in (?, ?, ?, (select name from cache limit ?), ?, column_name) AND -user_id = ? AND wage > ? AND name LIKE ? ORDER BY user_date_created DESC LIMIT ? UNION SELECT `database name with spaces`.`012345799` FROM xxxx ) ORDER BY FIELD(user_phone_call_uniqueid, ?)
```

#### Output with whitespace preserved
```sql
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
		? + (?) - ? + ( ? + ? % ? | ? ~?&? * ?  *  +   ? >> +? << ++?) ^ ? AS `Computer error 123`
	FROM users
	LEFT JOIN something ON something.user_id = users.user_id
	WHERE

		something.user_id IS NULL

		AND	?=-+-+-++?
		AND ?=-+-+-++?
		
		AND	`quoted_name`=?
		OR`quoted_name` >= ?


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
		`database name with spaces`.`012345799`
	FROM xxxx
)
ORDER BY FIELD(user_phone_call_uniqueid, ?)
```
