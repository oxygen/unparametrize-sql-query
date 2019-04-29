/**
 * @param {string} strSQL 
 * @param {Object} destructuringObject
 * 
 * @returns {string}
 */
function unparametrize_sql_query(
	strSQL, 
	{
		// MySQL doesn't use ANSI double quotes as identifier delimiter by default.
		bANSIDoubleQuotes = false, 
		
		// ` is the default delimiter in MySQL, and MySQL is the most used database in the world.
		strIdentifierDelimiter = "`", 

		// Turn off to keep the query formatting.
		bStripWhiteSpace = true, 
		
		// Turn off is expecting lots of syntax errors.
		bWriteSyntaxErrorsToConsole = true, 

		// You may turn this off for performance reasons (avoid a try catch).
		bThrowOnSyntaxError = true,

		// Wether to add string quotes like MySQL Performance Schema does: '?' instead of ?.
		bAddRemovedStringQuotes = false,

		// NOT IN (1, 2, 3, 4) could very well be NOT IN (1, 2, 3, 4, 5, 6) for the same query on subsequent executions. Performance counters would be counted separately.
		// If true, IN (1, 2, 3, 4) becomes IN (?) instead of IN (?, ?, ?, ?).
		// However, IN (1, 2, 3, column_name) is untouched and becomes IN (?, ?, ?, column_name).
		// Also, IN (1, 2, 3, (SELECT column_name FROM table LIMIT 1)) is untouched and becomes IN (?, ?, ?, (SELECT column_name FROM table LIMIT ?)).
		// If true, a second pass is made with a replace regex.
		bReduceNotInAndInParamsToOne = false
	} = {}
)
{
	let strOutputSQL = "";

	let bInsideBlockComment = false;
	let strInsideIdentifierDelimiter = false;
	let bInsideNumber = false;
	let bInsideName = false;
	let bInsideLineComment = false;
	let strInsideStringLiteralDelimiter = null;
	
	// Gets set to true only while bStripWhiteSpace is also true.
	let bPreviousWhiteSpace = false;

	let strErrorMessage = "";

	let strExtraIdentifierDelimiter = bANSIDoubleQuotes ? `"` : "`";
	let strExtraStringDelimiter = bANSIDoubleQuotes ? "'" : `"`;

	charactersLoop: 
	for(let i = 0; i < strSQL.length; i++)
	{
		if(strInsideStringLiteralDelimiter)
		{
			// Placeholder for the value that once was.
			strOutputSQL += bAddRemovedStringQuotes ? "'?'" : "?";

			while(
				strSQL[i] !== strInsideStringLiteralDelimiter
				|| (
					i + 1 < strSQL.length
					&& strSQL[i + 1] === strInsideStringLiteralDelimiter
				)
			)
			{
				if(i + 1 >= strSQL.length)
				{
					strErrorMessage = "Syntax error looking for ending string literal delimiter, reached end of string";
					break charactersLoop;
				}
				else if(
					strSQL[i] === "\\"
					|| (
						i + 1 < strSQL.length
						&& strSQL[i] === strInsideStringLiteralDelimiter
						&& strSQL[i + 1] === strInsideStringLiteralDelimiter
					)
				)
				{
					++i;

					if(i + 1 >= strSQL.length)
					{
						strErrorMessage = "Syntax error looking for ending string literal delimiter, reached end of string";
						break charactersLoop;
					}
				}

				++i;
			}

			strInsideStringLiteralDelimiter = null;

			continue;
		}
		else if(strInsideIdentifierDelimiter)
		{
			while(strSQL[i] !== strInsideIdentifierDelimiter)
			{
				strOutputSQL += strSQL[i];

				if(i + 1 >= strSQL.length)
				{
					strErrorMessage = "Syntax error looking for ending identifier delimiter, reached end of string";
					break charactersLoop;
				}

				++i;
			}

			strOutputSQL += strInsideIdentifierDelimiter; // strSQL[i]
			strInsideIdentifierDelimiter = null;

			continue;
		}
		else if(bInsideName)
		{
			let nCharCode = strSQL.charCodeAt(i);

			while(
				(
					nCharCode >= /*A*/ 0x41
					&& nCharCode <= /*Z*/ 0x5A
				)
				|| (
					nCharCode >= /*a*/ 0x61
					&& nCharCode <= /*z*/ 0x7A
				)
				|| (
					nCharCode >= /*0*/ 0x30 
					&& nCharCode <= /*9*/ 0x39
				)
				|| nCharCode === /*_*/ 0x5F
			)
			{
				strOutputSQL += strSQL[i];

				if(i + 1 >= strSQL.length)
				{
					bInsideName = false;
					break charactersLoop;
				}
				
				nCharCode = strSQL.charCodeAt(++i);
			}

			bInsideName = false;
		}
		else if(bInsideNumber)
		{
			let nCharCode = strSQL.charCodeAt(i);
			
			// Placeholder for the value that once was.
			strOutputSQL += "?";

			while(
				(
					nCharCode >= /*0*/ 0x30 
					&& nCharCode <= /*9*/ 0x39
				)
				|| (
					nCharCode >= /*A*/ 0x41
					&& nCharCode <= /*F*/ 0x46
				)
				|| (
					nCharCode >= /*a*/ 0x61
					&& nCharCode <= /*f*/ 0x66
				)
				|| nCharCode === /*.*/ 0x2E
				|| nCharCode === /*x*/ 0x78
			)
			{
				// Strip out of the query.
				// strOutputSQL += strSQL[i];

				if(i + 1 >= strSQL.length)
				{
					bInsideNumber = false;
					break charactersLoop;
				}
				
				nCharCode = strSQL.charCodeAt(++i);
			}

			bInsideNumber = false;
		}
		else if(bInsideBlockComment)
		{
			while(true)
			{
				if(i + 1 >= strSQL.length)
				{
					strErrorMessage = "Syntax error looking for ending block comment delimiter, reached end of string";
					break charactersLoop;
				}
				else if(
					strSQL[i] === "*"
					&& strSQL[i + 1] === "/"
				)
				{
					++i;
					bInsideBlockComment = false;

					continue charactersLoop;
				}
				
				++i;
			}

			throw new Error("Unreacheable code");
		}
		else if(bInsideLineComment)
		{
			while(true)
			{
				if(i + 1 >= strSQL.length)
				{
					break charactersLoop;
				}
				else if(
					strSQL[i] === "\r"
					|| strSQL[i + 1] === "\n"
				)
				{
					bInsideLineComment = false;
					continue charactersLoop;
				}

				// Skip (strip), character is part of comment.
				++i;
			}

			throw new Error("Unreacheable code");
		}


		if(bStripWhiteSpace)
		{
			if(!bPreviousWhiteSpace)
			{
				bPreviousWhiteSpace = strOutputSQL.substr(-1) === " ";
			}

			switch(strSQL[i])
			{
				case " ":
				case "\t":
				case "\r":
				case "\n":
					if(bPreviousWhiteSpace)
					{
						// Silently drop current whitespace character.
					}
					else
					{
						bPreviousWhiteSpace = true;
						strOutputSQL += " ";
					}

					continue charactersLoop;

				default:
					bPreviousWhiteSpace = false;
			}
		}
		
		switch(strSQL[i])
		{
			case strIdentifierDelimiter:
			case strExtraIdentifierDelimiter:
				strInsideIdentifierDelimiter = strSQL[i];
				strOutputSQL += strIdentifierDelimiter;
				continue charactersLoop;

			case "'":
			case strExtraStringDelimiter:
				strInsideStringLiteralDelimiter = strSQL[i];
				continue charactersLoop;

			case "-":
				if(
					i + 2 < strSQL.length
					&& strSQL[i + 1] === "-"
					&& (
						strSQL[i + 2] === " "
						|| strSQL[i + 2] === "\t"
					)
				)
				{
					bInsideLineComment = true;
					i += 2;
					continue charactersLoop;
				}

			case "/":
				if(
					/*i + 1 < strSQL.length
					&&*/ strSQL[i + 1] === "*"
				)
				{
					bInsideBlockComment = true;
					++i;
					continue charactersLoop;
				}
			
			default:
				let nCharCode = strSQL.charCodeAt(i);

				// Skip number sign (+ or -) if before a number and right after other arithmetic operators, bitwise operators, left round paranthesis or comma.
				if(strSQL[i] === "-" || strSQL[i] === "+")
				{
					let nCharacterPosition = i;
					while(++nCharacterPosition < strSQL.length)
					{
						if(
							strSQL.charCodeAt(nCharacterPosition) >= /*0*/ 0x30 
							&& strSQL.charCodeAt(nCharacterPosition) <= /*9*/ 0x39
						)
						{
							nCharacterPosition = i;
							let bWhiteSpaceEncountered = false;
							while(--nCharacterPosition >= 0)
							{
								if([" ", "\t", "\r", "\n"].includes(strSQL[nCharacterPosition]))
								{
									bWhiteSpaceEncountered = true;
									continue;
								}
			
								if(
									["+", "-", "/", "*", "%", "&", "~", "|", "^", "(", ","].includes(strSQL[nCharacterPosition])
									|| [">>", "<<"].includes(strSQL.substr(nCharacterPosition - 1, 2))
								)
								{
									++i;
									nCharCode = strSQL.charCodeAt(i);

									if(bStripWhiteSpace)
									{
										while(i < strSQL.length)
										{
											if([" ", "\t", "\r", "\n"].includes(strSQL[i]))
											{
												if(bWhiteSpaceEncountered)
												{
													++i;
													nCharCode = strSQL.charCodeAt(i);
												}

												bWhiteSpaceEncountered = true;

												continue;
											}
											
											break;
										}
									}
								}

								break;
							}

							break;
						}
					}
				}

				if(
					nCharCode >= /*0*/ 0x30 
					&& nCharCode <= /*9*/ 0x39
				)
				{
					bInsideNumber = true;

					// Skip (strip) number digit.
					continue charactersLoop;
				}
				else if(
					(
						nCharCode >= /*A*/ 0x41
						&& nCharCode <= /*Z*/ 0x5A
					)
					|| (
						nCharCode >= /*a*/ 0x61
						&& nCharCode <= /*z*/ 0x7A
					)
					|| nCharCode === /*_*/ 0x5F
				)
				{
					bInsideName = true;
				}

				strOutputSQL += strSQL[i];
		}
	}

	// Not yet optimized to reduce IN and NOT IN params in a single pass.
	if(bReduceNotInAndInParamsToOne)
	{
		strOutputSQL = strOutputSQL.replace(/([\s]{0,}|`)IN([\s]{0,})\([\s]{0,}\?[\s]{0,}([\s]{0,},[\s]{0,}\?)+\)/g, "$1IN$2(?)");
	}

	if(
		bInsideBlockComment
		|| strInsideIdentifierDelimiter
		|| strInsideStringLiteralDelimiter
		|| strErrorMessage
	)
	{
		const _strErrorMessage = `${(strErrorMessage || "Syntax error")}`;

		if(bWriteSyntaxErrorsToConsole)
		{
			console.error(`${_strErrorMessage}: ${strSQL}`);
		}

		if(bThrowOnSyntaxError)
		{
			throw new Error(`${_strErrorMessage}: ${strSQL}`);
		}

		return `${_strErrorMessage}: ${bStripWhiteSpace ? strOutputSQL.trim() : strOutputSQL.trimRight()}`;
	}
	
	return bStripWhiteSpace ? strOutputSQL.trim() : strOutputSQL.trimRight();
};

module.exports = unparametrize_sql_query;
