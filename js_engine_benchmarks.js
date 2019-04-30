const assert = require("assert");
const exec = require("child_process").exec;

const unparametrize_sql_query = require("./index");


// Regex is amazingly slow next to Array.includes() for single character match.

// Without regex reuse:
// single character match with regex:  130  milliseconds
// single character match with Array.prototype.includes():  7  milliseconds
// single character match with regex:  129  milliseconds
// single character match with Array.prototype.includes():  5  milliseconds
// single character match with regex:  128  milliseconds
// single character match with Array.prototype.includes():  4  milliseconds
// single character match with regex:  131  milliseconds
// single character match with Array.prototype.includes():  5  milliseconds

// With compiled regex reuse and lastIndex reset: 
// single character match with regex:  84  milliseconds
// single character match with Array.prototype.includes():  7  milliseconds
// single character match with regex:  87  milliseconds
// single character match with Array.prototype.includes():  5  milliseconds
// single character match with regex:  85  milliseconds
// single character match with Array.prototype.includes():  5  milliseconds
// single character match with regex:  85  milliseconds
// single character match with Array.prototype.includes():  5  milliseconds


// Theoretically regex would win over handcode.
// However, given that 3 times more regexes are needed (maybe even more, maybe impossible to do with regex)
// to work around chickens and the eggs traps (
//  - one line comments delimiter inside block comments, 
//  - block comments delimiter or end inside one line comments, 
//  - single quote delimiter inside double quote strings and vice versa, 
//  - identifier delimiters inside strings, and so on)
// ** REGEX WOULD BE SLOWER (because too many passes), not faster given these results. ** (IF IT COULD EVEN BE DONE)
// 
// unparametrize_sql_query_regex:  1120  milliseconds
// unparametrize_sql_query:  2315  milliseconds
// unparametrize_sql_query_regex:  1134  milliseconds
// unparametrize_sql_query:  2329  milliseconds
// unparametrize_sql_query_regex:  1132  milliseconds
// unparametrize_sql_query:  2300  milliseconds


// It appears charAt and split are evenly matched, while the array access operator [] is much faster in NodeJS v11.7.9, Intel CPU i7 4470k @ 3.5GHz.

// split then iterate:  3018  milliseconds
// charAt inside iteration:  2676  milliseconds
// [] operator inside iteration:  2642  milliseconds
// split then iterate:  3114  milliseconds
// charAt inside iteration:  3017  milliseconds
// [] operator inside iteration:  2440  milliseconds
// split then iterate:  2742  milliseconds
// charAt inside iteration:  2542  milliseconds
// [] operator inside iteration:  2950  milliseconds
// split then iterate:  2948  milliseconds
// charAt inside iteration:  2876  milliseconds
// [] operator inside iteration:  2350  milliseconds

// They're all the same, no clear winner.

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



const regexOneLineComments = /--[\s]{1}.*$/gm;
const regexEscapedStringDelimiters = /((\'\')+|(\\\'))|((\"\")+|(\\\"))/g;
const regexStrings = /(\'[^']{0,}\')|(\"[^"]{0,}\")/g;
const regexNumbers = /([-]{1}[\s]{0,})?((0x)[A-F0-9]+|([0-9]+((\.){1}[0-9e\-]+)?))/gi;
const regexBlockComments = /\/\*[^*]+\*\//g;
const regexStripWhiteSpace = /[\s]+/g;


const strMySQLQuery = /*sql*/`
	-- Chicken and the egg traps disabled throughout the query because the regexes above can't handle them.
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
			@var_Name := CONCAT('', 'abc', "/ * - - Hello* /", '\r\n\t - - line comment inside string? It cant be. / * block comment * / '),
			'  / *\r\n\t* /"', -- Confusing start of block comment: /*
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
			
			AND	name LIKE '%I will become a question mark% start of block comment: / *'
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



function unparametrize_sql_query_regex(
	strSQL,
	{
		// MySQL doesn't use ANSI double quotes as identifier delimiter by default.
		bANSIDoubleQuotes = false, 
		
		// ` is the default delimiter in MySQL, and MySQL is the most used database in the world.
		strIdentifierDelimiter = "`", 

		// Turn off to keep the query formatting.
		bStripWhiteSpace = true, 
		
		// Turn off if expecting lots of syntax errors.
		// bWriteSyntaxErrorsToConsole = true, 

		// You may turn this off for performance reasons (avoid a try catch).
		// bThrowOnSyntaxError = true,

		// Wether to add string quotes like MySQL Performance Schema does: '?' instead of ?.
		bAddRemovedStringQuotes = false,

		// NOT IN (1, 2, 3, 4) could very well be NOT IN (1, 2, 3, 4, 5, 6) for the same query on subsequent executions. Performance counters would be counted separately.
		// If true, IN (1, 2, 3, 4) becomes IN (?) instead of IN (?, ?, ?, ?).
		// However, IN (1, 2, 3, column_name) is untouched and becomes IN (?, ?, ?, column_name).
		// Also, IN (1, 2, 3, (SELECT column_name FROM table LIMIT 1)) is untouched and becomes IN (?, ?, ?, (SELECT column_name FROM table LIMIT ?)).
		// The same applies to ORDER BY FIELD.
		// If true, a second pass is made with a replace regex.
		bReduceEnumsToOneElement = false
	} = {}
)
{
	// Can't support this with regex, because strings removal has to happen after escaped string delimiters removal.
	// Unless doing 3 extra passes and using an intermediary special character.
	assert(!bAddRemovedStringQuotes); 

	assert(!bANSIDoubleQuotes);
	assert(strIdentifierDelimiter === "`");
	assert(bStripWhiteSpace);

	// Off for the purposes of benchmarking to not benchmark regex vs regex.
	assert(!bReduceEnumsToOneElement);

	regexOneLineComments.lastIndex = 0;
	regexEscapedStringDelimiters.lastIndex = 0;
	regexStrings.lastIndex = 0;
	regexNumbers.lastIndex = 0;
	regexBlockComments.lastIndex = 0;
	regexStripWhiteSpace.lastIndex = 0;

	return strSQL
		.replace(regexOneLineComments, "")
		.replace(regexEscapedStringDelimiters, "?")
		.replace(regexBlockComments, "") // strings which contain a block comment start will confuse the regex

		// At this point the query size is greatly reduced because of incorrect truncation, if the regex fell into the traps.
		// For the purposes of benchmark, the traps are removed in the above query.

		.replace(regexStrings, "?") // block comments which contain a string start will confuse the regex if before the blocks comments removal.
		.replace(regexNumbers, "?")
		.replace(regexStripWhiteSpace, " ")
	;

	// Regex just can't win at actually working, the above fails the interleaved traps of unterminated block comment delimiters, string delimiters and identifier delimiters.
}


