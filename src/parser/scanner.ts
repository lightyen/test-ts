enum ASCII {
	EOF = 0,
	TAB = "\t".charCodeAt(0),
	Newline = "\n".charCodeAt(0),
	VT = "\v".charCodeAt(0),
	FF = "\f".charCodeAt(0),
	CR = "\r".charCodeAt(0),

	_a = "a".charCodeAt(0),
	_f = "f".charCodeAt(0),
	_z = "z".charCodeAt(0),
	_A = "A".charCodeAt(0),
	_F = "F".charCodeAt(0),
	_Z = "Z".charCodeAt(0),
	_0 = "0".charCodeAt(0),
	_9 = "9".charCodeAt(0),

	whitespace = " ".charCodeAt(0),
	bang = "!".charCodeAt(0),
	doubleQuote = '"'.charCodeAt(0),
	singleQuote = "'".charCodeAt(0),
	asterisk = "*".charCodeAt(0),
	hyphen = "-".charCodeAt(0),
	slash = "/".charCodeAt(0),
	backslash = "\\".charCodeAt(0),

	leftParenthesis = "(".charCodeAt(0),
	rightParenthesis = ")".charCodeAt(0),
	leftBracket = "[".charCodeAt(0),
	rightBracket = "]".charCodeAt(0),
	leftCurly = "{".charCodeAt(0),
	rightCurly = "}".charCodeAt(0),
	leftThan = "<".charCodeAt(0),
	rightThan = ">".charCodeAt(0),

	hash = "#".charCodeAt(0),
	at = "@".charCodeAt(0),
	question = "?".charCodeAt(0),
	plus = "+".charCodeAt(0),
	comma = ",".charCodeAt(0),
	dot = ".".charCodeAt(0),
	semicolon = ";".charCodeAt(0),
	colon = ":".charCodeAt(0),
	percent = "%".charCodeAt(0),
	underscore = "_".charCodeAt(0),
}

function isCharSpace(char: number) {
	if (char === ASCII.whitespace) {
		return true
	}
	if (char >= 0x09 && char <= 0x0d) {
		return true
	}
	return false
}

export enum TokenType {
	EOF,
	Ident,
	String, // quoted
	BadString, // quoted
	SemiColon,
	Exclamation,

	Num,
	EMS, // 3em
	EXS, // 3ex
	Length,
	Angle,
	Time,
	Freq,
	Percentage,
	Dimension,

	Comma,
	Slash,
	ParenthesisL,
	ParenthesisR,
	BracketL,
	BracketR,
	Hash,
	Delim,

	// bang = ASCII.bang,
	// doubleQuote = ASCII.doubleQuote,
	// singleQuote = ASCII.singleQuote,
	// asterisk = ASCII.asterisk,
	// hyphen = ASCII.hyphen,
	// slash = ASCII.slash,
	// backslash = ASCII.backslash,
	// leftParenthesis = ASCII.leftParenthesis,
	// rightParenthesis = ASCII.rightParenthesis,
	// leftBracket = ASCII.leftBracket,
	// rightBracket = ASCII.rightBracket,
	// leftCurly = ASCII.leftCurly,
	// rightCurly = ASCII.rightCurly,

	comma = ASCII.comma,
}

const staticTokenTable: Record<number, TokenType> = {}
staticTokenTable[ASCII.semicolon] = TokenType.SemiColon
staticTokenTable[ASCII.leftBracket] = TokenType.BracketL
staticTokenTable[ASCII.rightBracket] = TokenType.BracketR
staticTokenTable[ASCII.leftParenthesis] = TokenType.ParenthesisL
staticTokenTable[ASCII.rightParenthesis] = TokenType.ParenthesisR
staticTokenTable[ASCII.comma] = TokenType.Comma
staticTokenTable[ASCII.slash] = TokenType.Slash

const staticUnitTable: Record<string, TokenType> = {}
staticUnitTable["em"] = TokenType.EMS
staticUnitTable["ex"] = TokenType.EXS
staticUnitTable["px"] = TokenType.Length
staticUnitTable["cm"] = TokenType.Length
staticUnitTable["mm"] = TokenType.Length
staticUnitTable["in"] = TokenType.Length
staticUnitTable["pt"] = TokenType.Length
staticUnitTable["pc"] = TokenType.Length
staticUnitTable["deg"] = TokenType.Angle
staticUnitTable["rad"] = TokenType.Angle
staticUnitTable["grad"] = TokenType.Angle
staticUnitTable["ms"] = TokenType.Time
staticUnitTable["s"] = TokenType.Time
staticUnitTable["hz"] = TokenType.Freq
staticUnitTable["khz"] = TokenType.Freq
staticUnitTable["%"] = TokenType.Percentage
staticUnitTable["fr"] = TokenType.Percentage

export interface Token {
	type: TokenType
	range: [number, number]
	toString(): string
}

export class Reader {
	private source: string
	private len: number
	private position: number
	constructor(input: string) {
		this.source = input
		this.len = input.length
		this.position = 0
	}

	public slice(a: number, b?: number) {
		return this.source.slice(a, b)
	}

