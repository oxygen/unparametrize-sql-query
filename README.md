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

See `index.js` for options.

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
	`database name with spaces`./*table name with numbers*/`012345799`
FROM xxxx
```

#### Output
```sql
SELECT DISTINCT unique_random_numbers_anyway, ( SELECT * FROM whatever FORCE INDEX (bigger_than_the_table_itself) ), ? / ? * ?, ? / ? * ?, ? AS I_AM_A_blob, COUNT(*), CONCAT('?', '?', '?', ?) FROM users LEFT JOIN something ON something.user_id = users.user_id WHERE something.user_id IS NULL AND user_id = ? AND wage > ? AND name LIKE '?' ORDER BY user_date_created DESC LIMIT ? UNION SELECT `database name with spaces`.`012345799` FROM xxxx
```

#### Output with whitespace preserved
```sql
SELECT
	DISTINCT unique_random_numbers_anyway,
	(
		SELECT
			*
		FROM whatever
		FORCE INDEX (bigger_than_the_table_itself)
	),
	? / ? * ?,
	? / ? * ?,
	? AS I_AM_A_blob,
	COUNT(*),
	CONCAT('?', '?', '?', ?)
FROM users
LEFT JOIN something ON something.user_id = users.user_id
WHERE
	something.user_id IS NULL

	AND
	user_id = ?

	AND
	wage > ?

	AND
	name LIKE '?'
ORDER BY
	user_date_created DESC
LIMIT ?

UNION

SELECT
	`database name with spaces`.`012345799`
FROM xxxx
```
