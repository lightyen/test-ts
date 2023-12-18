import * as ASCII from "./ascii"

export enum TokenType {
	EOF,
	Identifier,
	String, // quoted
	BadString, // quoted
	SemiColon,
	Exclamation,

	Num,
	Percentage,
	Dimension,
	// Length,
	// Angle,
	// Time,
	// Freq,
	// Resolution,
	// ContainerQueryLength,

	UnicodeRange,

	Hash,

	ParenthesisL,
	ParenthesisR,
	BracketL,
	BracketR,
	CurlyL,
	CurlyR,

	Comma,

	Slash,
	Delim,
	// Delim,
	// Includes,
	// Dashmatch, // |=
	// SubstringOperator, // *=
	// PrefixOperator, // ^=
	// SuffixOperator, // $=
}

const staticTokenTable: Record<number, TokenType> = {}
staticTokenTable[ASCII.semicolon] = TokenType.SemiColon
staticTokenTable[ASCII.leftBracket] = TokenType.BracketL
staticTokenTable[ASCII.rightBracket] = TokenType.BracketR
staticTokenTable[ASCII.leftParenthesis] = TokenType.ParenthesisL
staticTokenTable[ASCII.rightParenthesis] = TokenType.ParenthesisR
staticTokenTable[ASCII.leftCurly] = TokenType.CurlyL
staticTokenTable[ASCII.rightCurly] = TokenType.CurlyR
staticTokenTable[ASCII.comma] = TokenType.Comma
staticTokenTable[ASCII.slash] = TokenType.Slash

// https://developer.mozilla.org/en-US/docs/Web/CSS/length
const staticUnitTable: Record<string, TokenType> = {}
// staticUnitTable["em"] = TokenType.Length
// staticUnitTable["ch"] = TokenType.Length
// staticUnitTable["px"] = TokenType.Length
// staticUnitTable["cm"] = TokenType.Length
// staticUnitTable["mm"] = TokenType.Length
// staticUnitTable["in"] = TokenType.Length
// staticUnitTable["ic"] = TokenType.Length
// staticUnitTable["lh"] = TokenType.Length
// staticUnitTable["pt"] = TokenType.Length
// staticUnitTable["pc"] = TokenType.Length
// staticUnitTable["ex"] = TokenType.Length
// staticUnitTable["cap"] = TokenType.Length
// staticUnitTable["Q"] = TokenType.Length
// staticUnitTable["rem"] = TokenType.Length
// staticUnitTable["rlh"] = TokenType.Length

// staticUnitTable["vb"] = TokenType.Length
// staticUnitTable["vh"] = TokenType.Length
// staticUnitTable["vi"] = TokenType.Length
// staticUnitTable["vmax"] = TokenType.Length
// staticUnitTable["vmin"] = TokenType.Length
// staticUnitTable["vw"] = TokenType.Length

// staticUnitTable["dvb"] = TokenType.Length
// staticUnitTable["dvh"] = TokenType.Length
// staticUnitTable["dvi"] = TokenType.Length
// staticUnitTable["dvmax"] = TokenType.Length
// staticUnitTable["dvmin"] = TokenType.Length
// staticUnitTable["dvw"] = TokenType.Length

// staticUnitTable["lvb"] = TokenType.Length
// staticUnitTable["lvh"] = TokenType.Length
// staticUnitTable["lvi"] = TokenType.Length
// staticUnitTable["lvmax"] = TokenType.Length
// staticUnitTable["lvmin"] = TokenType.Length
// staticUnitTable["lvw"] = TokenType.Length

// staticUnitTable["svb"] = TokenType.Length
// staticUnitTable["svh"] = TokenType.Length
// staticUnitTable["svi"] = TokenType.Length
// staticUnitTable["svmax"] = TokenType.Length
// staticUnitTable["svmin"] = TokenType.Length
// staticUnitTable["svw"] = TokenType.Length

// staticUnitTable["deg"] = TokenType.Angle
// staticUnitTable["rad"] = TokenType.Angle
// staticUnitTable["grad"] = TokenType.Angle

// staticUnitTable["s"] = TokenType.Time
// staticUnitTable["ms"] = TokenType.Time

// staticUnitTable["hz"] = TokenType.Freq
// staticUnitTable["khz"] = TokenType.Freq

staticUnitTable["fr"] = TokenType.Percentage

// export interface Token {
// 	type: TokenType
// 	start: number
// 	end: number
// 	typeStr(): string
// }

export class Token {
	constructor(
		readonly type: TokenType,
		readonly start: number,
		readonly end: number,
	) {}

	get typeText(): string {
		return "#" + TokenType[this.type]
	}

	getText(source: string) {
		return source.slice(this.start, this.end)
	}
}

export class Reader {
	public source: string
	public len: number
	public position: number