	public nextChar() {
		return this.source.charCodeAt(this.position++) || ASCII.EOF
	}

	public peekChar(n = 0) {
		return this.source.charCodeAt(this.position + n) || ASCII.EOF
	}

	public pos() {
		return this.position
	}

	public goBack(n: number) {
		this.position -= n
	}

	public goAdd(n: number) {
		this.position += n
	}

	public goTo(n: number) {
		this.position = n
	}

	public goIfChar(ch: number): boolean {
		if (ch === this.source.charCodeAt(this.position)) {
			this.position++
			return true
		}
		return false
	}

	public goIfChars(ch: number[]): boolean {
		if (this.position + ch.length > this.source.length) {
			return false
		}
		let i = 0
		for (; i < ch.length; i++) {
			if (this.source.charCodeAt(this.position + i) !== ch[i]) {
				return false
			}
		}
		this.goAdd(i)
		return true
	}

	public goWhileChar(condition: (ch: number) => boolean): number {
		const posNow = this.position
		while (this.position < this.len && condition(this.source.charCodeAt(this.position))) {
			this.position++
		}
		return this.position - posNow
	}

	public eos(): boolean {
		return this.len <= this.position
	}
}

type ConsumeResult = [number, true] | false

export class ExprScanner {
	private stream = new Reader("")
	public inURL = false

	constructor(input = "") {
		this.stream = new Reader(input)
	}

	public setSource(input: string) {
		this.stream = new Reader(input)
	}

	public finishToken(type: TokenType, a: number, b: number): Token {
		const toString = () => {
			return this.stream.slice(a, b)
		}
		return {
			type,
			range: [a, b],
			toString,
		}
	}

	public whitespace(): boolean {
		const n = this.stream.goWhileChar(
			ch => ch === ASCII.whitespace || ch === ASCII.TAB || ch === ASCII.Newline || ch === ASCII.FF || ch === ASCII.CR,
		)
		return n > 0
	}

	public comment(): boolean {
		if (this.stream.goIfChars([ASCII.slash, ASCII.asterisk])) {
			let success = false
			let hot = false
			this.stream.goWhileChar(ch => {
				if (hot && ch === ASCII.slash) {
					success = true
					return false
				}
				hot = ch === ASCII.asterisk
				return true
			})
			if (success) {
				this.stream.goAdd(1)
			}
			return true
		}
		return false
	}

	public trivia() {
		while (true) {
			// const offset = stream.pos()
			if (this.whitespace()) {
				//
			} else if (this.comment()) {
				//
			} else {
				return null
			}
		}
	}

	private minus(): ConsumeResult {
		const ch = this.stream.peekChar()
		if (ch === ASCII.hyphen) {
			this.stream.goAdd(1)
			const end = this.stream.pos()
			return [end, true]
		}
		return false
	}

	private number(): boolean {
		let npeek = 0
		if (this.stream.peekChar() === ASCII.dot) {
			npeek = 1
		}
		let ch = this.stream.peekChar(npeek)
		if (ch >= ASCII._0 && ch <= ASCII._9) {
			this.stream.goAdd(npeek + 1)
			this.stream.goWhileChar(ch => {
				return (ch >= ASCII._0 && ch <= ASCII._9) || (npeek === 0 && ch === ASCII.dot)
			})
			return true
		}
		return false
	}

	private newline(): ConsumeResult {
		const ch = this.stream.peekChar()
		switch (ch) {
			case ASCII.CR:
			case ASCII.FF:
			case ASCII.Newline:
				this.stream.goAdd(1)
				let end = this.stream.pos()
				if (ch === ASCII.CR && this.stream.goIfChar(ASCII.Newline)) {
					end++
				}
				return [end, true]
		}
		return false
	}

	private identFirstChar(): ConsumeResult {
		const ch = this.stream.peekChar()
		if (
			ch === ASCII.underscore || // _
			(ch >= ASCII._a && ch <= ASCII._z) || // a-z
			(ch >= ASCII._A && ch <= ASCII._Z) || // A-Z
			(ch >= 0x80 && ch <= 0xffff)
		) {
			// nonascii
			this.stream.goAdd(1)
			const end = this.stream.pos()
			return [end, true]
		}
		return false
	}

	private identChar(): ConsumeResult {
		const ch = this.stream.peekChar()
		if (
			ch === ASCII.underscore || // _
			ch === ASCII.hyphen || // -
			(ch >= ASCII._a && ch <= ASCII._z) || // a-z
			(ch >= ASCII._A && ch <= ASCII._Z) || // A-Z
			(ch >= ASCII._0 && ch <= ASCII._9) || // 0/9
			(ch >= 0x80 && ch <= 0xffff)
		) {
			// nonascii
			this.stream.goAdd(1)
			const end = this.stream.pos()
			return [end, true]
		}
		return false
	}

