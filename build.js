const fsp = require("fs").promises;
const fs = require("fs");
const path = require("path");

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


(async() => {
	if(!fs.existsSync(path.join(__dirname, "dist")))
	{
		await fsp.mkdir(path.join(__dirname, "dist"));
	}

	if(!fs.existsSync(path.join(__dirname, "dist/browser")))
	{
		await fsp.mkdir(path.join(__dirname, "dist/browser"));
	}

	const strBrowserFilePath = path.join(__dirname, "dist/browser/unparametrize-sql-query.js");
	
	const strTheOneAndOnlyFile = await fsp.readFile("./index.js", "utf8");
	const strOutputFileContents = strTheOneAndOnlyFile.replace(/module\.exports[^\r\n]+;/g, "");
	await fsp.writeFile(strBrowserFilePath, strOutputFileContents);
})();