function benchmark_unparametrize_sql_query_regex()
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	let nIterations = Math.pow(2, 15);
	while(--nIterations)
	{
		unparametrize_sql_query_regex(strMySQLQuery);
	}

	console.log("unparametrize_sql_query_regex: ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");
}


function benchmark_unparametrize_sql_query()
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	let nIterations = Math.pow(2, 15);
	while(--nIterations)
	{
		unparametrize_sql_query(strMySQLQuery);
	}

	console.log("unparametrize_sql_query: ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");
}


function benchmark_split(strBenchmarkInput)
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	const arrCharacters = strBenchmarkInput.split("");
	let strOutput = "";
	for(let i = 0; i < arrCharacters.length; i++)
	{
		strOutput += arrCharacters[i];
	}

	console.log("split then iterate: ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");

	return strOutput;
}


function benchmark_charAt(strBenchmarkInput)
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	let strOutput = "";
	for(let i = 0; i < strBenchmarkInput.length; i++)
	{
		strOutput += strBenchmarkInput.charAt(i);
	}

	console.log("charAt inside iteration: ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");

	return strOutput;
}


function benchmark_accessOperator(strBenchmarkInput)
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	let strOutput = "";
	for(let i = 0; i < strBenchmarkInput.length; i++)
	{
		strOutput += strBenchmarkInput[i];
	}

	console.log("[] operator inside iteration: ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");

	return strOutput;
}


async function runCLICommand(strCommand)
{
	console.log(strCommand);
	const processCommand = exec(strCommand);
	processCommand.stdout.pipe(process.stdout);
	processCommand.stderr.pipe(process.stderr);
	return new Promise( (fnResolve, fnReject) => {
		processCommand.on("error", fnReject);
		processCommand.on("exit", (nCode) => {
			if(nCode === 0)
			{
				fnResolve();
			}
			else
			{
				fnReject(new Error("Failed with error code " + nCode));
			} 
		});
	});
}


function benchmark_regex_characterMatch()
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	let nIterations = Math.pow(2, 23);

	const regex = /\+\-\/\*\%\&\~\|\^\(\,/;
	while(--nIterations)
	{
		regex.lastIndex = 0;
		regex.test(",");
	}

	console.log("single character match with regex: ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");
}


function benchmark_array_characterMatch()
{
	const nStartUnixTimestampMilliseconds = new Date().getTime();

	let nIterations = Math.pow(2, 23);

	while(--nIterations)
	{
		["+", "-", "/", "*", "%", "&", "~", "|", "^", "(", ","].includes(",");
	}

	console.log("single character match with Array.prototype.includes(): ", new Date().getTime() - nStartUnixTimestampMilliseconds, " milliseconds");
}


(async() => {
	let strBenchmarkInput = "";
	for(let i = 0; i < Math.pow(2, 24); i++)
	{
		strBenchmarkInput += "x";
	}


	if(process.platform === "win32")
	{
		await runCLICommand(`wmic process where "ProcessID=${process.pid}" CALL setpriority 32768`);
	}
	else if(process.platform === "linux")
	{
		await runCLICommand(`renice -n -1 -p ${process.pid}`);
	}

	
	// benchmark_split(strBenchmarkInput);
	// benchmark_charAt(strBenchmarkInput);
	// benchmark_accessOperator(strBenchmarkInput);
	// benchmark_split(strBenchmarkInput);
	// benchmark_charAt(strBenchmarkInput);
	// benchmark_accessOperator(strBenchmarkInput);
	// benchmark_split(strBenchmarkInput);
	// benchmark_charAt(strBenchmarkInput);
	// benchmark_accessOperator(strBenchmarkInput);
	// benchmark_split(strBenchmarkInput);
	// benchmark_charAt(strBenchmarkInput);
	// benchmark_accessOperator(strBenchmarkInput);

	benchmark_regex_characterMatch();
	benchmark_array_characterMatch();
	benchmark_regex_characterMatch();
	benchmark_array_characterMatch();
	benchmark_regex_characterMatch();
	benchmark_array_characterMatch();
	benchmark_regex_characterMatch();
	benchmark_array_characterMatch();


	benchmark_unparametrize_sql_query_regex();
	benchmark_unparametrize_sql_query();
	benchmark_unparametrize_sql_query_regex();
	benchmark_unparametrize_sql_query();
	benchmark_unparametrize_sql_query_regex();
	benchmark_unparametrize_sql_query();
})();