	private escape(includeNewLines?: boolean): ConsumeResult {
		let ch = this.stream.peekChar()
		if (ch === ASCII.backslash) {
			this.stream.goAdd(1)
			ch = this.stream.peekChar()
			let hexNumCount = 0
			let pos = this.stream.pos()

			while (
				hexNumCount < 6 &&
				((ch >= ASCII._0 && ch <= ASCII._9) || (ch >= ASCII._a && ch <= ASCII._f) || (ch >= ASCII._A && ch <= ASCII._F))
			) {
				this.stream.goAdd(1)
				ch = this.stream.peekChar()
				hexNumCount++
			}

			if (hexNumCount > 0) {
				try {
					const hexVal = parseInt(this.stream.slice(this.stream.pos() - hexNumCount, this.stream.pos()), 16)
					if (hexVal) {
						pos = this.stream.pos()
					}
				} catch {}

				// optional whitespace or new line, not part of result text
				if (ch === ASCII.whitespace || ch === ASCII.TAB) {
					this.stream.goAdd(1)
				} else {
					this.newline()
				}
				return [pos, true]
			}
			if (ch !== ASCII.CR && ch !== ASCII.FF && ch !== ASCII.Newline) {
				this.stream.goAdd(1)
				const pos = this.stream.pos()
				return [pos, true]
			} else if (includeNewLines) {
				return this.newline()
			}
		}
		return false
	}

	private name(): ConsumeResult {
		let matched: ConsumeResult = false
		for (let m = this.identChar() || this.escape(); m; m = this.identChar() || this.escape()) {
			matched = m
		}
		return matched
	}

	private ident(): ConsumeResult {
		const pos = this.stream.pos()
		const hasMinus = this.minus()
		let result: ConsumeResult = false
		if (hasMinus) {
			if ((result = this.minus() || this.identFirstChar() || this.escape())) {
				for (let m = this.identChar() || this.escape(); m; m = this.identChar() || this.escape()) {
					result = m
				}
				return result
			}
		} else if ((result = this.identFirstChar() || this.escape())) {
			for (let m = this.identChar() || this.escape(); m; m = this.identChar() || this.escape()) {
				result = m
			}
			return result
		}
		this.stream.goTo(pos)
		return false
	}

	private stringChar(closeQuote: number): ConsumeResult {
		// not closeQuote, not backslash, not newline
		const ch = this.stream.peekChar()
		if (
			ch !== ASCII.EOF &&
			ch !== closeQuote &&
			ch !== ASCII.backslash &&
			ch !== ASCII.CR &&
			ch !== ASCII.FF &&
			ch !== ASCII.Newline
		) {
			const pos = this.stream.pos()
			this.stream.goAdd(1)
			return [pos, true]
		}
		return false
	}

	private string(): [number, TokenType] | null {
		if (this.stream.peekChar() === ASCII.singleQuote || this.stream.peekChar() === ASCII.doubleQuote) {
			let end = this.stream.pos()
			const closeQuote = this.stream.nextChar()

			for (
				let m = this.stringChar(closeQuote) || this.escape(true);
				m;
				m = this.stringChar(closeQuote) || this.escape(true)
			) {
				end = m[0]
			}

			if (this.stream.peekChar() === closeQuote) {
				this.stream.nextChar()
				end = end + 1
				return [end, TokenType.String]
			} else {
				return [end, TokenType.BadString]
			}
		}
		return null
	}

	[Symbol.iterator]() {
		return this
	}

	public next(): IteratorResult<Token> {
		this.trivia()
		const offset = this.stream.pos()
		if (this.stream.eos()) {
			return { value: this.finishToken(TokenType.EOF, offset, offset), done: true }
		}
		return { value: this.scanNext(offset) }
	}

	public scanNext(offset: number): Token {
		if (this.ident()) {
			return this.finishToken(TokenType.Ident, offset, this.stream.pos())
		}

		if (this.stream.goIfChar(ASCII.hash)) {
			const result = this.name()
			if (result) {
				return this.finishToken(TokenType.Hash, offset, result[0])
			} else {
				return this.finishToken(TokenType.Delim, offset, offset + 1)
			}
		}

		// Important
		if (this.stream.goIfChar(ASCII.bang)) {
			return this.finishToken(TokenType.Exclamation, offset, offset + 1)
		}

		// Numbers
		if (this.number()) {
			let end = this.stream.pos()

			if (this.stream.goIfChar(ASCII.percent)) {
				// Percentage 43%
				return this.finishToken(TokenType.Percentage, offset, end + 1)
			} else if (this.ident()) {
				const pos = this.stream.pos()
				const dim = this.stream.slice(end, pos).toLowerCase()
				const tokenType = staticUnitTable[dim]
				if (tokenType != undefined) {
					// Known dimension 43px
					return this.finishToken(tokenType, offset, pos)
				} else {
					// Unknown dimension 43ft
					return this.finishToken(TokenType.Dimension, offset, pos)
				}
			}

			return this.finishToken(TokenType.Num, offset, end)
		}

		// String, BadString
		const ret = this.string()
		if (ret) {
			return this.finishToken(ret[1], offset, ret[0])
		}

		const tokenType = staticTokenTable[this.stream.peekChar()]
		if (tokenType != undefined) {
			this.stream.goAdd(1)
			return this.finishToken(tokenType, offset, offset + 1)
		}

		// Delim
		this.stream.nextChar()
		return this.finishToken(TokenType.Delim, offset, offset)
	}
}
