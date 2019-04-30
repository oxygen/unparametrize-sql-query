const exec = require("child_process").exec;



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
})();