	constructor(input: string) {
		this.source = input
		this.len = input.length
		this.position = 0
	}

	public slice(a?: number, b?: number) {
		return this.source.slice(a, b)
	}

	public nextChar() {
		return this.source.charCodeAt(this.position++) || ASCII.EOF
	}

	public peekChar(n = 0) {
		return this.source.charCodeAt(this.position + n) || ASCII.EOF
	}

	public lookbackChar(n = 0) {
		return this.source.charCodeAt(this.position - n) || ASCII.EOF
	}

	public pos() {
		return this.position
	}

	public goBackTo(pos: number) {
		this.position = pos
	}

	public goBack(n: number) {
		this.position -= n
	}

	public goAdd(n: number) {
		this.position += n
	}

	public goIfChar(ch: number): boolean {
		if (ch === this.source.charCodeAt(this.position)) {
			this.position++
			return true
		}
		return false
	}

	public goIfChars(...ch: number[]): boolean {
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

function isDigit(ch: number) {
	return ch >= ASCII._0 && ch <= ASCII._9
}

function isHexDigit(ch: number) {
	return (ch >= ASCII._0 && ch <= ASCII._9) || (ch >= ASCII._a && ch <= ASCII._f) || (ch >= ASCII._A && ch <= ASCII._F)
}

type ConsumeResult = [number, true] | false

export class Scanner {
	private stream = new Reader("")
	protected inURL = false

	constructor(input = "") {
		this.stream = new Reader(input)
	}

	public setSource(input: string) {
		this.stream = new Reader(input)
	}

	public get source(): string {
		return this.stream.source
	}

	public finishToken(type: TokenType, start: number, end: number): Token {
		return new Token(type, start, end)
	}

	public pos(): number {
		return this.stream.pos()
	}

	public goBackTo(pos: number): void {
		this.stream.goBackTo(pos)
	}

	///

	public whitespace(): boolean {
		const n = this.stream.goWhileChar(
			ch => ch === ASCII.whitespace || ch === ASCII.TAB || ch === ASCII.Newline || ch === ASCII.FF || ch === ASCII.CR,
		)
		return n > 0
	}

	public comment(): boolean {
		if (this.stream.goIfChars(ASCII.slash, ASCII.asterisk)) {
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
		if (isDigit(ch)) {
			this.stream.goAdd(npeek + 1)
			this.stream.goWhileChar(ch => {
				return isDigit(ch) || (npeek === 0 && ch === ASCII.dot)
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

	private unicodeRange(): boolean {
		// follow https://www.w3.org/TR/CSS21/syndata.html#tokenization and https://www.w3.org/TR/css-syntax-3/#urange-syntax
		// assume u has already been parsed

		if (this.stream.goIfChar(ASCII.plus)) {
			const codePoints = this.stream.goWhileChar(isHexDigit) + this.stream.goWhileChar(ch => ch === ASCII.question)
			if (codePoints >= 1 && codePoints <= 6) {
				if (this.stream.goIfChar(ASCII.hyphen)) {
					const digits = this.stream.goWhileChar(isHexDigit)
					if (digits >= 1 && digits <= 6) {
						return true
					}
				} else {
					return true
				}
			}
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

			while (hexNumCount < 6 && isHexDigit(ch)) {
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
		this.stream.goBackTo(pos)
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

	public next(): IteratorResult<Token, Token> {
		this.trivia()
		const offset = this.stream.pos()
		if (this.stream.eos()) {
			return { value: this.finishToken(TokenType.EOF, offset, offset), done: true }
		}
		return { value: this.scanNext(offset) }
	}

	public tryScanUnicode(): Token | undefined {
		const offset = this.stream.pos()
		if (!this.stream.eos() && this.unicodeRange()) {
			return this.finishToken(TokenType.UnicodeRange, offset, this.stream.pos())
		}
		this.stream.goBackTo(offset)
		return undefined
	}

	public scanNext(offset: number): Token {
		if (this.ident()) {
			return this.finishToken(TokenType.Identifier, offset, this.stream.pos())
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
				if (tokenType) {
					return this.finishToken(tokenType, offset, pos)
				} else {
					return this.finishToken(TokenType.Dimension, offset, pos)
				}
			}

			return this.finishToken(TokenType.Num, offset, end)
		}

		// String, BadString
		const ret = this.string()
		if (ret) {
			return this.finishToken(ret[1], offset + 1, ret[0])
		}

		const tokenType = staticTokenTable[this.stream.peekChar()]
		if (tokenType != undefined) {
			this.stream.goAdd(1)
			return this.finishToken(tokenType, offset, offset + 1)
		}

		// any char
		this.stream.nextChar()
		return this.finishToken(TokenType.Delim, offset, this.stream.pos())
	}
}
